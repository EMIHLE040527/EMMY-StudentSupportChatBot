import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import axios from "axios";
import Chatbot from "./Chatbot";

// Chatbot talks to the sessions + chat API on mount and on send, so mock all
// three verbs it uses.
jest.mock("axios", () => ({
    get: jest.fn(),
    post: jest.fn(),
    patch: jest.fn()
}));

const user = { userId: 1, firstName: "Demo" };

beforeAll(() => {
    // jsdom has no layout, so the thread's scrollIntoView would throw.
    window.HTMLElement.prototype.scrollIntoView = jest.fn();
});

beforeEach(() => {
    jest.clearAllMocks();
});


test("restores saved sessions and their messages on load", async () => {

    axios.get.mockImplementation((url) => {
        if (url.endsWith("/sessions")) {
            return Promise.resolve({
                data: { sessions: [{ id: 7, title: "using quadratics" }] }
            });
        }
        if (url.includes("/messages")) {
            return Promise.resolve({
                data: {
                    messages: [
                        { role: "user", text: "what is the discriminant?" },
                        { role: "emmy", text: "It is the part under the root." }
                    ]
                }
            });
        }
        return Promise.resolve({ data: {} });
    });

    render(<Chatbot user={user} onLogout={() => {}} />);

    // The saved session appears (in the sidebar list and, as the active chat,
    // in the header).
    expect((await screen.findAllByText("using quadratics")).length).toBeGreaterThan(0);
    // ...and its stored exchange is loaded into the thread.
    expect(
        await screen.findByText(/what is the discriminant/i)
    ).toBeInTheDocument();
    expect(
        screen.getByText(/part under the root/i)
    ).toBeInTheDocument();
});


test("sends the message with user_id and session_id so it persists", async () => {

    axios.get.mockImplementation((url) => {
        if (url.endsWith("/sessions")) {
            return Promise.resolve({
                data: { sessions: [{ id: 42, title: "New chat" }] }
            });
        }
        if (url.includes("/messages")) {
            return Promise.resolve({ data: { messages: [] } });
        }
        return Promise.resolve({ data: {} });
    });
    axios.post.mockResolvedValue({ data: { reply: "Sure, happy to help!", saved: true } });
    axios.patch.mockResolvedValue({ data: { ok: true } });

    render(<Chatbot user={user} onLogout={() => {}} />);

    // Wait until the saved session is active (its messages were fetched).
    await waitFor(() =>
        expect(axios.get).toHaveBeenCalledWith(
            expect.stringContaining("/sessions/42/messages")
        )
    );

    fireEvent.change(screen.getByPlaceholderText(/ask emmy/i), {
        target: { value: "help me revise" }
    });
    fireEvent.click(screen.getByRole("button", { name: /send/i }));

    // The chat call carries the ids the backend needs to save the exchange.
    await waitFor(() =>
        expect(axios.post).toHaveBeenCalledWith(
            expect.stringContaining("/chat"),
            expect.objectContaining({
                message: "help me revise",
                user_id: 1,
                session_id: 42
            })
        )
    );

    // The first message also renames the session in the database.
    expect(axios.patch).toHaveBeenCalledWith(
        expect.stringContaining("/sessions/42"),
        expect.objectContaining({ title: "help me revise" })
    );

    expect(await screen.findByText("Sure, happy to help!")).toBeInTheDocument();
});

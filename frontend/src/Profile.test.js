import { render, screen, waitFor, fireEvent, act } from "@testing-library/react";
import axios from "axios";
import Profile from "./Profile";

jest.mock("axios", () => ({
    get: jest.fn(),
    put: jest.fn()
}));

const user = { userId: 1, firstName: "Demo" };

beforeEach(() => {
    jest.clearAllMocks();
});


test("fills the form from the saved profile", async () => {

    axios.get.mockResolvedValue({
        data: {
            first_name: "Demo",
            last_name: "Student",
            email: "demo@example.com",
            course: "BSc Computer Science",
            year_level: 2,
            preferred_language: "isiXhosa"
        }
    });

    render(<Profile user={user} />);

    expect(await screen.findByText("Demo Student")).toBeInTheDocument();
    expect(screen.getByLabelText(/course/i)).toHaveValue("BSc Computer Science");
    expect(screen.getByLabelText(/year of study/i)).toHaveValue("2");
    expect(screen.getByLabelText(/preferred language/i)).toHaveValue("isiXhosa");
});


test("saves changes and hands the new language back to the chat", async () => {

    axios.get.mockResolvedValue({
        data: {
            first_name: "Demo",
            last_name: "Student",
            email: "demo@example.com",
            course: "",
            year_level: null,
            preferred_language: ""
        }
    });
    axios.put.mockResolvedValue({
        data: { ok: true, course: "BA History", year_level: 1, preferred_language: "isiZulu" }
    });

    const onSaved = jest.fn();

    render(<Profile user={user} onSaved={onSaved} />);

    fireEvent.change(await screen.findByLabelText(/course/i), {
        target: { value: "BA History" }
    });
    fireEvent.change(screen.getByLabelText(/preferred language/i), {
        target: { value: "isiZulu" }
    });
    await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: /save profile/i }));
    });

    await waitFor(() =>
        expect(axios.put).toHaveBeenCalledWith(
            expect.stringContaining("/profile"),
            expect.objectContaining({
                user_id: 1,
                course: "BA History",
                preferred_language: "isiZulu"
            })
        )
    );

    // Chatbot keeps this so the next message already goes out in the new
    // language, without a reload.
    expect(onSaved).toHaveBeenCalledWith("isiZulu");
    expect(await screen.findByText("Saved.")).toBeInTheDocument();
});

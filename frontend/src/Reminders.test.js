import { render, screen, waitFor, fireEvent, act } from "@testing-library/react";
import axios from "axios";
import Reminders from "./Reminders";

jest.mock("axios", () => ({
    get: jest.fn(),
    post: jest.fn(),
    patch: jest.fn(),
    delete: jest.fn()
}));

const user = { userId: 1, firstName: "Demo" };

// Fixed "now" so the overdue test does not start passing or failing with the
// calendar. Everything before this instant is late; everything after is not.
const NOW = new Date("2026-07-25T12:00:00");

beforeAll(() => {
    jest.useFakeTimers().setSystemTime(NOW);
});

afterAll(() => {
    jest.useRealTimers();
});

beforeEach(() => {
    jest.clearAllMocks();
});


const saved = [
    { id: 1, title: "Essay draft", description: "", due: "2026-07-20T09:00", status: "Pending" },
    { id: 2, title: "Revise chapter 4", description: "Worked examples", due: "2026-08-02T14:30", status: "Pending" },
    { id: 3, title: "Return library book", description: "", due: "2026-07-21T10:00", status: "Done" }
];


test("lists saved reminders, splitting done from to do and flagging overdue", async () => {

    axios.get.mockResolvedValue({ data: { reminders: saved } });

    render(<Reminders user={user} />);

    expect(await screen.findByText("Essay draft")).toBeInTheDocument();
    expect(screen.getByText("Revise chapter 4")).toBeInTheDocument();
    expect(screen.getByText("Worked examples")).toBeInTheDocument();

    // Two pending, so the header counts two, and the done one sits apart.
    expect(screen.getByText("2 to do")).toBeInTheDocument();
    expect(screen.getByText("Done")).toBeInTheDocument();

    // Only the pending reminder whose date has passed is marked late. The
    // finished one is also in the past but is not the student's problem.
    expect(screen.getAllByText("Overdue")).toHaveLength(1);
});


test("adds a reminder and clears the form", async () => {

    axios.get.mockResolvedValue({ data: { reminders: [] } });
    axios.post.mockResolvedValue({
        data: { id: 9, title: "Past paper", description: "", due: "2026-08-05T08:00", status: "Pending" }
    });

    render(<Reminders user={user} />);

    await screen.findByText(/no reminders yet/i);

    const title = screen.getByLabelText(/what do you need to do/i);
    fireEvent.change(title, { target: { value: "Past paper" } });
    await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: /add reminder/i }));
    });

    await waitFor(() =>
        expect(axios.post).toHaveBeenCalledWith(
            expect.stringContaining("/reminders"),
            expect.objectContaining({ user_id: 1, title: "Past paper" })
        )
    );

    expect(await screen.findByText("Past paper")).toBeInTheDocument();
    expect(title).toHaveValue("");
});


test("ticking a reminder saves the new status", async () => {

    axios.get.mockResolvedValue({ data: { reminders: [saved[1]] } });
    axios.patch.mockResolvedValue({ data: { ok: true, status: "Done" } });

    render(<Reminders user={user} />);

    const tick = await screen.findByTitle(/mark as done/i);
    await act(async () => { fireEvent.click(tick); });

    await waitFor(() =>
        expect(axios.patch).toHaveBeenCalledWith(
            expect.stringContaining("/reminders/2"),
            expect.objectContaining({ user_id: 1, status: "Done" })
        )
    );
});


test("puts a reminder back when deleting it fails", async () => {

    axios.get.mockResolvedValue({ data: { reminders: [saved[1]] } });
    axios.delete.mockRejectedValue(new Error("offline"));

    render(<Reminders user={user} />);

    const del = await screen.findByTitle(/delete this reminder/i);
    await act(async () => { fireEvent.click(del); });

    // The row comes back rather than vanishing on a failure the student
    // never asked for, and they are told why.
    expect(await screen.findByText(/couldn't delete/i)).toBeInTheDocument();
    expect(screen.getByText("Revise chapter 4")).toBeInTheDocument();
});

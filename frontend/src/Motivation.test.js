import { render, screen, waitFor, fireEvent, act } from "@testing-library/react";
import axios from "axios";
import Motivation from "./Motivation";

jest.mock("axios", () => ({
    get: jest.fn()
}));

const user = { userId: 1, firstName: "Demo" };

const word = {
    term: "empirical",
    meaning: "based on what you observe or measure, not on theory alone",
    example: "Her argument was empirical, built on lab results."
};

beforeEach(() => {
    jest.clearAllMocks();
});


test("shows today's word", async () => {

    axios.get.mockResolvedValue({ data: { word, date: "2026-07-25" } });

    render(<Motivation user={user} />);

    expect(await screen.findByText("empirical")).toBeInTheDocument();
    expect(screen.getByText(/not on theory alone/)).toBeInTheDocument();
    expect(screen.getByText(/built on lab results/)).toBeInTheDocument();

    // The date is built from the parts, not parsed as UTC, so it must still
    // read as the 25th rather than slipping back a day.
    expect(screen.getByText(/25 July/)).toBeInTheDocument();
});


test("offers a retry when the word cannot be fetched", async () => {

    axios.get.mockRejectedValueOnce({
        response: { data: { error: "I couldn't fetch today's word. Try again in a moment?" } }
    });

    render(<Motivation user={user} />);

    expect(await screen.findByText(/couldn't fetch today's word/i)).toBeInTheDocument();

    // A failed first load must not be a dead end, so the retry actually refetches.
    axios.get.mockResolvedValue({ data: { word, date: "2026-07-25" } });

    await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: /try again/i }));
    });

    await waitFor(() => expect(axios.get).toHaveBeenCalledTimes(2));
    expect(await screen.findByText("empirical")).toBeInTheDocument();
});

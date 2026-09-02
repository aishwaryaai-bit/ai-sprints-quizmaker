import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockPush = vi.fn();

vi.mock("next/navigation", () => ({
	useRouter: () => ({ push: mockPush }),
}));

import { McqList } from "./mcq-list";

const sampleMcqs = [
	{
		id: "mcq-1",
		name: "Photosynthesis basics",
		question: "Which organelle performs photosynthesis?",
		createdByUserId: "user-1",
		createdAt: "2026-01-01 00:00:00",
		updatedAt: "2026-01-01 00:00:00",
	},
];

describe("McqList", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		global.fetch = vi.fn();
		vi.mocked(global.fetch).mockResolvedValue(
			new Response(JSON.stringify({ mcqs: sampleMcqs }), { status: 200 }),
		);
	});

	it("renders table rows from GET /api/mcqs", async () => {
		render(<McqList />);

		expect(await screen.findByText("Photosynthesis basics")).toBeInTheDocument();
		expect(screen.getByText("Which organelle performs photosynthesis?")).toBeInTheDocument();
		expect(global.fetch).toHaveBeenCalledWith("/api/mcqs");
	});

	it("links the create button to /mcq/new", async () => {
		render(<McqList />);

		await screen.findByText("Photosynthesis basics");

		expect(screen.getByRole("button", { name: /create mcq/i })).toHaveAttribute(
			"href",
			"/mcq/new",
		);
	});

	it("exposes edit, preview, and delete actions in the row menu", async () => {
		const user = userEvent.setup({ pointerEventsCheck: 0 });
		render(<McqList />);

		await screen.findByText("Photosynthesis basics");
		await user.click(screen.getByRole("button", { name: /actions for photosynthesis basics/i }));

		expect(await screen.findByRole("menuitem", { name: /^edit$/i })).toBeInTheDocument();
		expect(screen.getByRole("menuitem", { name: /^preview$/i })).toBeInTheDocument();
		expect(screen.getByRole("menuitem", { name: /^delete$/i })).toBeInTheDocument();
	});

	it("calls DELETE and refreshes the list after delete confirmation", async () => {
		const user = userEvent.setup({ pointerEventsCheck: 0 });
		vi.mocked(global.fetch)
			.mockResolvedValueOnce(
				new Response(JSON.stringify({ mcqs: sampleMcqs }), { status: 200 }),
			)
			.mockResolvedValueOnce(new Response(JSON.stringify({ success: true }), { status: 200 }))
			.mockResolvedValueOnce(new Response(JSON.stringify({ mcqs: [] }), { status: 200 }));

		render(<McqList />);

		await screen.findByText("Photosynthesis basics");
		await user.click(screen.getByRole("button", { name: /actions for photosynthesis basics/i }));
		await user.click(await screen.findByRole("menuitem", { name: /^delete$/i }));
		await user.click(screen.getByRole("button", { name: /^delete mcq$/i }));

		await waitFor(() => {
			expect(global.fetch).toHaveBeenCalledWith("/api/mcqs/mcq-1", {
				method: "DELETE",
			});
		});

		expect(await screen.findByText(/no multiple-choice questions yet/i)).toBeInTheDocument();
	});
});

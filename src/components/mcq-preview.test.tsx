import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
	useRouter: () => ({ push: vi.fn() }),
}));

import { McqPreview } from "./mcq-preview";

const sampleMcq = {
	id: "mcq-1",
	name: "Photosynthesis basics",
	question: "Which organelle performs photosynthesis?",
	createdByUserId: "user-1",
	createdAt: "2026-01-01 00:00:00",
	updatedAt: "2026-01-01 00:00:00",
	choices: [
		{
			id: "choice-1",
			choiceText: "Mitochondria",
			isCorrect: false,
			displayOrder: 0,
			createdAt: "2026-01-01 00:00:00",
		},
		{
			id: "choice-2",
			choiceText: "Chloroplast",
			isCorrect: true,
			displayOrder: 1,
			createdAt: "2026-01-01 00:00:00",
		},
	],
};

describe("McqPreview", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		global.fetch = vi.fn();
		vi.mocked(global.fetch).mockResolvedValue(
			new Response(JSON.stringify({ mcq: sampleMcq }), { status: 200 }),
		);
	});

	it("renders the question and choices", async () => {
		render(<McqPreview mcqId="mcq-1" />);

		expect(await screen.findByText(/Which organelle performs photosynthesis/i)).toBeInTheDocument();
		expect(screen.getByRole("radio", { name: "Mitochondria" })).toBeInTheDocument();
		expect(screen.getByRole("radio", { name: "Chloroplast" })).toBeInTheDocument();
	});

	it("posts an attempt with the selected choiceId and shows feedback", async () => {
		const user = userEvent.setup({ pointerEventsCheck: 0 });
		vi.mocked(global.fetch)
			.mockResolvedValueOnce(
				new Response(JSON.stringify({ mcq: sampleMcq }), { status: 200 }),
			)
			.mockResolvedValueOnce(
				new Response(
					JSON.stringify({
						attempt: {
							id: "attempt-1",
							mcqId: "mcq-1",
							choiceId: "choice-2",
							isCorrect: true,
							createdAt: "2026-01-02 00:00:00",
						},
					}),
					{ status: 201 },
				),
			);

		render(<McqPreview mcqId="mcq-1" />);

		await screen.findByText(/Which organelle performs photosynthesis/i);
		await user.click(screen.getByRole("radio", { name: "Chloroplast" }));
		await user.click(screen.getByRole("button", { name: /submit answer/i }));

		await waitFor(() => {
			expect(global.fetch).toHaveBeenCalledWith("/api/mcqs/mcq-1/attempts", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ choiceId: "choice-2" }),
			});
		});

		expect(await screen.findByText(/correct/i)).toBeInTheDocument();
	});
});

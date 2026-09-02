import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockPush = vi.fn();

vi.mock("next/navigation", () => ({
	useRouter: () => ({ push: mockPush }),
}));

import { USER_ID_STORAGE_KEY } from "@/lib/auth-session";
import { McqForm } from "./mcq-form";

const validCreatePayload = {
	name: "Photosynthesis basics",
	question: "Which organelle performs photosynthesis?",
	createdByUserId: "user-1",
	choices: [
		{ choiceText: "Mitochondria", isCorrect: false },
		{ choiceText: "Chloroplast", isCorrect: true },
	],
};

describe("McqForm", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		global.fetch = vi.fn();
		sessionStorage.setItem(USER_ID_STORAGE_KEY, "user-1");
	});

	it("renders name, question, and 2 default choices", () => {
		render(<McqForm mode="create" />);

		expect(screen.getByLabelText(/^name$/i)).toBeInTheDocument();
		expect(screen.getByLabelText(/^question$/i)).toBeInTheDocument();
		expect(screen.getAllByLabelText(/choice text/i)).toHaveLength(2);
	});

	it("can add and remove choices within 2–6 bounds", async () => {
		const user = userEvent.setup();
		render(<McqForm mode="create" />);

		const addButton = screen.getByRole("button", { name: /add choice/i });
		const removeButtons = () => screen.getAllByRole("button", { name: /remove choice/i });

		await user.click(addButton);
		await user.click(addButton);
		await user.click(addButton);
		await user.click(addButton);
		expect(screen.getAllByLabelText(/choice text/i)).toHaveLength(6);
		expect(addButton).toBeDisabled();

		await user.click(removeButtons()[0]!);
		await user.click(removeButtons()[0]!);
		await user.click(removeButtons()[0]!);
		await user.click(removeButtons()[0]!);
		expect(screen.getAllByLabelText(/choice text/i)).toHaveLength(2);
		expect(removeButtons()[0]).toBeDisabled();
		expect(removeButtons()[1]).toBeDisabled();
	});

	it("submits POST when creating an mcq", async () => {
		const user = userEvent.setup();
		vi.mocked(global.fetch).mockResolvedValue(
			new Response(JSON.stringify({ mcq: { id: "mcq-1" } }), { status: 201 }),
		);

		render(<McqForm mode="create" />);

		await user.type(screen.getByLabelText(/^name$/i), validCreatePayload.name);
		await user.type(screen.getByLabelText(/^question$/i), validCreatePayload.question);
		await user.type(screen.getAllByLabelText(/choice text/i)[0]!, "Mitochondria");
		await user.type(screen.getAllByLabelText(/choice text/i)[1]!, "Chloroplast");
		await user.click(screen.getByLabelText(/mark chloroplast as correct/i));
		await user.click(screen.getByRole("button", { name: /^save$/i }));

		await waitFor(() => {
			expect(global.fetch).toHaveBeenCalledWith("/api/mcqs", expect.objectContaining({
				method: "POST",
				headers: { "Content-Type": "application/json" },
			}));
		});

		const requestBody = JSON.parse(
			vi.mocked(global.fetch).mock.calls.find(([url]) => url === "/api/mcqs")?.[1]
				?.body as string,
		);
		expect(requestBody).toEqual(validCreatePayload);

		expect(mockPush).toHaveBeenCalledWith("/mcq");
	});

	it("submits PUT when editing an mcq", async () => {
		const user = userEvent.setup();
		vi.mocked(global.fetch)
			.mockResolvedValueOnce(
				new Response(
					JSON.stringify({
						mcq: {
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
						},
					}),
					{ status: 200 },
				),
			)
			.mockResolvedValueOnce(
				new Response(JSON.stringify({ mcq: { id: "mcq-1" } }), { status: 200 }),
			);

		render(<McqForm mode="edit" mcqId="mcq-1" />);

		await screen.findByDisplayValue("Photosynthesis basics");
		await user.clear(screen.getByLabelText(/^name$/i));
		await user.type(screen.getByLabelText(/^name$/i), "Updated title");
		await user.click(screen.getByRole("button", { name: /^save$/i }));

		await waitFor(() => {
			expect(global.fetch).toHaveBeenCalledWith("/api/mcqs/mcq-1", {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					name: "Updated title",
					question: "Which organelle performs photosynthesis?",
					choices: validCreatePayload.choices,
				}),
			});
		});
	});

	it("navigates to /mcq when cancel is clicked", async () => {
		const user = userEvent.setup();
		render(<McqForm mode="create" />);

		await user.click(screen.getByRole("button", { name: /^cancel$/i }));

		expect(mockPush).toHaveBeenCalledWith("/mcq");
	});
});

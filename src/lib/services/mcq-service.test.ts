import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	ChoiceNotFoundError,
	createMcqService,
	McqNotFoundError,
} from "@/lib/services/mcq-service";

const mcqRow = {
	id: "mcq-1",
	name: "Photosynthesis basics",
	question: "Which organelle performs photosynthesis?",
	created_by_user_id: "user-1",
	created_at: "2026-01-01 00:00:00",
	updated_at: "2026-01-01 00:00:00",
};

const choiceRows = [
	{
		id: "choice-1",
		mcq_id: "mcq-1",
		choice_text: "Mitochondria",
		is_correct: 0,
		display_order: 0,
		created_at: "2026-01-01 00:00:00",
	},
	{
		id: "choice-2",
		mcq_id: "mcq-1",
		choice_text: "Chloroplast",
		is_correct: 1,
		display_order: 1,
		created_at: "2026-01-01 00:00:00",
	},
];

const mcqWithChoices = {
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

function createMockDb() {
	const run = vi.fn();
	const all = vi.fn();
	const bind = vi.fn(() => ({ run, all }));
	const prepare = vi.fn(() => ({ bind, run, all }));
	const db = { prepare } as unknown as D1Database;
	return { db, prepare, bind, run, all };
}

describe("createMcqService", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("listMcqs returns summary rows without choices", async () => {
		const { db, all } = createMockDb();
		all.mockResolvedValue({ results: [mcqRow] });

		const service = createMcqService(db);
		const mcqs = await service.listMcqs();

		expect(mcqs).toEqual([
			{
				id: "mcq-1",
				name: "Photosynthesis basics",
				question: "Which organelle performs photosynthesis?",
				createdByUserId: "user-1",
				createdAt: "2026-01-01 00:00:00",
				updatedAt: "2026-01-01 00:00:00",
			},
		]);
	});

	it("createMcq inserts MCQ and choices and returns the full object", async () => {
		const { db, all, run } = createMockDb();
		run.mockResolvedValue({ success: true });
		all
			.mockResolvedValueOnce({ results: [mcqRow] })
			.mockResolvedValueOnce({ results: [mcqRow] })
			.mockResolvedValueOnce({ results: choiceRows });

		const service = createMcqService(db);
		const mcq = await service.createMcq({
			name: mcqRow.name,
			question: mcqRow.question,
			createdByUserId: mcqRow.created_by_user_id,
			choices: [
				{ choiceText: "Mitochondria", isCorrect: false },
				{ choiceText: "Chloroplast", isCorrect: true },
			],
		});

		expect(mcq).toEqual(mcqWithChoices);
	});

	it("getMcqById returns MCQ with ordered choices or null", async () => {
		const { db, all } = createMockDb();
		all
			.mockResolvedValueOnce({ results: [mcqRow] })
			.mockResolvedValueOnce({ results: choiceRows })
			.mockResolvedValueOnce({ results: [] });

		const service = createMcqService(db);
		await expect(service.getMcqById("mcq-1")).resolves.toEqual(mcqWithChoices);
		await expect(service.getMcqById("missing")).resolves.toBeNull();
	});

	it("updateMcq updates fields and replaces choices", async () => {
		const { db, all, run } = createMockDb();
		const updatedRow = { ...mcqRow, name: "Updated name" };
		run.mockResolvedValue({ success: true });
		all
			.mockResolvedValueOnce({ results: [mcqRow] })
			.mockResolvedValueOnce({ results: choiceRows })
			.mockResolvedValueOnce({ results: [updatedRow] })
			.mockResolvedValueOnce({ results: [updatedRow] })
			.mockResolvedValueOnce({ results: choiceRows });

		const service = createMcqService(db);
		const mcq = await service.updateMcq("mcq-1", {
			name: "Updated name",
			question: mcqRow.question,
			choices: [
				{ choiceText: "Mitochondria", isCorrect: false },
				{ choiceText: "Chloroplast", isCorrect: true },
			],
		});

		expect(mcq.name).toBe("Updated name");
		expect(mcq.choices).toHaveLength(2);
	});

	it("updateMcq throws McqNotFoundError when MCQ does not exist", async () => {
		const { db, all } = createMockDb();
		all.mockResolvedValue({ results: [] });

		const service = createMcqService(db);
		await expect(
			service.updateMcq("missing", {
				name: "Updated name",
				question: mcqRow.question,
				choices: [
					{ choiceText: "A", isCorrect: false },
					{ choiceText: "B", isCorrect: true },
				],
			}),
		).rejects.toBeInstanceOf(McqNotFoundError);
	});

	it("deleteMcq removes the row", async () => {
		const { db, bind, run } = createMockDb();
		run.mockResolvedValue({ success: true });

		const service = createMcqService(db);
		await service.deleteMcq("mcq-1");

		expect(bind).toHaveBeenCalledWith("mcq-1");
		expect(run).toHaveBeenCalled();
	});

	it("createAttempt sets isCorrect from the choice row", async () => {
		const { db, all } = createMockDb();
		all
			.mockResolvedValueOnce({ results: [choiceRows[1]] })
			.mockResolvedValueOnce({
				results: [
					{
						id: "attempt-1",
						mcq_id: "mcq-1",
						choice_id: "choice-2",
						is_correct: 1,
						created_at: "2026-01-02 00:00:00",
					},
				],
			});

		const service = createMcqService(db);
		const attempt = await service.createAttempt("mcq-1", "choice-2");

		expect(attempt).toEqual({
			id: "attempt-1",
			mcqId: "mcq-1",
			choiceId: "choice-2",
			isCorrect: true,
			createdAt: "2026-01-02 00:00:00",
		});
	});

	it("createAttempt rejects a choice that belongs to a different MCQ", async () => {
		const { db, all } = createMockDb();
		all.mockResolvedValueOnce({
			results: [{ ...choiceRows[1], mcq_id: "other-mcq" }],
		});

		const service = createMcqService(db);
		await expect(service.createAttempt("mcq-1", "choice-2")).rejects.toBeInstanceOf(
			ChoiceNotFoundError,
		);
	});

	it("createAttempt throws ChoiceNotFoundError when choice is missing", async () => {
		const { db, all } = createMockDb();
		all.mockResolvedValueOnce({ results: [] });

		const service = createMcqService(db);
		await expect(service.createAttempt("mcq-1", "missing")).rejects.toBeInstanceOf(
			ChoiceNotFoundError,
		);
	});
});

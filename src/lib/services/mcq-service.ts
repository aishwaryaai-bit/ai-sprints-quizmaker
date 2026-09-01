import type { ChoiceInput } from "@/lib/validators/mcq";

export class McqNotFoundError extends Error {
	constructor(message = "MCQ not found") {
		super(message);
		this.name = "McqNotFoundError";
	}
}

export class ChoiceNotFoundError extends Error {
	constructor(message = "Choice not found") {
		super(message);
		this.name = "ChoiceNotFoundError";
	}
}

export type McqChoice = {
	id: string;
	choiceText: string;
	isCorrect: boolean;
	displayOrder: number;
	createdAt: string;
};

export type Mcq = {
	id: string;
	name: string;
	description: string | null;
	question: string;
	createdByUserId: string;
	createdAt: string;
	updatedAt: string;
};

export type McqWithChoices = Mcq & {
	choices: McqChoice[];
};

export type McqAttempt = {
	id: string;
	mcqId: string;
	choiceId: string;
	isCorrect: boolean;
	createdAt: string;
};

export type CreateMcqServiceInput = {
	name: string;
	description?: string | null;
	question: string;
	createdByUserId: string;
	choices: ChoiceInput[];
};

export type UpdateMcqServiceInput = {
	name: string;
	description?: string | null;
	question: string;
	choices: ChoiceInput[];
};

type McqRow = {
	id: string;
	name: string;
	description: string | null;
	question: string;
	created_by_user_id: string;
	created_at: string;
	updated_at: string;
};

type ChoiceRow = {
	id: string;
	mcq_id: string;
	choice_text: string;
	is_correct: number;
	display_order: number;
	created_at: string;
};

type AttemptRow = {
	id: string;
	mcq_id: string;
	choice_id: string;
	is_correct: number;
	created_at: string;
};

const MCQ_SELECT =
	"SELECT id, name, description, question, created_by_user_id, created_at, updated_at FROM mcqs";

const CHOICE_SELECT =
	"SELECT id, mcq_id, choice_text, is_correct, display_order, created_at FROM mcq_choices";

function getFirstRow<T>(results: T[] | undefined): T | null {
	return results?.[0] ?? null;
}

function toMcq(row: McqRow): Mcq {
	return {
		id: row.id,
		name: row.name,
		description: row.description,
		question: row.question,
		createdByUserId: row.created_by_user_id,
		createdAt: row.created_at,
		updatedAt: row.updated_at,
	};
}

function toChoice(row: ChoiceRow): McqChoice {
	return {
		id: row.id,
		choiceText: row.choice_text,
		isCorrect: row.is_correct === 1,
		displayOrder: row.display_order,
		createdAt: row.created_at,
	};
}

function toAttempt(row: AttemptRow): McqAttempt {
	return {
		id: row.id,
		mcqId: row.mcq_id,
		choiceId: row.choice_id,
		isCorrect: row.is_correct === 1,
		createdAt: row.created_at,
	};
}

async function insertChoices(
	db: D1Database,
	mcqId: string,
	choices: ChoiceInput[],
): Promise<void> {
	for (const [index, choice] of choices.entries()) {
		await db
			.prepare(
				`INSERT INTO mcq_choices (mcq_id, choice_text, is_correct, display_order)
         VALUES (?1, ?2, ?3, ?4)`,
			)
			.bind(mcqId, choice.choiceText, choice.isCorrect ? 1 : 0, index)
			.run();
	}
}

export function createMcqService(db: D1Database) {
	return {
		async listMcqs(): Promise<Mcq[]> {
			const result = await db
				.prepare(`${MCQ_SELECT} ORDER BY created_at DESC`)
				.all<McqRow>();

			return (result.results ?? []).map(toMcq);
		},

		async getMcqById(id: string): Promise<McqWithChoices | null> {
			const mcqResult = await db
				.prepare(`${MCQ_SELECT} WHERE id = ?1`)
				.bind(id)
				.all<McqRow>();

			const mcqRow = getFirstRow(mcqResult.results);
			if (!mcqRow) {
				return null;
			}

			const choicesResult = await db
				.prepare(`${CHOICE_SELECT} WHERE mcq_id = ?1 ORDER BY display_order ASC`)
				.bind(id)
				.all<ChoiceRow>();

			return {
				...toMcq(mcqRow),
				choices: (choicesResult.results ?? []).map(toChoice),
			};
		},

		async createMcq(input: CreateMcqServiceInput): Promise<McqWithChoices> {
			const result = await db
				.prepare(
					`INSERT INTO mcqs (name, description, question, created_by_user_id)
           VALUES (?1, ?2, ?3, ?4)
           RETURNING id, name, description, question, created_by_user_id, created_at, updated_at`,
				)
				.bind(
					input.name,
					input.description ?? null,
					input.question,
					input.createdByUserId,
				)
				.all<McqRow>();

			const mcqRow = getFirstRow(result.results);
			if (!mcqRow) {
				throw new Error("Failed to create MCQ");
			}

			await insertChoices(db, mcqRow.id, input.choices);

			const created = await this.getMcqById(mcqRow.id);
			if (!created) {
				throw new Error("Failed to load created MCQ");
			}

			return created;
		},

		async updateMcq(id: string, input: UpdateMcqServiceInput): Promise<McqWithChoices> {
			const existing = await this.getMcqById(id);
			if (!existing) {
				throw new McqNotFoundError();
			}

			const result = await db
				.prepare(
					`UPDATE mcqs
           SET name = ?1, description = ?2, question = ?3, updated_at = CURRENT_TIMESTAMP
           WHERE id = ?4
           RETURNING id, name, description, question, created_by_user_id, created_at, updated_at`,
				)
				.bind(input.name, input.description ?? null, input.question, id)
				.all<McqRow>();

			const mcqRow = getFirstRow(result.results);
			if (!mcqRow) {
				throw new McqNotFoundError();
			}

			await db.prepare("DELETE FROM mcq_choices WHERE mcq_id = ?1").bind(id).run();
			await insertChoices(db, id, input.choices);

			const updated = await this.getMcqById(id);
			if (!updated) {
				throw new Error("Failed to load updated MCQ");
			}

			return updated;
		},

		async deleteMcq(id: string): Promise<void> {
			await db.prepare("DELETE FROM mcqs WHERE id = ?1").bind(id).run();
		},

		async createAttempt(mcqId: string, choiceId: string): Promise<McqAttempt> {
			const choiceResult = await db
				.prepare(`${CHOICE_SELECT} WHERE id = ?1`)
				.bind(choiceId)
				.all<ChoiceRow>();

			const choiceRow = getFirstRow(choiceResult.results);
			if (!choiceRow || choiceRow.mcq_id !== mcqId) {
				throw new ChoiceNotFoundError();
			}

			const result = await db
				.prepare(
					`INSERT INTO mcq_attempts (mcq_id, choice_id, is_correct)
           VALUES (?1, ?2, ?3)
           RETURNING id, mcq_id, choice_id, is_correct, created_at`,
				)
				.bind(mcqId, choiceId, choiceRow.is_correct)
				.all<AttemptRow>();

			const attemptRow = getFirstRow(result.results);
			if (!attemptRow) {
				throw new Error("Failed to create attempt");
			}

			return toAttempt(attemptRow);
		},
	};
}

export type McqService = ReturnType<typeof createMcqService>;

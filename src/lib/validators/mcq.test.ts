import { describe, expect, it } from "vitest";
import { attemptSchema, createMcqSchema, updateMcqSchema } from "./mcq";

const validChoices = [
	{ choiceText: "Mitochondria", isCorrect: false },
	{ choiceText: "Chloroplast", isCorrect: true },
];

const validCreate = {
	name: "Photosynthesis basics",
	question: "Which organelle performs photosynthesis?",
	createdByUserId: "user-1",
	choices: validChoices,
};

describe("createMcqSchema", () => {
	it("accepts a valid payload with 2–6 choices", () => {
		expect(createMcqSchema.safeParse(validCreate).success).toBe(true);
		expect(
			createMcqSchema.safeParse({
				...validCreate,
				choices: [
					...validChoices,
					{ choiceText: "Nucleus", isCorrect: false },
					{ choiceText: "Ribosome", isCorrect: false },
					{ choiceText: "Golgi", isCorrect: false },
					{ choiceText: "Vacuole", isCorrect: false },
				],
			}).success,
		).toBe(true);
	});

	it("rejects empty name", () => {
		expect(createMcqSchema.safeParse({ ...validCreate, name: "" }).success).toBe(
			false,
		);
	});

	it("rejects empty question", () => {
		expect(
			createMcqSchema.safeParse({ ...validCreate, question: "" }).success,
		).toBe(false);
	});

	it("rejects fewer than 2 choices", () => {
		expect(
			createMcqSchema.safeParse({
				...validCreate,
				choices: [{ choiceText: "Only one", isCorrect: true }],
			}).success,
		).toBe(false);
	});

	it("rejects more than 6 choices", () => {
		expect(
			createMcqSchema.safeParse({
				...validCreate,
				choices: Array.from({ length: 7 }, (_, index) => ({
					choiceText: `Choice ${index + 1}`,
					isCorrect: index === 0,
				})),
			}).success,
		).toBe(false);
	});

	it("rejects zero correct choices", () => {
		expect(
			createMcqSchema.safeParse({
				...validCreate,
				choices: [
					{ choiceText: "A", isCorrect: false },
					{ choiceText: "B", isCorrect: false },
				],
			}).success,
		).toBe(false);
	});

	it("rejects multiple correct choices", () => {
		expect(
			createMcqSchema.safeParse({
				...validCreate,
				choices: [
					{ choiceText: "A", isCorrect: true },
					{ choiceText: "B", isCorrect: true },
				],
			}).success,
		).toBe(false);
	});

	it("rejects empty choice text", () => {
		expect(
			createMcqSchema.safeParse({
				...validCreate,
				choices: [
					{ choiceText: "   ", isCorrect: false },
					{ choiceText: "B", isCorrect: true },
				],
			}).success,
		).toBe(false);
	});
});

describe("updateMcqSchema", () => {
	it("accepts a valid update payload without createdByUserId", () => {
		expect(
			updateMcqSchema.safeParse({
				name: validCreate.name,
				question: validCreate.question,
				choices: validChoices,
			}).success,
		).toBe(true);
	});

	it("rejects missing choices", () => {
		expect(
			updateMcqSchema.safeParse({
				name: validCreate.name,
				question: validCreate.question,
			}).success,
		).toBe(false);
	});
});

describe("attemptSchema", () => {
	it("requires choiceId", () => {
		expect(attemptSchema.safeParse({ choiceId: "choice-1" }).success).toBe(true);
		expect(attemptSchema.safeParse({}).success).toBe(false);
		expect(attemptSchema.safeParse({ choiceId: "" }).success).toBe(false);
	});
});

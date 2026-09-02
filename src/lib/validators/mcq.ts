import { z } from "zod";

const choiceInputSchema = z.object({
	choiceText: z.string().trim().min(1, "Choice text is required"),
	isCorrect: z.boolean(),
});

const choicesArraySchema = z
	.array(choiceInputSchema)
	.min(2, "At least 2 choices are required")
	.max(6, "At most 6 choices are allowed")
	.refine((choices) => choices.filter((choice) => choice.isCorrect).length === 1, {
		message: "Exactly one choice must be marked as correct",
	});

const mcqFieldsSchema = z.object({
	name: z.string().trim().min(1, "Name is required").max(200),
	question: z.string().trim().min(1, "Question is required").max(5000),
	choices: choicesArraySchema,
});

export const createMcqSchema = mcqFieldsSchema.extend({
	createdByUserId: z.string().min(1, "Created by user id is required"),
});

export const updateMcqSchema = mcqFieldsSchema;

export const attemptSchema = z.object({
	choiceId: z.string().min(1, "Choice id is required"),
});

export type CreateMcqInput = z.infer<typeof createMcqSchema>;
export type UpdateMcqInput = z.infer<typeof updateMcqSchema>;
export type AttemptInput = z.infer<typeof attemptSchema>;
export type ChoiceInput = z.infer<typeof choiceInputSchema>;

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { McqWithChoices } from "@/lib/services/mcq-service";

const mockMcqService = {
	listMcqs: vi.fn(),
	getMcqById: vi.fn(),
	createMcq: vi.fn(),
	updateMcq: vi.fn(),
	deleteMcq: vi.fn(),
	createAttempt: vi.fn(),
};

vi.mock("@opennextjs/cloudflare", () => ({
	getCloudflareContext: vi.fn(async () => ({
		env: { DB: {} as D1Database },
	})),
}));

vi.mock("@/lib/services/mcq-service", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@/lib/services/mcq-service")>();
	return {
		...actual,
		createMcqService: vi.fn(() => mockMcqService),
	};
});

import { GET, POST } from "./route";

const validCreateBody = {
	name: "Photosynthesis basics",
	description: "Grade 8 science",
	question: "Which organelle performs photosynthesis?",
	createdByUserId: "user-1",
	choices: [
		{ choiceText: "Mitochondria", isCorrect: false },
		{ choiceText: "Chloroplast", isCorrect: true },
	],
};

const sampleMcq: McqWithChoices = {
	id: "mcq-1",
	name: "Photosynthesis basics",
	description: "Grade 8 science",
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

function createPostRequest(body: unknown) {
	return new Request("http://localhost/api/mcqs", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(body),
	});
}

describe("GET /api/mcqs", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("returns 200 with an mcqs array", async () => {
		mockMcqService.listMcqs.mockResolvedValue([sampleMcq]);

		const response = await GET();
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(body).toEqual({ mcqs: [sampleMcq] });
	});
});

describe("POST /api/mcqs", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("returns 201 with the created mcq", async () => {
		mockMcqService.createMcq.mockResolvedValue(sampleMcq);

		const response = await POST(createPostRequest(validCreateBody));
		const body = await response.json();

		expect(response.status).toBe(201);
		expect(body).toEqual({ mcq: sampleMcq });
		expect(mockMcqService.createMcq).toHaveBeenCalledWith(validCreateBody);
	});

	it("returns 400 when the request body fails validation", async () => {
		const response = await POST(
			createPostRequest({ ...validCreateBody, name: "" }),
		);
		const body = await response.json();

		expect(response.status).toBe(400);
		expect(body.error).toBe("Validation failed");
		expect(body.details).toBeInstanceOf(Array);
		expect(mockMcqService.createMcq).not.toHaveBeenCalled();
	});
});

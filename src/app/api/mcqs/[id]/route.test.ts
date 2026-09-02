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

import { McqNotFoundError } from "@/lib/services/mcq-service";
import { DELETE, GET, PUT } from "./route";

const sampleMcq: McqWithChoices = {
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

const validUpdateBody = {
	name: "Updated title",
	question: "Which organelle performs photosynthesis?",
	choices: [
		{ choiceText: "Mitochondria", isCorrect: false },
		{ choiceText: "Chloroplast", isCorrect: true },
	],
};

function routeContext(id: string) {
	return { params: Promise.resolve({ id }) };
}

function createPutRequest(body: unknown) {
	return new Request("http://localhost/api/mcqs/mcq-1", {
		method: "PUT",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(body),
	});
}

describe("GET /api/mcqs/[id]", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("returns 200 when the mcq exists", async () => {
		mockMcqService.getMcqById.mockResolvedValue(sampleMcq);

		const response = await GET(new Request("http://localhost/api/mcqs/mcq-1"), routeContext("mcq-1"));
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(body).toEqual({ mcq: sampleMcq });
	});

	it("returns 404 when the mcq does not exist", async () => {
		mockMcqService.getMcqById.mockResolvedValue(null);

		const response = await GET(new Request("http://localhost/api/mcqs/missing"), routeContext("missing"));
		const body = await response.json();

		expect(response.status).toBe(404);
		expect(body.error).toBe("MCQ not found");
	});
});

describe("PUT /api/mcqs/[id]", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("returns 200 with the updated mcq", async () => {
		mockMcqService.updateMcq.mockResolvedValue({ ...sampleMcq, name: "Updated title" });

		const response = await PUT(createPutRequest(validUpdateBody), routeContext("mcq-1"));
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(body.mcq.name).toBe("Updated title");
		expect(mockMcqService.updateMcq).toHaveBeenCalledWith("mcq-1", validUpdateBody);
	});

	it("returns 404 when the mcq does not exist", async () => {
		mockMcqService.updateMcq.mockRejectedValue(new McqNotFoundError());

		const response = await PUT(createPutRequest(validUpdateBody), routeContext("missing"));
		const body = await response.json();

		expect(response.status).toBe(404);
		expect(body.error).toBe("MCQ not found");
	});

	it("returns 400 when the request body fails validation", async () => {
		const response = await PUT(
			createPutRequest({ ...validUpdateBody, question: "" }),
			routeContext("mcq-1"),
		);
		const body = await response.json();

		expect(response.status).toBe(400);
		expect(body.error).toBe("Validation failed");
		expect(mockMcqService.updateMcq).not.toHaveBeenCalled();
	});
});

describe("DELETE /api/mcqs/[id]", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("returns 200 when the mcq is deleted", async () => {
		mockMcqService.getMcqById.mockResolvedValue(sampleMcq);
		mockMcqService.deleteMcq.mockResolvedValue(undefined);

		const response = await DELETE(
			new Request("http://localhost/api/mcqs/mcq-1", { method: "DELETE" }),
			routeContext("mcq-1"),
		);
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(body).toEqual({ success: true });
		expect(mockMcqService.deleteMcq).toHaveBeenCalledWith("mcq-1");
	});

	it("returns 404 when the mcq does not exist", async () => {
		mockMcqService.getMcqById.mockResolvedValue(null);

		const response = await DELETE(
			new Request("http://localhost/api/mcqs/missing", { method: "DELETE" }),
			routeContext("missing"),
		);
		const body = await response.json();

		expect(response.status).toBe(404);
		expect(body.error).toBe("MCQ not found");
		expect(mockMcqService.deleteMcq).not.toHaveBeenCalled();
	});
});

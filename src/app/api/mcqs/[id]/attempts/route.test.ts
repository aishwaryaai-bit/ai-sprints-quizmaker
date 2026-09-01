import { beforeEach, describe, expect, it, vi } from "vitest";
import type { McqAttempt } from "@/lib/services/mcq-service";

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

import { ChoiceNotFoundError } from "@/lib/services/mcq-service";
import { POST } from "./route";

const sampleAttempt: McqAttempt = {
	id: "attempt-1",
	mcqId: "mcq-1",
	choiceId: "choice-2",
	isCorrect: true,
	createdAt: "2026-01-02 00:00:00",
};

function routeContext(id: string) {
	return { params: Promise.resolve({ id }) };
}

function createPostRequest(body: unknown) {
	return new Request("http://localhost/api/mcqs/mcq-1/attempts", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(body),
	});
}

describe("POST /api/mcqs/[id]/attempts", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("returns 201 with the recorded attempt", async () => {
		mockMcqService.createAttempt.mockResolvedValue(sampleAttempt);

		const response = await POST(
			createPostRequest({ choiceId: "choice-2" }),
			routeContext("mcq-1"),
		);
		const body = await response.json();

		expect(response.status).toBe(201);
		expect(body).toEqual({ attempt: sampleAttempt });
		expect(mockMcqService.createAttempt).toHaveBeenCalledWith("mcq-1", "choice-2");
	});

	it("returns 400 when choiceId is missing", async () => {
		const response = await POST(createPostRequest({}), routeContext("mcq-1"));
		const body = await response.json();

		expect(response.status).toBe(400);
		expect(body.error).toBe("Validation failed");
		expect(mockMcqService.createAttempt).not.toHaveBeenCalled();
	});

	it("returns 404 when the choice is not found", async () => {
		mockMcqService.createAttempt.mockRejectedValue(new ChoiceNotFoundError());

		const response = await POST(
			createPostRequest({ choiceId: "missing" }),
			routeContext("mcq-1"),
		);
		const body = await response.json();

		expect(response.status).toBe(404);
		expect(body.error).toBe("Choice not found");
	});
});

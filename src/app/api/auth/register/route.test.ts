import { beforeEach, describe, expect, it, vi } from "vitest";
import type { User } from "@/lib/services/user-service";

const mockUserService = {
	createUser: vi.fn(),
	findByUsernameOrEmail: vi.fn(),
	verifyPassword: vi.fn(),
};

vi.mock("@opennextjs/cloudflare", () => ({
	getCloudflareContext: vi.fn(async () => ({
		env: { DB: {} as D1Database },
	})),
}));

vi.mock("@/lib/services/user-service", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@/lib/services/user-service")>();
	return {
		...actual,
		createUserService: vi.fn(() => mockUserService),
	};
});

import { DuplicateUserError } from "@/lib/services/user-service";
import { POST } from "./route";

const validBody = {
	firstName: "Jane",
	lastName: "Smith",
	username: "jsmith",
	email: "jsmith@school.edu",
	passwordHash: "a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3",
};

const sampleUser: User = {
	id: "user-1",
	firstName: "Jane",
	lastName: "Smith",
	username: "jsmith",
	email: "jsmith@school.edu",
	createdAt: "2026-01-01 00:00:00",
	updatedAt: "2026-01-01 00:00:00",
};

function createRegisterRequest(body: unknown) {
	return new Request("http://localhost/api/auth/register", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(body),
	});
}

describe("POST /api/auth/register", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("returns 201 with the created user and no password fields", async () => {
		mockUserService.createUser.mockResolvedValue(sampleUser);

		const response = await POST(createRegisterRequest(validBody));
		const body = await response.json();

		expect(response.status).toBe(201);
		expect(body).toEqual({ success: true, user: sampleUser });
		expect(body.user).not.toHaveProperty("passwordHash");
		expect(body.user).not.toHaveProperty("password_hash");
	});

	it("returns 400 when the request body fails validation", async () => {
		const response = await POST(createRegisterRequest({ ...validBody, email: "not-an-email" }));
		const body = await response.json();

		expect(response.status).toBe(400);
		expect(body.error).toBe("Validation failed");
		expect(body.details).toBeInstanceOf(Array);
		expect(mockUserService.createUser).not.toHaveBeenCalled();
	});

	it("returns 409 when the username or email already exists", async () => {
		mockUserService.createUser.mockRejectedValue(new DuplicateUserError());

		const response = await POST(createRegisterRequest(validBody));
		const body = await response.json();

		expect(response.status).toBe(409);
		expect(body.error).toBe("Username or email already exists");
	});

	it("returns 500 when the user service throws an unexpected error", async () => {
		mockUserService.createUser.mockRejectedValue(new Error("Database unavailable"));

		const response = await POST(createRegisterRequest(validBody));
		const body = await response.json();

		expect(response.status).toBe(500);
		expect(body.error).toBe("Internal server error");
	});
});

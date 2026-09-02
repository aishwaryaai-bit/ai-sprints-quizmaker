import { beforeEach, describe, expect, it, vi } from "vitest";
import type { User, UserRecord } from "@/lib/services/user-service";

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

import { POST } from "./route";

const validBody = {
	usernameOrEmail: "jsmith",
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

const sampleUserRecord: UserRecord = {
	...sampleUser,
	passwordHash: "$2a$10$hashedvalue",
};

function createLoginRequest(body: unknown) {
	return new Request("http://localhost/api/auth/login", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(body),
	});
}

describe("POST /api/auth/login", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("returns 200 with the authenticated user", async () => {
		mockUserService.findByUsernameOrEmail.mockResolvedValue(sampleUserRecord);
		mockUserService.verifyPassword.mockResolvedValue(true);

		const response = await POST(createLoginRequest(validBody));
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(body).toEqual({ success: true, user: sampleUser });
	});

	it("returns 400 when the request body fails validation", async () => {
		const response = await POST(createLoginRequest({ usernameOrEmail: "jsmith" }));
		const body = await response.json();

		expect(response.status).toBe(400);
		expect(body.error).toBe("Validation failed");
		expect(body.details).toBeInstanceOf(Array);
	});

	it("returns 401 when the user is not found", async () => {
		mockUserService.findByUsernameOrEmail.mockResolvedValue(null);

		const response = await POST(createLoginRequest(validBody));
		const body = await response.json();

		expect(response.status).toBe(401);
		expect(body.error).toBe("Invalid username or password");
	});

	it("returns 401 when the password does not match", async () => {
		mockUserService.findByUsernameOrEmail.mockResolvedValue(sampleUserRecord);
		mockUserService.verifyPassword.mockResolvedValue(false);

		const response = await POST(createLoginRequest(validBody));
		const body = await response.json();

		expect(response.status).toBe(401);
		expect(body.error).toBe("Invalid username or password");
	});

	it("never returns password fields in the user object", async () => {
		mockUserService.findByUsernameOrEmail.mockResolvedValue(sampleUserRecord);
		mockUserService.verifyPassword.mockResolvedValue(true);

		const response = await POST(createLoginRequest(validBody));
		const body = await response.json();

		expect(body.user).not.toHaveProperty("passwordHash");
		expect(body.user).not.toHaveProperty("password_hash");
	});
});

import { beforeEach, describe, expect, it, vi } from "vitest";
import { hashPasswordServer } from "@/lib/password-server";
import { createUserService, DuplicateUserError } from "./user-service";

const sampleRow = {
	id: "user-1",
	first_name: "Jane",
	last_name: "Smith",
	username: "jsmith",
	email: "jsmith@school.edu",
	password_hash: "$2a$10$hashedvalue",
	created_at: "2026-01-01 00:00:00",
	updated_at: "2026-01-01 00:00:00",
};

const sampleRecord = {
	id: "user-1",
	firstName: "Jane",
	lastName: "Smith",
	username: "jsmith",
	email: "jsmith@school.edu",
	passwordHash: "$2a$10$hashedvalue",
	createdAt: "2026-01-01 00:00:00",
	updatedAt: "2026-01-01 00:00:00",
};

function createMockDb() {
	const run = vi.fn();
	const all = vi.fn();
	const bind = vi.fn(() => ({ run, all }));
	const prepare = vi.fn(() => ({ bind }));
	const db = { prepare } as unknown as D1Database;
	return { db, prepare, bind, run, all };
}

describe("createUserService", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("createUser inserts a row and returns a user without password_hash", async () => {
		const { db, all } = createMockDb();
		all.mockResolvedValue({ results: [sampleRow] });

		const service = createUserService(db);
		const user = await service.createUser({
			firstName: "Jane",
			lastName: "Smith",
			username: "jsmith",
			email: "jsmith@school.edu",
			passwordHash: "a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3",
		});

		expect(user).toEqual({
			id: "user-1",
			firstName: "Jane",
			lastName: "Smith",
			username: "jsmith",
			email: "jsmith@school.edu",
			createdAt: "2026-01-01 00:00:00",
			updatedAt: "2026-01-01 00:00:00",
		});
		expect(user).not.toHaveProperty("password_hash");
		expect(user).not.toHaveProperty("passwordHash");
	});

	it("createUser bcrypt-hashes the client digest before insert", async () => {
		const { db, bind, all } = createMockDb();
		const clientDigest = "a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3";
		all.mockResolvedValue({ results: [sampleRow] });

		const service = createUserService(db);
		await service.createUser({
			firstName: "Jane",
			lastName: "Smith",
			username: "jsmith",
			email: "jsmith@school.edu",
			passwordHash: clientDigest,
		});

		const boundParams = bind.mock.calls.at(-1) as unknown[];
		const passwordParam = boundParams[4] as string;
		expect(passwordParam).not.toBe(clientDigest);
		expect(passwordParam.startsWith("$2")).toBe(true);
	});

	it("findByUsername returns the matching row or null", async () => {
		const { db, all } = createMockDb();
		all.mockResolvedValueOnce({ results: [sampleRow] }).mockResolvedValueOnce({ results: [] });

		const service = createUserService(db);
		await expect(service.findByUsername("jsmith")).resolves.toEqual(sampleRecord);
		await expect(service.findByUsername("missing")).resolves.toBeNull();
	});

	it("findByEmail returns the matching row or null", async () => {
		const { db, all } = createMockDb();
		all.mockResolvedValueOnce({ results: [sampleRow] }).mockResolvedValueOnce({ results: [] });

		const service = createUserService(db);
		await expect(service.findByEmail("jsmith@school.edu")).resolves.toEqual(sampleRecord);
		await expect(service.findByEmail("missing@school.edu")).resolves.toBeNull();
	});

	it("findByUsernameOrEmail tries username first, then email", async () => {
		const { db, prepare, all } = createMockDb();
		all
			.mockResolvedValueOnce({ results: [] })
			.mockResolvedValueOnce({ results: [sampleRow] });

		const service = createUserService(db);
		const result = await service.findByUsernameOrEmail("jsmith@school.edu");

		expect(prepare).toHaveBeenCalledTimes(2);
		expect(prepare.mock.calls[0]?.[0]).toMatch(/username/i);
		expect(prepare.mock.calls[1]?.[0]).toMatch(/email/i);
		expect(result).toEqual(sampleRecord);
	});

	it("updateUser updates allowed fields and re-hashes when password is provided", async () => {
		const { db, bind, all } = createMockDb();
		const updatedRow = { ...sampleRow, first_name: "Janet" };
		all.mockResolvedValue({ results: [updatedRow] });

		const service = createUserService(db);
		const user = await service.updateUser("user-1", {
			firstName: "Janet",
			passwordHash: "a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3",
		});

		expect(user.firstName).toBe("Janet");
		const boundParams = bind.mock.calls.at(-1) as unknown[];
		const passwordParam = boundParams[1] as string;
		expect(passwordParam.startsWith("$2")).toBe(true);
	});

	it("deleteUser removes the row", async () => {
		const { db, bind, run } = createMockDb();
		run.mockResolvedValue({ success: true });

		const service = createUserService(db);
		await service.deleteUser("user-1");

		expect(bind).toHaveBeenCalledWith("user-1");
		expect(run).toHaveBeenCalled();
	});

	it("verifyPassword delegates to password-server compare", async () => {
		const { db } = createMockDb();
		const service = createUserService(db);
		const clientDigest = "a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3";
		const stored = await hashPasswordServer(clientDigest);

		await expect(service.verifyPassword(stored, clientDigest)).resolves.toBe(true);
		await expect(service.verifyPassword(stored, "wrongdigest")).resolves.toBe(false);
	});

	it("createUser surfaces duplicate username or email errors", async () => {
		const { db, all } = createMockDb();
		all.mockRejectedValue(new Error("UNIQUE constraint failed: users.username"));

		const service = createUserService(db);
		await expect(
			service.createUser({
				firstName: "Jane",
				lastName: "Smith",
				username: "jsmith",
				email: "jsmith@school.edu",
				passwordHash: "a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3",
			}),
		).rejects.toBeInstanceOf(DuplicateUserError);
	});
});

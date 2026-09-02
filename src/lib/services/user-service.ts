import { hashPasswordServer, verifyPasswordServer } from "@/lib/password-server";

export class DuplicateUserError extends Error {
	constructor(message = "Username or email already exists") {
		super(message);
		this.name = "DuplicateUserError";
	}
}

export type User = {
	id: string;
	firstName: string;
	lastName: string;
	username: string;
	email: string;
	createdAt: string;
	updatedAt: string;
};

export type UserRecord = User & {
	passwordHash: string;
};

type UserRow = {
	id: string;
	first_name: string;
	last_name: string;
	username: string;
	email: string;
	password_hash: string;
	created_at: string;
	updated_at: string;
};

export type CreateUserInput = {
	firstName: string;
	lastName: string;
	username: string;
	email: string;
	passwordHash: string;
};

export type UpdateUserInput = {
	firstName?: string;
	lastName?: string;
	username?: string;
	email?: string;
	passwordHash?: string;
};

const USER_SELECT =
	"SELECT id, first_name, last_name, username, email, password_hash, created_at, updated_at FROM users";

function isUniqueConstraintError(error: unknown): boolean {
	return error instanceof Error && error.message.includes("UNIQUE constraint failed");
}

function toUserRecord(row: UserRow): UserRecord {
	return {
		id: row.id,
		firstName: row.first_name,
		lastName: row.last_name,
		username: row.username,
		email: row.email,
		passwordHash: row.password_hash,
		createdAt: row.created_at,
		updatedAt: row.updated_at,
	};
}

function toUser(row: UserRow): User {
	const { passwordHash: _unused, ...user } = toUserRecord(row);
	void _unused;
	return user;
}

function getFirstRow<T>(results: T[] | undefined): T | null {
	return results?.[0] ?? null;
}

export function createUserService(db: D1Database) {
	return {
		async createUser(input: CreateUserInput): Promise<User> {
			const passwordHash = await hashPasswordServer(input.passwordHash);

			try {
				const result = await db
					.prepare(
						`INSERT INTO users (first_name, last_name, username, email, password_hash)
             VALUES (?1, ?2, ?3, ?4, ?5)
             RETURNING id, first_name, last_name, username, email, password_hash, created_at, updated_at`,
					)
					.bind(
						input.firstName,
						input.lastName,
						input.username,
						input.email,
						passwordHash,
					)
					.all<UserRow>();

				const row = getFirstRow(result.results);
				if (!row) {
					throw new Error("Failed to create user");
				}

				return toUser(row);
			} catch (error) {
				if (isUniqueConstraintError(error)) {
					throw new DuplicateUserError();
				}
				throw error;
			}
		},

		async findById(id: string): Promise<UserRecord | null> {
			const result = await db
				.prepare(`${USER_SELECT} WHERE id = ?1`)
				.bind(id)
				.all<UserRow>();

			const row = getFirstRow(result.results);
			return row ? toUserRecord(row) : null;
		},

		async findByUsername(username: string): Promise<UserRecord | null> {
			const result = await db
				.prepare(`${USER_SELECT} WHERE username = ?1`)
				.bind(username)
				.all<UserRow>();

			const row = getFirstRow(result.results);
			return row ? toUserRecord(row) : null;
		},

		async findByEmail(email: string): Promise<UserRecord | null> {
			const result = await db
				.prepare(`${USER_SELECT} WHERE email = ?1`)
				.bind(email)
				.all<UserRow>();

			const row = getFirstRow(result.results);
			return row ? toUserRecord(row) : null;
		},

		async findByUsernameOrEmail(value: string): Promise<UserRecord | null> {
			const byUsername = await this.findByUsername(value);
			if (byUsername) {
				return byUsername;
			}

			return this.findByEmail(value);
		},

		async updateUser(id: string, input: UpdateUserInput): Promise<User> {
			const assignments: string[] = [];
			const values: unknown[] = [];

			if (input.firstName !== undefined) {
				assignments.push("first_name = ?" + (values.length + 1));
				values.push(input.firstName);
			}
			if (input.lastName !== undefined) {
				assignments.push("last_name = ?" + (values.length + 1));
				values.push(input.lastName);
			}
			if (input.username !== undefined) {
				assignments.push("username = ?" + (values.length + 1));
				values.push(input.username);
			}
			if (input.email !== undefined) {
				assignments.push("email = ?" + (values.length + 1));
				values.push(input.email);
			}
			if (input.passwordHash !== undefined) {
				assignments.push("password_hash = ?" + (values.length + 1));
				values.push(await hashPasswordServer(input.passwordHash));
			}

			assignments.push("updated_at = CURRENT_TIMESTAMP");

			if (values.length === 0) {
				const existing = await this.findById(id);
				if (!existing) {
					throw new Error("User not found");
				}
				const { passwordHash: _unused, ...user } = existing;
				void _unused;
				return user;
			}

			values.push(id);

			try {
				const result = await db
					.prepare(
						`UPDATE users SET ${assignments.join(", ")}
             WHERE id = ?${values.length}
             RETURNING id, first_name, last_name, username, email, password_hash, created_at, updated_at`,
					)
					.bind(...values)
					.all<UserRow>();

				const row = getFirstRow(result.results);
				if (!row) {
					throw new Error("User not found");
				}

				return toUser(row);
			} catch (error) {
				if (isUniqueConstraintError(error)) {
					throw new DuplicateUserError();
				}
				throw error;
			}
		},

		async deleteUser(id: string): Promise<void> {
			await db.prepare("DELETE FROM users WHERE id = ?1").bind(id).run();
		},

		async verifyPassword(storedHash: string, clientDigest: string): Promise<boolean> {
			return verifyPasswordServer(storedHash, clientDigest);
		},
	};
}

export type UserService = ReturnType<typeof createUserService>;

import { describe, expect, it } from "vitest";
import { loginSchema, registerSchema } from "./auth";

const validRegister = {
	firstName: "Jane",
	lastName: "Smith",
	username: "jsmith",
	email: "jsmith@school.edu",
	passwordHash: "a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3",
};

const validLogin = {
	usernameOrEmail: "jsmith",
	passwordHash: "a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3",
};

describe("registerSchema", () => {
	it("accepts a valid registration payload", () => {
		expect(registerSchema.safeParse(validRegister).success).toBe(true);
	});

	it("rejects missing required fields", () => {
		expect(
			registerSchema.safeParse({
				lastName: validRegister.lastName,
				username: validRegister.username,
				email: validRegister.email,
				passwordHash: validRegister.passwordHash,
			}).success,
		).toBe(false);
	});

	it("rejects an invalid email", () => {
		expect(
			registerSchema.safeParse({ ...validRegister, email: "not-an-email" }).success,
		).toBe(false);
	});

	it("rejects empty strings", () => {
		expect(
			registerSchema.safeParse({ ...validRegister, firstName: "" }).success,
		).toBe(false);
	});
});

describe("loginSchema", () => {
	it("accepts a valid login payload", () => {
		expect(loginSchema.safeParse(validLogin).success).toBe(true);
	});

	it("rejects missing usernameOrEmail", () => {
		expect(
			loginSchema.safeParse({ passwordHash: validLogin.passwordHash }).success,
		).toBe(false);
	});

	it("rejects missing passwordHash", () => {
		expect(
			loginSchema.safeParse({ usernameOrEmail: validLogin.usernameOrEmail }).success,
		).toBe(false);
	});
});

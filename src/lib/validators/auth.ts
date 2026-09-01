import { z } from "zod";

const passwordHashSchema = z
	.string()
	.min(1, "Password hash is required")
	.regex(/^[0-9a-f]{64}$/, "Password hash must be a 64-character hex string");

export const registerSchema = z.object({
	firstName: z.string().min(1, "First name is required"),
	lastName: z.string().min(1, "Last name is required"),
	username: z.string().min(1, "Username is required"),
	email: z.string().email("Invalid email address"),
	passwordHash: passwordHashSchema,
});

export const loginSchema = z.object({
	usernameOrEmail: z.string().min(1, "Username or email is required"),
	passwordHash: passwordHashSchema,
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;

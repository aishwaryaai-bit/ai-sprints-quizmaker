import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockPush = vi.fn();

vi.mock("next/navigation", () => ({
	useRouter: () => ({ push: mockPush }),
}));

vi.mock("@/lib/password-client", () => ({
	hashPasswordClient: vi.fn(async (plaintext: string) =>
		"a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3".slice(
			0,
			plaintext === "password123" ? 64 : 64,
		),
	),
}));

import { hashPasswordClient } from "@/lib/password-client";
import { SignupForm } from "./signup-form";

describe("SignupForm", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		global.fetch = vi.fn();
	});

	it("renders all required fields", () => {
		render(<SignupForm />);

		expect(screen.getByLabelText(/first name/i)).toBeInTheDocument();
		expect(screen.getByLabelText(/last name/i)).toBeInTheDocument();
		expect(screen.getByLabelText(/username/i)).toBeInTheDocument();
		expect(screen.getByLabelText(/^email$/i)).toBeInTheDocument();
		expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument();
		expect(screen.getByLabelText(/confirm password/i)).toBeInTheDocument();
	});

	it("shows a client validation error when passwords do not match", async () => {
		const user = userEvent.setup();
		render(<SignupForm />);

		await user.type(screen.getByLabelText(/first name/i), "Jane");
		await user.type(screen.getByLabelText(/last name/i), "Smith");
		await user.type(screen.getByLabelText(/username/i), "jsmith");
		await user.type(screen.getByLabelText(/^email$/i), "jsmith@school.edu");
		await user.type(screen.getByLabelText(/^password$/i), "password123");
		await user.type(screen.getByLabelText(/confirm password/i), "different123");
		await user.click(screen.getByRole("button", { name: /create account/i }));

		expect(await screen.findByRole("alert")).toHaveTextContent(/passwords do not match/i);
		expect(global.fetch).not.toHaveBeenCalled();
	});

	it("hashes the password and posts to the register API", async () => {
		const user = userEvent.setup();
		vi.mocked(global.fetch).mockResolvedValue(
			new Response(JSON.stringify({ success: true, user: { id: "1" } }), {
				status: 201,
			}),
		);

		render(<SignupForm />);

		await user.type(screen.getByLabelText(/first name/i), "Jane");
		await user.type(screen.getByLabelText(/last name/i), "Smith");
		await user.type(screen.getByLabelText(/username/i), "jsmith");
		await user.type(screen.getByLabelText(/^email$/i), "jsmith@school.edu");
		await user.type(screen.getByLabelText(/^password$/i), "password123");
		await user.type(screen.getByLabelText(/confirm password/i), "password123");
		await user.click(screen.getByRole("button", { name: /create account/i }));

		await waitFor(() => {
			expect(hashPasswordClient).toHaveBeenCalledWith("password123");
		});

		expect(global.fetch).toHaveBeenCalledWith("/api/auth/register", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: expect.any(String),
		});

		const body = JSON.parse(vi.mocked(global.fetch).mock.calls[0]?.[1]?.body as string);
		expect(body.passwordHash).toBeTruthy();
		expect(body).not.toHaveProperty("password");
		expect(body.firstName).toBe("Jane");
	});

	it("redirects to /mcq after a successful registration", async () => {
		const user = userEvent.setup();
		vi.mocked(global.fetch).mockResolvedValue(
			new Response(JSON.stringify({ success: true, user: { id: "1" } }), {
				status: 201,
			}),
		);

		render(<SignupForm />);

		await user.type(screen.getByLabelText(/first name/i), "Jane");
		await user.type(screen.getByLabelText(/last name/i), "Smith");
		await user.type(screen.getByLabelText(/username/i), "jsmith");
		await user.type(screen.getByLabelText(/^email$/i), "jsmith@school.edu");
		await user.type(screen.getByLabelText(/^password$/i), "password123");
		await user.type(screen.getByLabelText(/confirm password/i), "password123");
		await user.click(screen.getByRole("button", { name: /create account/i }));

		await waitFor(() => {
			expect(mockPush).toHaveBeenCalledWith("/mcq");
		});
	});

	it("surfaces API error messages in the UI", async () => {
		const user = userEvent.setup();
		vi.mocked(global.fetch).mockResolvedValue(
			new Response(JSON.stringify({ error: "Username or email already exists" }), {
				status: 409,
			}),
		);

		render(<SignupForm />);

		await user.type(screen.getByLabelText(/first name/i), "Jane");
		await user.type(screen.getByLabelText(/last name/i), "Smith");
		await user.type(screen.getByLabelText(/username/i), "jsmith");
		await user.type(screen.getByLabelText(/^email$/i), "jsmith@school.edu");
		await user.type(screen.getByLabelText(/^password$/i), "password123");
		await user.type(screen.getByLabelText(/confirm password/i), "password123");
		await user.click(screen.getByRole("button", { name: /create account/i }));

		expect(await screen.findByRole("alert")).toHaveTextContent(
			/Username or email already exists/i,
		);
	});
});

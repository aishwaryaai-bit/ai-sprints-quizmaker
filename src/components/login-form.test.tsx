import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockPush = vi.fn();

vi.mock("next/navigation", () => ({
	useRouter: () => ({ push: mockPush }),
}));

vi.mock("@/lib/password-client", () => ({
	hashPasswordClient: vi.fn(async () =>
		"a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3",
	),
}));

import { hashPasswordClient } from "@/lib/password-client";
import { LoginForm } from "./login-form";

describe("LoginForm", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		global.fetch = vi.fn();
	});

	it("renders username or email and password fields", () => {
		render(<LoginForm />);

		expect(screen.getByLabelText(/username or email/i)).toBeInTheDocument();
		expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument();
	});

	it("hashes the password and posts to the login API", async () => {
		const user = userEvent.setup();
		vi.mocked(global.fetch).mockResolvedValue(
			new Response(JSON.stringify({ success: true, user: { id: "1" } }), {
				status: 200,
			}),
		);

		render(<LoginForm />);

		await user.type(screen.getByLabelText(/username or email/i), "jsmith");
		await user.type(screen.getByLabelText(/^password$/i), "password123");
		await user.click(screen.getByRole("button", { name: /^login$/i }));

		await waitFor(() => {
			expect(hashPasswordClient).toHaveBeenCalledWith("password123");
		});

		expect(global.fetch).toHaveBeenCalledWith("/api/auth/login", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: expect.any(String),
		});

		const body = JSON.parse(vi.mocked(global.fetch).mock.calls[0]?.[1]?.body as string);
		expect(body.passwordHash).toBeTruthy();
		expect(body).not.toHaveProperty("password");
		expect(body.usernameOrEmail).toBe("jsmith");
	});

	it("redirects to /mcq after a successful login", async () => {
		const user = userEvent.setup();
		vi.mocked(global.fetch).mockResolvedValue(
			new Response(JSON.stringify({ success: true, user: { id: "1" } }), {
				status: 200,
			}),
		);

		render(<LoginForm />);

		await user.type(screen.getByLabelText(/username or email/i), "jsmith");
		await user.type(screen.getByLabelText(/^password$/i), "password123");
		await user.click(screen.getByRole("button", { name: /^login$/i }));

		await waitFor(() => {
			expect(mockPush).toHaveBeenCalledWith("/mcq");
		});
	});

	it("shows a generic invalid-credentials message on 401", async () => {
		const user = userEvent.setup();
		vi.mocked(global.fetch).mockResolvedValue(
			new Response(JSON.stringify({ error: "Invalid username or password" }), {
				status: 401,
			}),
		);

		render(<LoginForm />);

		await user.type(screen.getByLabelText(/username or email/i), "jsmith");
		await user.type(screen.getByLabelText(/^password$/i), "wrongpassword");
		await user.click(screen.getByRole("button", { name: /^login$/i }));

		expect(await screen.findByRole("alert")).toHaveTextContent(
			/Invalid username or password/i,
		);
	});
});

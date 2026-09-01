import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockPush = vi.fn();

vi.mock("next/navigation", () => ({
	useRouter: () => ({ push: mockPush }),
}));

import { LogoutButton } from "./logout-button";

describe("LogoutButton", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		global.fetch = vi.fn();
	});

	it("posts to the logout API and navigates to /login", async () => {
		const user = userEvent.setup();
		vi.mocked(global.fetch).mockResolvedValue(
			new Response(JSON.stringify({ success: true }), { status: 200 }),
		);

		render(<LogoutButton />);
		await user.click(screen.getByRole("button", { name: /log out/i }));

		await waitFor(() => {
			expect(global.fetch).toHaveBeenCalledWith("/api/auth/logout", { method: "POST" });
		});
		expect(mockPush).toHaveBeenCalledWith("/login");
	});
});

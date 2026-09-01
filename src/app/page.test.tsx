import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Home from "@/app/page";

describe("Home page", () => {
	it("renders links to register and login", () => {
		render(<Home />);

		expect(screen.getByRole("button", { name: /register/i })).toHaveAttribute(
			"href",
			"/register",
		);
		expect(screen.getByRole("button", { name: /login/i })).toHaveAttribute("href", "/login");
	});
});

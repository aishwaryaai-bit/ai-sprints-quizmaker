import { describe, expect, it } from "vitest";
import { POST } from "./route";

describe("POST /api/auth/logout", () => {
	it("returns 200 with success true", async () => {
		const response = await POST(
			new Request("http://localhost/api/auth/logout", { method: "POST" }),
		);
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(body).toEqual({ success: true });
	});

	it("does not require a request body", async () => {
		const response = await POST(
			new Request("http://localhost/api/auth/logout", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({}),
			}),
		);

		expect(response.status).toBe(200);
	});
});

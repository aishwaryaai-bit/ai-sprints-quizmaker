import { describe, expect, it } from "vitest";
import { hashPasswordClient } from "./password-client";

describe("hashPasswordClient", () => {
	it("returns a 64-character lowercase hex string", async () => {
		const digest = await hashPasswordClient("hello");
		expect(digest).toMatch(/^[0-9a-f]{64}$/);
	});

	it("produces the same digest for the same input", async () => {
		const first = await hashPasswordClient("hello");
		const second = await hashPasswordClient("hello");
		expect(first).toBe(second);
	});

	it("produces different digests for different inputs", async () => {
		const hello = await hashPasswordClient("hello");
		const world = await hashPasswordClient("world");
		expect(hello).not.toBe(world);
	});
});

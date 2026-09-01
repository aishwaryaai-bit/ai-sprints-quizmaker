import { describe, expect, it } from "vitest";
import { hashPasswordServer, verifyPasswordServer } from "./password-server";

describe("hashPasswordServer", () => {
	it("returns a bcrypt hash string", async () => {
		const clientDigest = "a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3";
		const stored = await hashPasswordServer(clientDigest);
		expect(stored.startsWith("$2")).toBe(true);
	});

	it("does not store the raw client digest", async () => {
		const clientDigest = "a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3";
		const stored = await hashPasswordServer(clientDigest);
		expect(stored).not.toBe(clientDigest);
	});
});

describe("verifyPasswordServer", () => {
	it("returns true when the client digest matches the stored hash", async () => {
		const clientDigest = "a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3";
		const stored = await hashPasswordServer(clientDigest);
		await expect(verifyPasswordServer(stored, clientDigest)).resolves.toBe(true);
	});

	it("returns false when the client digest does not match", async () => {
		const clientDigest = "a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3";
		const stored = await hashPasswordServer(clientDigest);
		await expect(verifyPasswordServer(stored, "wrongdigest")).resolves.toBe(false);
	});
});

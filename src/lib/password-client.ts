export async function hashPasswordClient(plaintext: string): Promise<string> {
	const encoded = new TextEncoder().encode(plaintext);
	const digest = await crypto.subtle.digest("SHA-256", encoded);
	return Array.from(new Uint8Array(digest))
		.map((byte) => byte.toString(16).padStart(2, "0"))
		.join("");
}

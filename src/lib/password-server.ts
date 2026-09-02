import bcrypt from "bcryptjs";

const BCRYPT_COST = 10;

export async function hashPasswordServer(clientDigest: string): Promise<string> {
	return bcrypt.hash(clientDigest, BCRYPT_COST);
}

export async function verifyPasswordServer(
	storedHash: string,
	clientDigest: string,
): Promise<boolean> {
	return bcrypt.compare(clientDigest, storedHash);
}

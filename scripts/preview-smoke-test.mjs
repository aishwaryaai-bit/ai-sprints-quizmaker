import { createHash } from "node:crypto";

const baseUrl = process.env.PREVIEW_URL ?? "http://127.0.0.1:8787";
const password = "password123";
const passwordHash = createHash("sha256").update(password).digest("hex");

const username = `smoke${Date.now()}`;
const registerBody = {
	firstName: "Smoke",
	lastName: "Test",
	username,
	email: `${username}@school.edu`,
	passwordHash,
};

async function request(path, body) {
	const response = await fetch(`${baseUrl}${path}`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: body ? JSON.stringify(body) : undefined,
	});
	const text = await response.text();
	let json;
	try {
		json = JSON.parse(text);
	} catch {
		json = text;
	}
	return { status: response.status, body: json };
}

async function main() {
	const results = [];

	results.push({
		step: "register",
		...(await request("/api/auth/register", registerBody)),
	});
	results.push({
		step: "login",
		...(await request("/api/auth/login", {
			usernameOrEmail: username,
			passwordHash,
		})),
	});
	results.push({
		step: "logout",
		...(await request("/api/auth/logout")),
	});
	results.push({
		step: "duplicate-register",
		...(await request("/api/auth/register", registerBody)),
	});

	const pages = ["/", "/register", "/login", "/mcq"];
	for (const path of pages) {
		const response = await fetch(`${baseUrl}${path}`);
		results.push({ step: `page${path}`, status: response.status });
	}

	console.log(JSON.stringify({ username, passwordHashSent: true, results }, null, 2));

	const failed = results.filter(
		(r) =>
			(r.step === "register" && r.status !== 201) ||
			(r.step === "login" && r.status !== 200) ||
			(r.step === "logout" && r.status !== 200) ||
			(r.step === "duplicate-register" && r.status !== 409) ||
			(r.step.startsWith("page") && r.status !== 200),
	);

	if (failed.length > 0) {
		process.exitCode = 1;
	}
}

main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});

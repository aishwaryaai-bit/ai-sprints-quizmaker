import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const PROJECT_ROOT = process.cwd();
const MIGRATIONS_DIR = join(PROJECT_ROOT, "migrations");
const WRANGLER_CONFIG = join(PROJECT_ROOT, "wrangler.jsonc");

const REQUIRED_COLUMNS = [
	"id",
	"first_name",
	"last_name",
	"username",
	"email",
	"password_hash",
	"created_at",
	"updated_at",
] as const;

function readMigrationSql(): string {
	const files = readdirSync(MIGRATIONS_DIR).filter((name) => name.endsWith(".sql"));
	expect(files.length).toBeGreaterThan(0);
	return files
		.map((name) => readFileSync(join(MIGRATIONS_DIR, name), "utf8"))
		.join("\n");
}

function stripJsoncComments(text: string): string {
	return text
		.replace(/\/\*[\s\S]*?\*\//g, "")
		.replace(/^\s*\/\/.*$/gm, "");
}

describe("users schema contract", () => {
	it("has a migration that creates the users table", () => {
		const sql = readMigrationSql();
		expect(sql).toMatch(/CREATE TABLE\s+users\s/i);
	});

	it("defines all required user columns", () => {
		const sql = readMigrationSql();
		for (const column of REQUIRED_COLUMNS) {
			expect(sql).toMatch(new RegExp(`\\b${column}\\b`, "i"));
		}
	});

	it("enforces unique username and email", () => {
		const sql = readMigrationSql().replace(/\s+/g, " ");
		expect(sql).toMatch(/username\s+TEXT\s+NOT\s+NULL\s+UNIQUE/i);
		expect(sql).toMatch(/email\s+TEXT\s+NOT\s+NULL\s+UNIQUE/i);
	});

	it("configures a D1 binding named DB in wrangler.jsonc", () => {
		const raw = readFileSync(WRANGLER_CONFIG, "utf8");
		const config = JSON.parse(stripJsoncComments(raw)) as {
			d1_databases?: Array<{ binding?: string }>;
		};
		const bindings = config.d1_databases ?? [];
		expect(bindings.some((entry) => entry.binding === "DB")).toBe(true);
	});
});

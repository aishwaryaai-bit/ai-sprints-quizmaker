import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const PROJECT_ROOT = process.cwd();
const MIGRATIONS_DIR = join(PROJECT_ROOT, "migrations");

const MCQ_MIGRATION_PATTERN = /0002_.*mcq.*\.sql$/i;

const MCQS_REQUIRED_COLUMNS = [
	"id",
	"name",
	"description",
	"question",
	"created_by_user_id",
	"created_at",
	"updated_at",
] as const;

const MCQ_CHOICES_REQUIRED_COLUMNS = [
	"id",
	"mcq_id",
	"choice_text",
	"is_correct",
	"display_order",
	"created_at",
] as const;

const MCQ_ATTEMPTS_REQUIRED_COLUMNS = [
	"id",
	"mcq_id",
	"choice_id",
	"is_correct",
	"created_at",
] as const;

function readMcqMigrationSql(): string {
	const files = readdirSync(MIGRATIONS_DIR).filter((name) =>
		MCQ_MIGRATION_PATTERN.test(name),
	);
	expect(files.length).toBe(1);
	return readFileSync(join(MIGRATIONS_DIR, files[0]!), "utf8");
}

describe("mcq schema contract", () => {
	it("has a migration that creates mcqs, mcq_choices, and mcq_attempts tables", () => {
		const sql = readMcqMigrationSql();
		expect(sql).toMatch(/CREATE TABLE\s+mcqs\s/i);
		expect(sql).toMatch(/CREATE TABLE\s+mcq_choices\s/i);
		expect(sql).toMatch(/CREATE TABLE\s+mcq_attempts\s/i);
	});

	it("defines all required mcqs columns", () => {
		const sql = readMcqMigrationSql();
		for (const column of MCQS_REQUIRED_COLUMNS) {
			expect(sql).toMatch(new RegExp(`\\b${column}\\b`, "i"));
		}
	});

	it("defines all required mcq_choices columns", () => {
		const sql = readMcqMigrationSql();
		for (const column of MCQ_CHOICES_REQUIRED_COLUMNS) {
			expect(sql).toMatch(new RegExp(`\\b${column}\\b`, "i"));
		}
	});

	it("defines all required mcq_attempts columns", () => {
		const sql = readMcqMigrationSql();
		for (const column of MCQ_ATTEMPTS_REQUIRED_COLUMNS) {
			expect(sql).toMatch(new RegExp(`\\b${column}\\b`, "i"));
		}
	});

	it("mcq_choices references mcqs with ON DELETE CASCADE", () => {
		const sql = readMcqMigrationSql().replace(/\s+/g, " ");
		expect(sql).toMatch(
			/mcq_choices[\s\S]*FOREIGN KEY\s*\(\s*mcq_id\s*\)\s*REFERENCES\s+mcqs\s*\(\s*id\s*\)\s*ON DELETE CASCADE/i,
		);
	});

	it("mcq_attempts references mcqs and mcq_choices", () => {
		const sql = readMcqMigrationSql().replace(/\s+/g, " ");
		expect(sql).toMatch(
			/mcq_attempts[\s\S]*FOREIGN KEY\s*\(\s*mcq_id\s*\)\s*REFERENCES\s+mcqs\s*\(\s*id\s*\)/i,
		);
		expect(sql).toMatch(
			/mcq_attempts[\s\S]*FOREIGN KEY\s*\(\s*choice_id\s*\)\s*REFERENCES\s+mcq_choices\s*\(\s*id\s*\)/i,
		);
	});

	it("mcqs references users for created_by_user_id", () => {
		const sql = readMcqMigrationSql().replace(/\s+/g, " ");
		expect(sql).toMatch(
			/mcqs[\s\S]*FOREIGN KEY\s*\(\s*created_by_user_id\s*\)\s*REFERENCES\s+users\s*\(\s*id\s*\)/i,
		);
	});

	it("creates indexes on foreign-key columns", () => {
		const sql = readMcqMigrationSql();
		expect(sql).toMatch(/CREATE INDEX\s+idx_mcqs_created_by\s+ON\s+mcqs/i);
		expect(sql).toMatch(/CREATE INDEX\s+idx_mcq_choices_mcq_id\s+ON\s+mcq_choices/i);
		expect(sql).toMatch(/CREATE INDEX\s+idx_mcq_attempts_mcq_id\s+ON\s+mcq_attempts/i);
	});
});

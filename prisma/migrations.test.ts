// Replays every migration on an in-process Postgres (PGlite) to make sure they
// apply cleanly — and that data-transforming ones preserve existing data.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { describe, expect, it } from "vitest";

const MIGRATIONS_DIR = join(import.meta.dirname, "migrations");
const migrations = readdirSync(MIGRATIONS_DIR)
  .filter((name) => statSync(join(MIGRATIONS_DIR, name)).isDirectory())
  .sort();

const OWNER_FK = "20261001120000_document_owner_fk_and_chat_role_enum";

// Prisma applies each migration in a transaction on Postgres.
async function apply(db: PGlite, name: string) {
  const sql = readFileSync(join(MIGRATIONS_DIR, name, "migration.sql"), "utf8");
  await db.exec(`BEGIN;\n${sql}\nCOMMIT;`);
}

async function databaseBefore(target: string, seed?: (db: PGlite) => Promise<void>) {
  const db = new PGlite();
  for (const name of migrations.filter((m) => m < target)) await apply(db, name);
  await seed?.(db);
  return db;
}

const rows = async <T>(db: PGlite, sql: string) => (await db.query<T>(sql)).rows;

async function seedLegacyData(db: PGlite) {
  await db.exec(`
    INSERT INTO "User"(email, "updatedAt") VALUES ('a@x.com', now()), ('b@x.com', now());
    INSERT INTO "Document"(id, "userId", title, content, "updatedAt") VALUES
      ('d1', '1', 'A', 'alpha', now()),
      ('d2', '2', 'B', '', now()),
      ('orphan_null', NULL, 'no owner', 'x', now()),
      ('orphan_text', 'abc', 'bad owner', 'y', now()),
      ('orphan_gone', '99', 'deleted user', 'z', now());
    INSERT INTO "ChatMessage"(id, "documentId", role, content) VALUES
      ('m1', 'd1', 'user', 'hi'), ('m2', 'd1', 'assistant', 'hello'), ('m3', 'orphan_null', 'user', 'kept');
  `);
}

describe("migrations", () => {
  it("all apply to an empty database", async () => {
    const db = new PGlite();
    for (const name of migrations) await apply(db, name);
    const tables = await rows<{ table_name: string }>(
      db,
      `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY 1`,
    );
    expect(tables.map((t) => t.table_name)).toEqual([
      "AiRequest",
      "ChatMessage",
      "DesktopAuthCode",
      "DesktopSession",
      "Document",
      "User",
    ]);
  });

  describe(OWNER_FK, () => {
    it("converts owners in place and backs up documents whose owner can't be resolved", async () => {
      const db = await databaseBefore(OWNER_FK, seedLegacyData);
      await apply(db, OWNER_FK);

      expect(await rows(db, `SELECT id, "userId" FROM "Document" ORDER BY id`)).toEqual([
        { id: "d1", userId: 1 },
        { id: "d2", userId: 2 },
      ]);
      expect(await rows(db, `SELECT id, "userId" FROM cool_write_backup.orphaned_documents ORDER BY id`)).toEqual([
        { id: "orphan_gone", userId: "99" },
        { id: "orphan_null", userId: null },
        { id: "orphan_text", userId: "abc" },
      ]);
      expect(await rows(db, `SELECT id FROM cool_write_backup.orphaned_chat_messages`)).toEqual([{ id: "m3" }]);
      expect(await rows(db, `SELECT id, role::text FROM "ChatMessage" ORDER BY id`)).toEqual([
        { id: "m1", role: "user" },
        { id: "m2", role: "assistant" },
      ]);
    });

    it("enforces the owner foreign key and cascades user deletion", async () => {
      const db = await databaseBefore(OWNER_FK, seedLegacyData);
      await apply(db, OWNER_FK);

      await expect(db.exec(`INSERT INTO "Document"(id, "userId", "updatedAt") VALUES ('x', 12345, now())`)).rejects.toThrow(
        /foreign key/,
      );
      await db.exec(`DELETE FROM "User" WHERE id = 1`);
      expect(await rows(db, `SELECT id FROM "Document"`)).toEqual([{ id: "d2" }]);
      expect(await rows(db, `SELECT count(*)::int AS n FROM "ChatMessage"`)).toEqual([{ n: 0 }]);
    });

    it("aborts without changing anything if a chat role can't be converted", async () => {
      const db = await databaseBefore(OWNER_FK, async (db) => {
        await seedLegacyData(db);
        await db.exec(`INSERT INTO "ChatMessage"(id, "documentId", role, content) VALUES ('m9', 'd1', 'system', 'x')`);
      });

      await expect(apply(db, OWNER_FK)).rejects.toThrow(/ChatMessage.role/);
      await db.exec("ROLLBACK").catch(() => {});
      expect(await rows(db, `SELECT count(*)::int AS n FROM "Document"`)).toEqual([{ n: 5 }]);
      expect(
        await rows(db, `SELECT count(*)::int AS n FROM information_schema.schemata WHERE schema_name = 'cool_write_backup'`),
      ).toEqual([{ n: 0 }]);
    });
  });
});

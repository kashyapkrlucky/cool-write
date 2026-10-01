-- Hand-written, data-preserving migration (Prisma's generated diff would DROP
-- and re-ADD these columns, losing every document's owner and every chat role).
--
-- 1. Document."userId": TEXT NULL  ->  INTEGER NOT NULL, FK to "User"(id) ON DELETE CASCADE.
--    Documents whose owner can't be resolved (NULL, non-numeric, or pointing at a
--    user that no longer exists) can't satisfy the new constraint. They are NOT
--    deleted: they are copied, together with their chat messages, into the
--    "cool_write_backup" schema first (outside Prisma's management, so later
--    migrations won't touch them), then removed from the live tables.
--    Run prisma/scripts/preflight-owner-fk.sql beforehand to see how many rows
--    that affects.
-- 2. ChatMessage."role": TEXT  ->  enum "ChatRole". Aborts (changing nothing)
--    if any row holds a value other than 'user' / 'assistant'.

-- Abort before touching anything if roles can't be converted.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "ChatMessage" WHERE "role" NOT IN ('user', 'assistant')) THEN
    RAISE EXCEPTION 'ChatMessage.role contains values other than user/assistant; fix them before migrating';
  END IF;
END $$;

-- Back up documents without a resolvable owner, plus their chat messages.
CREATE SCHEMA IF NOT EXISTS "cool_write_backup";

CREATE TABLE IF NOT EXISTS "cool_write_backup"."orphaned_documents" (LIKE "Document");
ALTER TABLE "cool_write_backup"."orphaned_documents" ADD COLUMN IF NOT EXISTS "backedUpAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE TABLE IF NOT EXISTS "cool_write_backup"."orphaned_chat_messages" (LIKE "ChatMessage");
ALTER TABLE "cool_write_backup"."orphaned_chat_messages" ADD COLUMN IF NOT EXISTS "backedUpAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE TEMP TABLE "_orphan_document_ids" ON COMMIT DROP AS
SELECT d."id"
FROM "Document" d
WHERE d."userId" IS NULL
   OR d."userId" !~ '^[0-9]+$'
   OR NOT EXISTS (SELECT 1 FROM "User" u WHERE u."id"::text = d."userId");

INSERT INTO "cool_write_backup"."orphaned_documents" ("id", "userId", "title", "content", "createdAt", "updatedAt")
SELECT d."id", d."userId", d."title", d."content", d."createdAt", d."updatedAt"
FROM "Document" d
WHERE d."id" IN (SELECT "id" FROM "_orphan_document_ids");

INSERT INTO "cool_write_backup"."orphaned_chat_messages" ("id", "documentId", "role", "content", "createdAt")
SELECT m."id", m."documentId", m."role", m."content", m."createdAt"
FROM "ChatMessage" m
WHERE m."documentId" IN (SELECT "id" FROM "_orphan_document_ids");

-- Chat messages cascade with their document.
DELETE FROM "Document" WHERE "id" IN (SELECT "id" FROM "_orphan_document_ids");

-- Convert Document."userId" in place.
DROP INDEX IF EXISTS "Document_userId_idx";

ALTER TABLE "Document"
  ALTER COLUMN "userId" TYPE INTEGER USING "userId"::INTEGER,
  ALTER COLUMN "userId" SET NOT NULL;

CREATE INDEX "Document_userId_updatedAt_idx" ON "Document"("userId", "updatedAt" DESC);

ALTER TABLE "Document"
  ADD CONSTRAINT "Document_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Convert ChatMessage."role" in place.
CREATE TYPE "ChatRole" AS ENUM ('user', 'assistant');

ALTER TABLE "ChatMessage"
  ALTER COLUMN "role" TYPE "ChatRole" USING "role"::"ChatRole";

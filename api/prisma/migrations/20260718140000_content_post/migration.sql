-- CreateEnum
-- SQLite: enums are stored as TEXT

-- CreateTable
CREATE TABLE "ContentPost" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "kind" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL DEFAULT '',
    "markdown" TEXT NOT NULL,
    "html" TEXT NOT NULL,
    "tagsJson" TEXT NOT NULL DEFAULT '[]',
    "status" TEXT NOT NULL DEFAULT 'draft',
    "date" TEXT NOT NULL,
    "publishedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "ContentPost_kind_status_idx" ON "ContentPost"("kind", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ContentPost_kind_slug_key" ON "ContentPost"("kind", "slug");

-- CreateTable
CREATE TABLE "LibraryItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "author" TEXT NOT NULL DEFAULT '',
    "type" TEXT NOT NULL DEFAULT 'book',
    "status" TEXT NOT NULL DEFAULT 'planned',
    "cover" TEXT NOT NULL DEFAULT '',
    "progress" TEXT NOT NULL DEFAULT '',
    "progressCurrent" INTEGER NOT NULL DEFAULT 0,
    "progressTotal" INTEGER NOT NULL DEFAULT 0,
    "rating" REAL NOT NULL DEFAULT 0,
    "year" TEXT NOT NULL DEFAULT '',
    "platform" TEXT NOT NULL DEFAULT '',
    "link" TEXT NOT NULL DEFAULT '',
    "genre" TEXT NOT NULL DEFAULT '',
    "summary" TEXT NOT NULL DEFAULT '',
    "thoughts" TEXT NOT NULL DEFAULT '',
    "quotesJson" TEXT NOT NULL DEFAULT '[]',
    "takeawaysJson" TEXT NOT NULL DEFAULT '[]',
    "updatedLabel" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "LibraryItem_slug_key" ON "LibraryItem"("slug");

-- CreateIndex
CREATE INDEX "LibraryItem_type_status_idx" ON "LibraryItem"("type", "status");

-- CreateIndex
CREATE INDEX "LibraryItem_updatedAt_idx" ON "LibraryItem"("updatedAt");

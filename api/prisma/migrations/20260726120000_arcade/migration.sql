-- CreateTable
CREATE TABLE "ArcadeGalleryItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "gameId" TEXT NOT NULL,
    "nick" TEXT NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "kind" TEXT NOT NULL DEFAULT 'run',
    "imageUrl" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "rejectReason" TEXT,
    "clientHash" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" DATETIME
);

-- CreateTable
CREATE TABLE "ArcadeRating" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "gameId" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "clientHash" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ArcadeScore" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "gameId" TEXT NOT NULL,
    "nick" TEXT NOT NULL DEFAULT '训练家',
    "playMs" INTEGER NOT NULL DEFAULT 0,
    "sessions" INTEGER NOT NULL DEFAULT 0,
    "badges" INTEGER NOT NULL DEFAULT 0,
    "clientHash" TEXT NOT NULL,
    "hidden" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "ArcadeGalleryItem_gameId_status_idx" ON "ArcadeGalleryItem"("gameId", "status");

-- CreateIndex
CREATE INDEX "ArcadeGalleryItem_status_createdAt_idx" ON "ArcadeGalleryItem"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ArcadeRating_gameId_clientHash_key" ON "ArcadeRating"("gameId", "clientHash");

-- CreateIndex
CREATE INDEX "ArcadeRating_gameId_idx" ON "ArcadeRating"("gameId");

-- CreateIndex
CREATE UNIQUE INDEX "ArcadeScore_gameId_clientHash_key" ON "ArcadeScore"("gameId", "clientHash");

-- CreateIndex
CREATE INDEX "ArcadeScore_gameId_playMs_idx" ON "ArcadeScore"("gameId", "playMs");

-- CreateIndex
CREATE INDEX "ArcadeScore_hidden_idx" ON "ArcadeScore"("hidden");

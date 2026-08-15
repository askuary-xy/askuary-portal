-- CreateTable
CREATE TABLE "FriendApplication" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "avatar" TEXT,
    "description" TEXT,
    "screenshot" TEXT,
    "email" TEXT,
    "type" TEXT NOT NULL DEFAULT 'new',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Comment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "path" TEXT NOT NULL,
    "author" TEXT NOT NULL,
    "email" TEXT,
    "website" TEXT,
    "content" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "FriendApplication_status_idx" ON "FriendApplication"("status");

-- CreateIndex
CREATE INDEX "FriendApplication_name_idx" ON "FriendApplication"("name");

-- CreateIndex
CREATE INDEX "Comment_path_idx" ON "Comment"("path");

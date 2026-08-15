-- AlterTable
ALTER TABLE "FriendApplication" ADD COLUMN "rejectReason" TEXT;
ALTER TABLE "FriendApplication" ADD COLUMN "reviewedAt" DATETIME;

-- CreateIndex
CREATE INDEX "FriendApplication_url_idx" ON "FriendApplication"("url");

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Comment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "path" TEXT NOT NULL,
    "author" TEXT NOT NULL,
    "email" TEXT,
    "website" TEXT,
    "content" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_Comment" ("author", "content", "createdAt", "email", "id", "path", "website", "status")
SELECT "author", "content", "createdAt", "email", "id", "path", "website", 'published' FROM "Comment";
DROP TABLE "Comment";
ALTER TABLE "new_Comment" RENAME TO "Comment";
CREATE INDEX "Comment_path_idx" ON "Comment"("path");
CREATE INDEX "Comment_status_idx" ON "Comment"("status");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

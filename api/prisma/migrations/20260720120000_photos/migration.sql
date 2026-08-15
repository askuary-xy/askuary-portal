-- CreateTable
CREATE TABLE "PhotoAlbum" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL DEFAULT '',
    "theme" TEXT NOT NULL DEFAULT 'ocean',
    "cover" TEXT NOT NULL DEFAULT '',
    "date" TEXT NOT NULL DEFAULT '',
    "storyJson" TEXT NOT NULL DEFAULT '{}',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "PhotoAsset" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "photoId" TEXT NOT NULL,
    "albumKey" TEXT NOT NULL,
    "file" TEXT NOT NULL DEFAULT '',
    "title" TEXT NOT NULL DEFAULT '',
    "date" TEXT NOT NULL DEFAULT '',
    "time" TEXT NOT NULL DEFAULT '',
    "location" TEXT NOT NULL DEFAULT '',
    "category" TEXT NOT NULL DEFAULT '',
    "note" TEXT NOT NULL DEFAULT '',
    "device" TEXT NOT NULL DEFAULT '',
    "lat" REAL,
    "lng" REAL,
    "src" TEXT NOT NULL DEFAULT '',
    "thumb" TEXT NOT NULL DEFAULT '',
    "sortTs" REAL NOT NULL DEFAULT 0,
    "storyJson" TEXT NOT NULL DEFAULT '{}',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PhotoAsset_albumKey_fkey" FOREIGN KEY ("albumKey") REFERENCES "PhotoAlbum" ("key") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "PhotoAlbum_key_key" ON "PhotoAlbum"("key");

-- CreateIndex
CREATE UNIQUE INDEX "PhotoAsset_photoId_key" ON "PhotoAsset"("photoId");

-- CreateIndex
CREATE INDEX "PhotoAsset_albumKey_idx" ON "PhotoAsset"("albumKey");

-- CreateIndex
CREATE INDEX "PhotoAsset_date_idx" ON "PhotoAsset"("date");

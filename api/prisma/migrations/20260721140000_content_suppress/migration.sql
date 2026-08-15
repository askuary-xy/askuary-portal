-- CreateTable
CREATE TABLE "ContentSuppress" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "kind" TEXT NOT NULL,
    "slugNorm" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "ContentSuppress_kind_slugNorm_key" ON "ContentSuppress"("kind", "slugNorm");

-- CreateIndex
CREATE INDEX "ContentSuppress_kind_idx" ON "ContentSuppress"("kind");

-- AlterTable
ALTER TABLE "ContentPost" ADD COLUMN "manualEdit" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "PhotoAsset" ADD COLUMN "hidden" BOOLEAN NOT NULL DEFAULT false;

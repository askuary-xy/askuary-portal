-- CreateTable
CREATE TABLE "PortalConfig" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "json" TEXT NOT NULL DEFAULT '[]',
    "updatedAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

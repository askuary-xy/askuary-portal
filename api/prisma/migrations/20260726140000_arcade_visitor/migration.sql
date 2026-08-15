-- CreateTable
CREATE TABLE "ArcadeVisitor" (
    "id" TEXT NOT NULL,
    "ipHash" TEXT NOT NULL,
    "nick" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ArcadeVisitor_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ArcadeVisitor_ipHash_key" ON "ArcadeVisitor"("ipHash");

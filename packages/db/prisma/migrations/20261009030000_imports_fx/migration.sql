-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN     "importBatchId" UUID;

-- CreateTable
CREATE TABLE "ImportBatch" (
    "id" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "importedCount" INTEGER NOT NULL DEFAULT 0,
    "rolledBack" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImportBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transfer" (
    "id" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "fromAccountId" UUID NOT NULL,
    "toAccountId" UUID NOT NULL,
    "fromCurrency" VARCHAR(3) NOT NULL,
    "toCurrency" VARCHAR(3) NOT NULL,
    "sentMinor" DECIMAL(24,0) NOT NULL,
    "receivedMinor" DECIMAL(24,0) NOT NULL,
    "feeMinor" DECIMAL(24,0) NOT NULL,
    "fxSource" VARCHAR(80) NOT NULL,
    "rateTimestamp" TIMESTAMP(3) NOT NULL,
    "date" DATE NOT NULL,

    CONSTRAINT "Transfer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ImportBatch_workspaceId_createdAt_idx" ON "ImportBatch"("workspaceId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ImportBatch_id_workspaceId_key" ON "ImportBatch"("id", "workspaceId");

-- CreateIndex
CREATE INDEX "Transfer_workspaceId_idx" ON "Transfer"("workspaceId");

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_importBatchId_workspaceId_fkey" FOREIGN KEY ("importBatchId", "workspaceId") REFERENCES "ImportBatch"("id", "workspaceId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportBatch" ADD CONSTRAINT "ImportBatch_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transfer" ADD CONSTRAINT "Transfer_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

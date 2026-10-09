-- AlterEnum
ALTER TYPE "TransactionType" ADD VALUE 'ADJUSTMENT_IN';

-- AlterTable
ALTER TABLE "InstallmentPlan" ADD COLUMN     "repaymentAccountId" UUID;

-- CreateTable
CREATE TABLE "CreditCard" (
    "accountId" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "fundingAccountId" UUID NOT NULL,
    "limitMinor" DECIMAL(24,0) NOT NULL,
    "closingDay" INTEGER NOT NULL,
    "dueDay" INTEGER NOT NULL,

    CONSTRAINT "CreditCard_pkey" PRIMARY KEY ("accountId")
);

-- CreateTable
CREATE TABLE "Debt" (
    "id" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "accountId" UUID NOT NULL,
    "categoryId" UUID NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "principalMinor" DECIMAL(24,0) NOT NULL,
    "receivedMinor" DECIMAL(24,0) NOT NULL,
    "chargesMinor" DECIMAL(24,0) NOT NULL,
    "monthlyRate" TEXT NOT NULL,
    "system" TEXT NOT NULL,
    "count" INTEGER NOT NULL,
    "disbursementDate" DATE NOT NULL,
    "firstDate" DATE NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Debt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DebtExtraPayment" (
    "id" UUID NOT NULL,
    "debtId" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "amountMinor" DECIMAL(24,0) NOT NULL,
    "date" DATE NOT NULL,

    CONSTRAINT "DebtExtraPayment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CreditCard_workspaceId_idx" ON "CreditCard"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "CreditCard_accountId_workspaceId_key" ON "CreditCard"("accountId", "workspaceId");

-- CreateIndex
CREATE INDEX "Debt_workspaceId_idx" ON "Debt"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "Debt_id_workspaceId_key" ON "Debt"("id", "workspaceId");

-- CreateIndex
CREATE INDEX "DebtExtraPayment_workspaceId_idx" ON "DebtExtraPayment"("workspaceId");

-- AddForeignKey
ALTER TABLE "CreditCard" ADD CONSTRAINT "CreditCard_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditCard" ADD CONSTRAINT "CreditCard_accountId_workspaceId_fkey" FOREIGN KEY ("accountId", "workspaceId") REFERENCES "Account"("id", "workspaceId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditCard" ADD CONSTRAINT "CreditCard_fundingAccountId_workspaceId_fkey" FOREIGN KEY ("fundingAccountId", "workspaceId") REFERENCES "Account"("id", "workspaceId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Debt" ADD CONSTRAINT "Debt_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Debt" ADD CONSTRAINT "Debt_accountId_workspaceId_fkey" FOREIGN KEY ("accountId", "workspaceId") REFERENCES "Account"("id", "workspaceId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Debt" ADD CONSTRAINT "Debt_categoryId_workspaceId_fkey" FOREIGN KEY ("categoryId", "workspaceId") REFERENCES "Category"("id", "workspaceId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DebtExtraPayment" ADD CONSTRAINT "DebtExtraPayment_debtId_workspaceId_fkey" FOREIGN KEY ("debtId", "workspaceId") REFERENCES "Debt"("id", "workspaceId") ON DELETE CASCADE ON UPDATE CASCADE;

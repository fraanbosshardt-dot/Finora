ALTER TABLE "Workspace" ADD COLUMN "plan" TEXT NOT NULL DEFAULT 'FREE';
ALTER TABLE "Workspace" ADD COLUMN "proUntil" TIMESTAMP(3);
ALTER TABLE "Workspace" ADD CONSTRAINT "Workspace_plan_check" CHECK ("plan" IN ('FREE', 'PRO'));

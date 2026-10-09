ALTER TABLE "Workspace" ADD COLUMN "alertPreferences" JSONB NOT NULL DEFAULT '{}';
CREATE TABLE "Rule" (
 "id" UUID NOT NULL,"workspaceId" UUID NOT NULL,"name" VARCHAR(80) NOT NULL,"contains" VARCHAR(80) NOT NULL,"categoryId" UUID NOT NULL,"accountId" UUID,"type" TEXT NOT NULL,"priority" INTEGER NOT NULL DEFAULT 0,"active" BOOLEAN NOT NULL DEFAULT true,
 CONSTRAINT "Rule_pkey" PRIMARY KEY ("id"),
 CONSTRAINT "Rule_workspaceId_fkey" FOREIGN KEY("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 CONSTRAINT "Rule_categoryId_workspaceId_fkey" FOREIGN KEY("categoryId","workspaceId") REFERENCES "Category"("id","workspaceId") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "Rule_workspaceId_active_idx" ON "Rule"("workspaceId","active");
CREATE TABLE "DismissedAlert" ("workspaceId" UUID NOT NULL,"key" VARCHAR(200) NOT NULL,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "DismissedAlert_pkey" PRIMARY KEY("workspaceId","key"),
 CONSTRAINT "DismissedAlert_workspaceId_fkey" FOREIGN KEY("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

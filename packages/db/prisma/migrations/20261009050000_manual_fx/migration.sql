CREATE TABLE "FxRate"("id" UUID NOT NULL,"workspaceId" UUID NOT NULL,"base" VARCHAR(3) NOT NULL,"quote" VARCHAR(3) NOT NULL,"rate" VARCHAR(25) NOT NULL,"date" DATE NOT NULL,"source" VARCHAR(80) NOT NULL,
CONSTRAINT "FxRate_pkey" PRIMARY KEY("id"),CONSTRAINT "FxRate_workspaceId_fkey" FOREIGN KEY("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE);
CREATE INDEX "FxRate_workspaceId_date_idx" ON "FxRate"("workspaceId","date");

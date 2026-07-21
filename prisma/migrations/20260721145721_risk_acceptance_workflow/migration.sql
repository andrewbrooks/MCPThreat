-- CreateTable
CREATE TABLE "AcceptanceRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "findingId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "requireBothSides" BOOLEAN NOT NULL DEFAULT false,
    "justification" TEXT NOT NULL,
    "residualRisk" TEXT NOT NULL DEFAULT '',
    "priorStatus" TEXT NOT NULL,
    "reviewIntervalDays" INTEGER,
    "requestedById" TEXT,
    "requestedByLabel" TEXT NOT NULL DEFAULT '',
    "assessorApproverId" TEXT,
    "assessorApproverLabel" TEXT,
    "assessorApprovedAt" DATETIME,
    "clientApproverId" TEXT,
    "clientApproverLabel" TEXT,
    "clientApprovedAt" DATETIME,
    "rejectedById" TEXT,
    "rejectedByLabel" TEXT,
    "rejectedReason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" DATETIME,
    "expiresAt" DATETIME,
    CONSTRAINT "AcceptanceRequest_findingId_fkey" FOREIGN KEY ("findingId") REFERENCES "Finding" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Project" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "mcpServerUrl" TEXT,
    "architecture" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "acceptancePolicy" TEXT NOT NULL DEFAULT 'OFF',
    "ownerId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Project_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Project" ("architecture", "createdAt", "description", "id", "mcpServerUrl", "name", "ownerId", "status", "updatedAt") SELECT "architecture", "createdAt", "description", "id", "mcpServerUrl", "name", "ownerId", "status", "updatedAt" FROM "Project";
DROP TABLE "Project";
ALTER TABLE "new_Project" RENAME TO "Project";
CREATE INDEX "Project_ownerId_idx" ON "Project"("ownerId");
CREATE TABLE "new_ProjectMember" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "userId" TEXT,
    "role" TEXT NOT NULL DEFAULT 'MEMBER',
    "side" TEXT NOT NULL DEFAULT 'CLIENT',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProjectMember_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ProjectMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_ProjectMember" ("createdAt", "email", "id", "projectId", "role", "userId") SELECT "createdAt", "email", "id", "projectId", "role", "userId" FROM "ProjectMember";
DROP TABLE "ProjectMember";
ALTER TABLE "new_ProjectMember" RENAME TO "ProjectMember";
CREATE INDEX "ProjectMember_projectId_idx" ON "ProjectMember"("projectId");
CREATE UNIQUE INDEX "ProjectMember_projectId_email_key" ON "ProjectMember"("projectId", "email");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "AcceptanceRequest_findingId_idx" ON "AcceptanceRequest"("findingId");

-- CreateIndex
CREATE INDEX "AcceptanceRequest_projectId_idx" ON "AcceptanceRequest"("projectId");

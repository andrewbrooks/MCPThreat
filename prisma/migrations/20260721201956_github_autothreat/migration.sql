-- AlterTable
ALTER TABLE "ThreatModel" ADD COLUMN "dataflow" TEXT;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Finding" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "threatVectorId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "recommendation" TEXT NOT NULL DEFAULT '',
    "severity" TEXT NOT NULL DEFAULT 'MEDIUM',
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "source" TEXT NOT NULL DEFAULT 'MANUAL',
    "confidence" TEXT,
    "owner" TEXT NOT NULL DEFAULT '',
    "dueDate" DATETIME,
    "evidence" TEXT NOT NULL DEFAULT '',
    "reviewIntervalDays" INTEGER,
    "reviewDueAt" DATETIME,
    "reminderIntervalDays" INTEGER,
    "reminderNextAt" DATETIME,
    "lastAlertAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Finding_threatVectorId_fkey" FOREIGN KEY ("threatVectorId") REFERENCES "ThreatVector" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Finding_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Finding" ("createdAt", "description", "dueDate", "evidence", "id", "lastAlertAt", "owner", "projectId", "recommendation", "reminderIntervalDays", "reminderNextAt", "reviewDueAt", "reviewIntervalDays", "severity", "status", "threatVectorId", "title", "updatedAt") SELECT "createdAt", "description", "dueDate", "evidence", "id", "lastAlertAt", "owner", "projectId", "recommendation", "reminderIntervalDays", "reminderNextAt", "reviewDueAt", "reviewIntervalDays", "severity", "status", "threatVectorId", "title", "updatedAt" FROM "Finding";
DROP TABLE "Finding";
ALTER TABLE "new_Finding" RENAME TO "Finding";
CREATE INDEX "Finding_projectId_idx" ON "Finding"("projectId");
CREATE INDEX "Finding_threatVectorId_idx" ON "Finding"("threatVectorId");
CREATE TABLE "new_Project" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "mcpServerUrl" TEXT,
    "architecture" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "acceptancePolicy" TEXT NOT NULL DEFAULT 'OFF',
    "repoUrl" TEXT,
    "repoRef" TEXT,
    "sourceType" TEXT NOT NULL DEFAULT 'MANUAL',
    "analysisStatus" TEXT NOT NULL DEFAULT 'NONE',
    "analysisError" TEXT,
    "analyzedAt" DATETIME,
    "techStack" TEXT NOT NULL DEFAULT '',
    "ownerId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Project_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Project" ("acceptancePolicy", "architecture", "createdAt", "description", "id", "mcpServerUrl", "name", "ownerId", "status", "updatedAt") SELECT "acceptancePolicy", "architecture", "createdAt", "description", "id", "mcpServerUrl", "name", "ownerId", "status", "updatedAt" FROM "Project";
DROP TABLE "Project";
ALTER TABLE "new_Project" RENAME TO "Project";
CREATE INDEX "Project_ownerId_idx" ON "Project"("ownerId");
CREATE TABLE "new_ThreatVector" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "trustBoundaryId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "strideCategory" TEXT NOT NULL,
    "mcpCategory" TEXT NOT NULL,
    "likelihood" TEXT NOT NULL DEFAULT 'MEDIUM',
    "impact" TEXT NOT NULL DEFAULT 'MEDIUM',
    "source" TEXT NOT NULL DEFAULT 'MANUAL',
    "confidence" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ThreatVector_trustBoundaryId_fkey" FOREIGN KEY ("trustBoundaryId") REFERENCES "TrustBoundary" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_ThreatVector" ("createdAt", "description", "id", "impact", "likelihood", "mcpCategory", "strideCategory", "title", "trustBoundaryId", "updatedAt") SELECT "createdAt", "description", "id", "impact", "likelihood", "mcpCategory", "strideCategory", "title", "trustBoundaryId", "updatedAt" FROM "ThreatVector";
DROP TABLE "ThreatVector";
ALTER TABLE "new_ThreatVector" RENAME TO "ThreatVector";
CREATE INDEX "ThreatVector_trustBoundaryId_idx" ON "ThreatVector"("trustBoundaryId");
CREATE TABLE "new_TrustBoundary" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "threatModelId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "type" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'MANUAL',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TrustBoundary_threatModelId_fkey" FOREIGN KEY ("threatModelId") REFERENCES "ThreatModel" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_TrustBoundary" ("createdAt", "description", "id", "label", "threatModelId", "type", "updatedAt") SELECT "createdAt", "description", "id", "label", "threatModelId", "type", "updatedAt" FROM "TrustBoundary";
DROP TABLE "TrustBoundary";
ALTER TABLE "new_TrustBoundary" RENAME TO "TrustBoundary";
CREATE INDEX "TrustBoundary_threatModelId_idx" ON "TrustBoundary"("threatModelId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

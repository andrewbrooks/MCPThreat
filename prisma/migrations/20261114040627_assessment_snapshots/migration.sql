-- CreateTable
CREATE TABLE "AssessmentSnapshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "requirement" TEXT NOT NULL DEFAULT 'NONE',
    "contentHash" TEXT NOT NULL,
    "assessment" TEXT NOT NULL,
    "createdById" TEXT,
    "createdByLabel" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AssessmentSnapshot_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SnapshotSignoff" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "snapshotId" TEXT NOT NULL,
    "side" TEXT NOT NULL,
    "decision" TEXT NOT NULL,
    "comment" TEXT NOT NULL DEFAULT '',
    "userId" TEXT,
    "userLabel" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SnapshotSignoff_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "AssessmentSnapshot" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "AssessmentSnapshot_projectId_idx" ON "AssessmentSnapshot"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "AssessmentSnapshot_projectId_version_key" ON "AssessmentSnapshot"("projectId", "version");

-- CreateIndex
CREATE INDEX "SnapshotSignoff_snapshotId_idx" ON "SnapshotSignoff"("snapshotId");

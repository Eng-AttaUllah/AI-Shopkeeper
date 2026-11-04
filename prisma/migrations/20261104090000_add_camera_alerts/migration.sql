-- CreateTable
CREATE TABLE "camera_alerts" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clipPath" TEXT NOT NULL,
    "capturedAt" DATETIME NOT NULL,
    "durationMs" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "reviewedAt" DATETIME,
    "reviewNote" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "camera_alerts_clipPath_key" ON "camera_alerts"("clipPath");

-- CreateIndex
CREATE INDEX "camera_alerts_capturedAt_idx" ON "camera_alerts"("capturedAt");

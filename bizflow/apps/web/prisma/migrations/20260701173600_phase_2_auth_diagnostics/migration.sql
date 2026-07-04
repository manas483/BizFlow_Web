-- CreateTable
CREATE TABLE "AuthDiagnosticLog" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "status" TEXT NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuthDiagnosticLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AuthDiagnosticLog_email_idx" ON "AuthDiagnosticLog"("email");

-- CreateIndex
CREATE INDEX "AuthDiagnosticLog_createdAt_idx" ON "AuthDiagnosticLog"("createdAt");

-- CreateIndex
CREATE INDEX "AuthDiagnosticLog_status_idx" ON "AuthDiagnosticLog"("status");

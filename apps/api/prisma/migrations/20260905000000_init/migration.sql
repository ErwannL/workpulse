-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "EntryType" AS ENUM ('CLOCK_IN', 'BREAK_START', 'BREAK_END', 'CLOCK_OUT');

-- CreateEnum
CREATE TYPE "DayStatus" AS ENUM ('WORK', 'REMOTE', 'HOLIDAY', 'LEAVE', 'RTT', 'SICK', 'SPECIAL', 'OTHER');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "displayName" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "devices" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "devices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "time_entries" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "date" VARCHAR(10) NOT NULL,
    "type" "EntryType" NOT NULL,
    "at" TIMESTAMP(3) NOT NULL,
    "manual" BOOLEAN NOT NULL DEFAULT false,
    "editedAt" TIMESTAMP(3),
    "originalAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "time_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_days" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "date" VARCHAR(10) NOT NULL,
    "status" "DayStatus" NOT NULL DEFAULT 'WORK',
    "worksOnHoliday" BOOLEAN NOT NULL DEFAULT false,
    "plannedOverride" INTEGER,
    "notes" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "work_days_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_settings" (
    "userId" UUID NOT NULL,
    "payload" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_settings_pkey" PRIMARY KEY ("userId")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "devices_tokenHash_key" ON "devices"("tokenHash");

-- CreateIndex
CREATE INDEX "devices_userId_idx" ON "devices"("userId");

-- CreateIndex
CREATE INDEX "time_entries_userId_updatedAt_idx" ON "time_entries"("userId", "updatedAt");

-- CreateIndex
CREATE INDEX "time_entries_userId_date_idx" ON "time_entries"("userId", "date");

-- CreateIndex
CREATE INDEX "work_days_userId_updatedAt_idx" ON "work_days"("userId", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "work_days_userId_date_key" ON "work_days"("userId", "date");

-- AddForeignKey
ALTER TABLE "devices" ADD CONSTRAINT "devices_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_days" ADD CONSTRAINT "work_days_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_settings" ADD CONSTRAINT "user_settings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;


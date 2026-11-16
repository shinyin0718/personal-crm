-- AlterTable
ALTER TABLE "users" ADD COLUMN     "scan_count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "scan_window_start" TIMESTAMP(3);

-- AlterEnum
ALTER TYPE "AllocationStatus" ADD VALUE 'NO_SHOW';

-- AlterTable
ALTER TABLE "reservation_rooms" ADD COLUMN "actual_checkout_date" DATE;

-- AlterEnum
ALTER TYPE "WinType" ADD VALUE 'draw';

-- AlterTable
ALTER TABLE "elo_state" ALTER COLUMN "last5_deltas" SET DEFAULT ARRAY[]::DECIMAL(65,30)[];

-- CreateEnum
CREATE TYPE "AssetCategory" AS ENUM ('MUSIC', 'SFX', 'VOICE', 'AMBIENCE', 'OTHER');

-- AlterTable
ALTER TABLE "Asset" ADD COLUMN     "category" "AssetCategory" NOT NULL DEFAULT 'OTHER',
ADD COLUMN     "favorite" BOOLEAN NOT NULL DEFAULT false;

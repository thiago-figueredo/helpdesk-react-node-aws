-- AlterTable
ALTER TABLE "Message" ADD COLUMN     "senderEmail" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_name_key" ON "Tenant"("name");

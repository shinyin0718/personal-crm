-- AlterTable
ALTER TABLE "oauth_clients" ADD COLUMN     "approved_at" TIMESTAMP(3),
ADD COLUMN     "registration_ip" TEXT;

-- AlterTable
ALTER TABLE "oauth_grants" ADD COLUMN     "previous_refresh_hash" TEXT;

-- CreateIndex
CREATE INDEX "oauth_clients_registration_ip_created_at_idx" ON "oauth_clients"("registration_ip", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "oauth_grants_previous_refresh_hash_key" ON "oauth_grants"("previous_refresh_hash");


-- Clients that already connected count as approved, so the sweep keeps them.
UPDATE "oauth_clients" c SET "approved_at" = c."created_at"
WHERE EXISTS (SELECT 1 FROM "oauth_grants" g WHERE g."client_id" = c."id")
   OR EXISTS (SELECT 1 FROM "oauth_codes" o WHERE o."client_id" = c."id");

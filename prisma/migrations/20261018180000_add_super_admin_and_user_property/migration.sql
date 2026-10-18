-- Step 1: Insert SUPER_ADMIN role row into roles table if missing
INSERT INTO "roles" ("id", "name", "description", "created_at", "updated_at")
VALUES ('role_super_admin_v1', 'SUPER_ADMIN', 'Platform Super Administrator with system-wide access across all properties', NOW(), NOW())
ON CONFLICT ("name") DO NOTHING;

-- Step 2: Add property_id column to users table if not exists
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "property_id" TEXT;

-- Step 3: Add foreign key constraint to properties(id)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_property_id_fkey'
  ) THEN
    ALTER TABLE "users" ADD CONSTRAINT "users_property_id_fkey"
      FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- Step 4: Add index on users(property_id)
CREATE INDEX IF NOT EXISTS "users_property_id_idx" ON "users"("property_id");

-- Step 5: Safe data migration for existing users:
-- Seed dedicated superadmin@byteinn.local with SUPER_ADMIN role (property_id = NULL)
INSERT INTO "users" ("id", "name", "email", "password_hash", "role_id", "property_id", "status", "must_change_password", "token_version", "created_at", "updated_at")
VALUES (
  'usr_superadmin_v1',
  'Platform Super Administrator',
  'superadmin@byteinn.local',
  '$2b$10$57btbT5zeeSUz0do4iz1Tu1uluaiRBz15aQiEf1pFqR2ciFIZuplm',
  (SELECT "id" FROM "roles" WHERE "name" = 'SUPER_ADMIN' LIMIT 1),
  NULL,
  'ACTIVE',
  FALSE,
  1,
  NOW(),
  NOW()
)
ON CONFLICT ("email") DO UPDATE SET
  "role_id" = (SELECT "id" FROM "roles" WHERE "name" = 'SUPER_ADMIN' LIMIT 1),
  "property_id" = NULL;

-- Keep admin@byteinn.local as Hotel ADMIN assigned to the primary hotel
UPDATE "users"
SET
  "role_id" = (SELECT "id" FROM "roles" WHERE "name" = 'ADMIN' LIMIT 1),
  "property_id" = COALESCE(
    (SELECT "id" FROM "properties" WHERE "id" = 'cprop366914525589ad143103'),
    (SELECT "id" FROM "properties" ORDER BY "created_at" ASC LIMIT 1)
  ),
  "token_version" = "token_version" + 1,
  "updated_at" = NOW()
WHERE "email" = 'admin@byteinn.local';

-- Assign existing receptionist reception@byteinn.local to the primary hotel
UPDATE "users"
SET
  "property_id" = COALESCE(
    (SELECT "id" FROM "properties" WHERE "id" = 'cprop366914525589ad143103'),
    (SELECT "id" FROM "properties" ORDER BY "created_at" ASC LIMIT 1)
  ),
  "token_version" = "token_version" + 1,
  "updated_at" = NOW()
WHERE "email" = 'reception@byteinn.local'
  AND "property_id" IS NULL;

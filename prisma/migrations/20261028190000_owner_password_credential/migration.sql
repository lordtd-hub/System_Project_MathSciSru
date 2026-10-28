-- CreateTable
CREATE TABLE "owner_password_credentials" (
    "user_id" TEXT NOT NULL,
    "login_email" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "password_hash" TEXT,
    "enrollment_token_hash" TEXT,
    "enrollment_expires_at" TIMESTAMP(3),
    "activated_at" TIMESTAMP(3),
    "revoked_at" TIMESTAMP(3),
    "credential_version" INTEGER NOT NULL DEFAULT 0,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "attempt_window_start" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "owner_password_credentials_pkey" PRIMARY KEY ("user_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "owner_password_credentials_login_email_key" ON "owner_password_credentials"("login_email");

-- CreateIndex
CREATE UNIQUE INDEX "owner_password_credentials_enrollment_token_hash_key" ON "owner_password_credentials"("enrollment_token_hash");

-- AddForeignKey
ALTER TABLE "owner_password_credentials" ADD CONSTRAINT "owner_password_credentials_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Credentials are server-only. No Supabase browser/Data API role may read hashes.
ALTER TABLE "owner_password_credentials" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "owner_password_credentials" FROM PUBLIC;
DO $owner_password_security$
DECLARE client_role text;
BEGIN
  FOREACH client_role IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = client_role) THEN
      EXECUTE format('REVOKE ALL ON TABLE %I.%I FROM %I', 'public', 'owner_password_credentials', client_role);
    END IF;
  END LOOP;
END;
$owner_password_security$;

ALTER TABLE "owner_password_credentials"
  ADD CONSTRAINT "owner_password_nonnegative_attempts" CHECK ("attempts" >= 0),
  ADD CONSTRAINT "owner_password_nonnegative_version" CHECK ("credential_version" >= 0),
  ADD CONSTRAINT "owner_password_enrollment_expiry_pair" CHECK (("enrollment_token_hash" IS NULL) = ("enrollment_expires_at" IS NULL)),
  ADD CONSTRAINT "owner_password_setup_or_active" CHECK ("password_hash" IS NULL OR "enrollment_token_hash" IS NULL);

-- Optional brand logo (upload or URL), separate from public hero image.
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "logoImageUrl" TEXT;

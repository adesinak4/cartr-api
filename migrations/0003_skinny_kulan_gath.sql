ALTER TABLE "merchants" ADD COLUMN "custom_domain_verification_token" text;--> statement-breakpoint
ALTER TABLE "merchants" ADD COLUMN "custom_domain_requested_at" timestamp with time zone;
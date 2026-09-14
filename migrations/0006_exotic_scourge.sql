CREATE TYPE "public"."domain_provisioning_status" AS ENUM('pending', 'done');--> statement-breakpoint
CREATE TYPE "public"."signup_draft_status" AS ENUM('pending', 'completed', 'failed');--> statement-breakpoint
CREATE TABLE "signup_drafts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"store_name" text NOT NULL,
	"domain" text NOT NULL,
	"plan_id" uuid NOT NULL,
	"period_months" integer NOT NULL,
	"theme_id" uuid,
	"status" "signup_draft_status" DEFAULT 'pending' NOT NULL,
	"merchant_id" uuid,
	"login_token_consumed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "domain_provisioning_tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"desired_domain" text NOT NULL,
	"status" "domain_provisioning_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"done_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "signup_drafts" ADD CONSTRAINT "signup_drafts_plan_id_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signup_drafts" ADD CONSTRAINT "signup_drafts_theme_id_themes_id_fk" FOREIGN KEY ("theme_id") REFERENCES "public"."themes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signup_drafts" ADD CONSTRAINT "signup_drafts_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "domain_provisioning_tasks" ADD CONSTRAINT "domain_provisioning_tasks_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;
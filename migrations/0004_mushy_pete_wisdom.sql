ALTER TYPE "public"."order_status" ADD VALUE 'refunded';--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "flutterwave_transaction_id" text;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "refunded_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "refund_reference" text;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "refund_initiated_by" uuid;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_refund_initiated_by_users_id_fk" FOREIGN KEY ("refund_initiated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
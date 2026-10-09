CREATE TYPE "public"."access_request_status" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
CREATE TABLE "access_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"status" "access_request_status" DEFAULT 'pending' NOT NULL,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone,
	"resolved_by_id" uuid,
	"resolved_by_name" text,
	CONSTRAINT "access_requests_email_lowercase" CHECK ("access_requests"."email" = lower("access_requests"."email"))
);
--> statement-breakpoint
CREATE UNIQUE INDEX "access_requests_one_pending_idx" ON "access_requests" USING btree ("email") WHERE "access_requests"."status" = 'pending';
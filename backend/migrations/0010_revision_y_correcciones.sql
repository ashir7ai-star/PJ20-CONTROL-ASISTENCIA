CREATE TYPE "public"."correction_action" AS ENUM('add', 'void');--> statement-breakpoint
CREATE TYPE "public"."review_decision" AS ENUM('approved', 'rejected');--> statement-breakpoint
CREATE TABLE "attendance_corrections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"employee_id" uuid NOT NULL,
	"action" "correction_action" NOT NULL,
	"kind" "attendance_kind",
	"effective_time" timestamp with time zone,
	"voids_record_id" uuid,
	"voids_correction_id" uuid,
	"reason" text NOT NULL,
	"author_id" uuid NOT NULL,
	"author_name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "attendance_corrections_reason_length" CHECK (char_length("attendance_corrections"."reason") BETWEEN 10 AND 500),
	CONSTRAINT "attendance_corrections_shape" CHECK (("attendance_corrections"."action" = 'add' AND "attendance_corrections"."kind" IS NOT NULL AND "attendance_corrections"."effective_time" IS NOT NULL
            AND "attendance_corrections"."voids_record_id" IS NULL AND "attendance_corrections"."voids_correction_id" IS NULL)
        OR ("attendance_corrections"."action" = 'void' AND "attendance_corrections"."kind" IS NULL AND "attendance_corrections"."effective_time" IS NULL
            AND num_nonnulls("attendance_corrections"."voids_record_id", "attendance_corrections"."voids_correction_id") = 1))
);
--> statement-breakpoint
CREATE TABLE "attendance_reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"record_id" uuid NOT NULL,
	"decision" "review_decision" NOT NULL,
	"note" text,
	"reviewer_id" uuid NOT NULL,
	"reviewer_name" text NOT NULL,
	"decided_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "attendance_reviews_note_length" CHECK (char_length("attendance_reviews"."note") <= 500),
	CONSTRAINT "attendance_reviews_rejection_note" CHECK ("attendance_reviews"."decision" = 'approved' OR coalesce(char_length("attendance_reviews"."note"), 0) >= 10)
);
--> statement-breakpoint
ALTER TABLE "attendance_corrections" ADD CONSTRAINT "attendance_corrections_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_corrections" ADD CONSTRAINT "attendance_corrections_voids_record_id_attendance_records_id_fk" FOREIGN KEY ("voids_record_id") REFERENCES "public"."attendance_records"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_corrections" ADD CONSTRAINT "attendance_corrections_voids_correction_id_attendance_corrections_id_fk" FOREIGN KEY ("voids_correction_id") REFERENCES "public"."attendance_corrections"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_reviews" ADD CONSTRAINT "attendance_reviews_record_id_attendance_records_id_fk" FOREIGN KEY ("record_id") REFERENCES "public"."attendance_records"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "attendance_corrections_employee_idx" ON "attendance_corrections" USING btree ("employee_id","effective_time");--> statement-breakpoint
CREATE UNIQUE INDEX "attendance_corrections_voids_record_idx" ON "attendance_corrections" USING btree ("voids_record_id") WHERE "attendance_corrections"."voids_record_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "attendance_corrections_voids_correction_idx" ON "attendance_corrections" USING btree ("voids_correction_id") WHERE "attendance_corrections"."voids_correction_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "attendance_reviews_record_idx" ON "attendance_reviews" USING btree ("record_id","decided_at");
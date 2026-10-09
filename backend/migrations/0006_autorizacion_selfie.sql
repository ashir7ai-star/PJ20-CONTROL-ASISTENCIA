CREATE TABLE "selfie_authorizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"employee_id" uuid NOT NULL,
	"authorized" boolean NOT NULL,
	"version" text NOT NULL,
	"decided_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ip" text,
	"user_agent" text
);
--> statement-breakpoint
ALTER TABLE "attendance_records" ALTER COLUMN "photo_key" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "selfie_authorizations" ADD CONSTRAINT "selfie_authorizations_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "selfie_authorizations_employee_idx" ON "selfie_authorizations" USING btree ("employee_id","decided_at");
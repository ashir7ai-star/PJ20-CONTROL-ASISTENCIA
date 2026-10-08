CREATE TYPE "public"."attendance_kind" AS ENUM('check_in', 'check_out');--> statement-breakpoint
CREATE TYPE "public"."review_status" AS ENUM('ok', 'pending');--> statement-breakpoint
CREATE TABLE "attendance_records" (
	"id" uuid PRIMARY KEY NOT NULL,
	"employee_id" uuid NOT NULL,
	"kind" "attendance_kind" NOT NULL,
	"server_time" timestamp with time zone DEFAULT now() NOT NULL,
	"device_time" timestamp with time zone,
	"latitude" double precision NOT NULL,
	"longitude" double precision NOT NULL,
	"accuracy_m" real NOT NULL,
	"location_captured_at" timestamp with time zone NOT NULL,
	"photo_key" text NOT NULL,
	"ip" text,
	"user_agent" text,
	"review_status" "review_status" NOT NULL,
	"review_reasons" text[] DEFAULT '{}'::text[] NOT NULL,
	CONSTRAINT "attendance_latitude_range" CHECK ("attendance_records"."latitude" BETWEEN -90 AND 90),
	CONSTRAINT "attendance_longitude_range" CHECK ("attendance_records"."longitude" BETWEEN -180 AND 180),
	CONSTRAINT "attendance_accuracy_positive" CHECK ("attendance_records"."accuracy_m" >= 0)
);
--> statement-breakpoint
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "attendance_employee_time_idx" ON "attendance_records" USING btree ("employee_id","server_time");--> statement-breakpoint
CREATE INDEX "attendance_server_time_idx" ON "attendance_records" USING btree ("server_time");
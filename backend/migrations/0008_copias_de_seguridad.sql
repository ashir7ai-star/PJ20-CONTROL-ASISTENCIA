CREATE TABLE "backup_runs" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"ok" boolean NOT NULL,
	"finished_at" timestamp with time zone DEFAULT now() NOT NULL,
	"detail" text,
	CONSTRAINT "backup_runs_kind" CHECK ("backup_runs"."kind" IN ('db-daily', 'db-monthly', 'selfies'))
);
--> statement-breakpoint
CREATE INDEX "backup_runs_finished_idx" ON "backup_runs" USING btree ("finished_at");
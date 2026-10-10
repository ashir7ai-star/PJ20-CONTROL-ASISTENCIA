-- Off-server backups (D8). The backup service connects with a login user that
-- belongs to pj20_backup: it can READ everything (pg_read_all_data, needed by
-- pg_dump) and only WRITE its own run results. It cannot change any record.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'pj20_backup') THEN
    CREATE ROLE pj20_backup NOLOGIN;
  END IF;
END;
$$;
--> statement-breakpoint
GRANT pg_read_all_data TO pj20_backup;
--> statement-breakpoint
GRANT INSERT ON backup_runs TO pj20_backup;
--> statement-breakpoint
GRANT USAGE ON SEQUENCE backup_runs_id_seq TO pj20_backup;
--> statement-breakpoint
-- The API only reads them, for the admin panel.
GRANT SELECT ON backup_runs TO pj20_app;

-- Security hardening (CLAUDE.md §1.11, §2.4, §2.5, §3.2).
-- 1) Append-only tables: audit_log and consents can never be modified or deleted,
--    not even by the owner role (defence in depth on top of privileges).
CREATE OR REPLACE FUNCTION reject_modification() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'La tabla % es inmutable: no se permite %', TG_TABLE_NAME, TG_OP
    USING ERRCODE = 'insufficient_privilege';
END;
$$;
--> statement-breakpoint
CREATE TRIGGER audit_log_immutable
  BEFORE UPDATE OR DELETE ON audit_log
  FOR EACH ROW EXECUTE FUNCTION reject_modification();
--> statement-breakpoint
CREATE TRIGGER audit_log_no_truncate
  BEFORE TRUNCATE ON audit_log
  FOR EACH STATEMENT EXECUTE FUNCTION reject_modification();
--> statement-breakpoint
CREATE TRIGGER consents_immutable
  BEFORE UPDATE OR DELETE ON consents
  FOR EACH ROW EXECUTE FUNCTION reject_modification();
--> statement-breakpoint
CREATE TRIGGER consents_no_truncate
  BEFORE TRUNCATE ON consents
  FOR EACH STATEMENT EXECUTE FUNCTION reject_modification();
--> statement-breakpoint

-- 2) Keep employees.updated_at accurate.
CREATE OR REPLACE FUNCTION touch_updated_at() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER employees_touch_updated_at
  BEFORE UPDATE ON employees
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
--> statement-breakpoint

-- 3) Least-privilege group role for the API. The login user that belongs to it
--    is created outside migrations (no passwords in the repository):
--    `pnpm db:usuario-app`.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'pj20_app') THEN
    CREATE ROLE pj20_app NOLOGIN;
  END IF;
END;
$$;
--> statement-breakpoint
GRANT USAGE ON SCHEMA public TO pj20_app;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON employees, sessions TO pj20_app;
--> statement-breakpoint
-- Append-only for the API: it can read and add, never change or remove.
GRANT SELECT, INSERT ON consents, audit_log TO pj20_app;
--> statement-breakpoint
GRANT USAGE, SELECT ON SEQUENCE audit_log_id_seq TO pj20_app;

-- Attendance records are immutable (CLAUDE.md §2.4): not even the owner role
-- can change or remove them. A correction is a new adjustment record (Fase 6).
CREATE TRIGGER attendance_records_immutable
  BEFORE UPDATE OR DELETE ON attendance_records
  FOR EACH ROW EXECUTE FUNCTION reject_modification();
--> statement-breakpoint
CREATE TRIGGER attendance_records_no_truncate
  BEFORE TRUNCATE ON attendance_records
  FOR EACH STATEMENT EXECUTE FUNCTION reject_modification();
--> statement-breakpoint
-- Append-only for the API: it can read and add, never change or remove.
GRANT SELECT, INSERT ON attendance_records TO pj20_app;

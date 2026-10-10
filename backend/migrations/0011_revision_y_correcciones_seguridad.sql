-- Reviews and corrections (Fase 6) are evidence, like the records they refer
-- to: append-only. Not even the owner can change or remove them.
CREATE TRIGGER attendance_reviews_immutable
  BEFORE UPDATE OR DELETE ON attendance_reviews
  FOR EACH ROW EXECUTE FUNCTION reject_modification();
--> statement-breakpoint
CREATE TRIGGER attendance_reviews_no_truncate
  BEFORE TRUNCATE ON attendance_reviews
  FOR EACH STATEMENT EXECUTE FUNCTION reject_modification();
--> statement-breakpoint
CREATE TRIGGER attendance_corrections_immutable
  BEFORE UPDATE OR DELETE ON attendance_corrections
  FOR EACH ROW EXECUTE FUNCTION reject_modification();
--> statement-breakpoint
CREATE TRIGGER attendance_corrections_no_truncate
  BEFORE TRUNCATE ON attendance_corrections
  FOR EACH STATEMENT EXECUTE FUNCTION reject_modification();
--> statement-breakpoint
GRANT SELECT, INSERT ON attendance_reviews TO pj20_app;
--> statement-breakpoint
GRANT SELECT, INSERT ON attendance_corrections TO pj20_app;

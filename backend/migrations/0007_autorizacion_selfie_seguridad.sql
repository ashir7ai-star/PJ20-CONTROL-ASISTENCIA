-- Selfie authorizations (D7) are evidence of each decision: append-only, like
-- consents and the audit log. Not even the owner can change or remove them.
CREATE TRIGGER selfie_authorizations_immutable
  BEFORE UPDATE OR DELETE ON selfie_authorizations
  FOR EACH ROW EXECUTE FUNCTION reject_modification();
--> statement-breakpoint
CREATE TRIGGER selfie_authorizations_no_truncate
  BEFORE TRUNCATE ON selfie_authorizations
  FOR EACH STATEMENT EXECUTE FUNCTION reject_modification();
--> statement-breakpoint
GRANT SELECT, INSERT ON selfie_authorizations TO pj20_app;

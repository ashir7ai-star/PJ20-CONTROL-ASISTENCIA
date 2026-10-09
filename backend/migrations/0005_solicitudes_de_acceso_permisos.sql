-- Access requests (D6): the API creates them, admins resolve them (UPDATE) and
-- resolved ones are purged after 30 days (DELETE). Each step is audited.
GRANT SELECT, INSERT, UPDATE, DELETE ON access_requests TO pj20_app;

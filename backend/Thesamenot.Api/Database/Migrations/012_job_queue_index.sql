CREATE INDEX jobs_kind_due ON background_jobs(kind,state,next_utc,lease_until_utc,id);

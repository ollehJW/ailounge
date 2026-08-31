SET search_path TO ai_lounge, public;

CREATE OR REPLACE VIEW portal_users AS
SELECT
    user_id::text AS user_id,
    login_id::text AS login_id,
    COALESCE(email, '')::text AS email,
    COALESCE(org_name, '')::text AS org_name,
    COALESCE(displayed_name, login_id, user_id)::text AS displayed_name,
    COALESCE(job_title, '')::text AS job_title,
    is_admin,
    COALESCE(created_at, '')::text AS created_at
FROM ai_lounge."user";

COMMENT ON VIEW portal_users IS
    'Local read-only adapter from the ai_lounge user table';

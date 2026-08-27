SET search_path TO ai_studio, data_catalog, public;

CREATE OR REPLACE VIEW portal_users AS
SELECT
    master.user_id::text AS user_id,
    master.user_id::text AS login_id,
    COALESCE(NULLIF(master.user_email, ''), account.email, '')::text AS email,
    COALESCE(master.dept_name, '')::text AS org_name,
    COALESCE(master.user_name, account.user_name, master.user_id)::text AS displayed_name,
    COALESCE(master.jw_nm, '')::text AS job_title,
    CASE WHEN EXISTS (
        SELECT 1
        FROM data_catalog.tb_menu_role menu_role
        WHERE menu_role.menu_role_name = account.menu_role
          AND menu_role.menu_id LIKE 'A%'
    ) THEN 1 ELSE 0 END AS is_admin,
    COALESCE(account.create_date::text, '') AS created_at
FROM data_catalog.vw_account_master master
LEFT JOIN data_catalog.tb_account account
    ON account.user_id = master.user_id;

COMMENT ON VIEW portal_users IS
    'Read-only adapter from Portal accounts to the AI Lounge user projection';

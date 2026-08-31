---
name: role-based-team-workspace-access
description: Use this whenever the user needs to design, adapt, review, or validate role-based access for a small internal team workspace, even if they do not explicitly ask for this skill. Trigger when they mention team accounts, member passwords, administrator-only menus, role permissions, participant-based editing, first-login password changes, audit rules, or separating manager and user access in an internal business platform.
---

## Purpose
This skill guides the design of role-based access for an internal team workspace by separating workspace accounts, member authentication, administrator-only controls, and participation-based permissions; the pattern is reusable across business areas that need lightweight but auditable access flows.

## Required inputs
- User role list, including role IDs, labels, and whether each role is administrative, coordinating, or general-user scope.
- Boundary between administrator and general-user permissions, especially member management, password reset, workspace setup, and report or task visibility.
- Initial password and change policy, including temporary credential delivery, first-login change requirement, minimum length, and reset process.
- Member-level write authentication rule, including whether a member must re-authenticate before submitting or editing assigned work.
- Security audit and privacy handling rules, including which events are logged, which personal fields are stored, retention periods, and export masking.
- Node.js 18+ if using `scripts/validate-access-policy.mjs`; it has no external package dependencies.

## Adaptation guide
Decide the access model before coding. Choose whether login represents a team workspace, an individual user, or both; then map each role to explicit permissions instead of relying on UI visibility alone. Move environment-specific values such as API origins, credential delivery channels, password length, retention periods, and role names into configuration or environment variables.

Before writing code, complete this checklist:
1. Define the canonical role IDs and sort order, then mark which roles can manage members, reset passwords, create work items, close periods, or view aggregated outputs.
2. Define the administrator boundary twice: backend authorization rules for protected endpoints and frontend menu visibility for the same capability set.
3. Specify the first-login flow: temporary credential creation, password hashing, forced change flag, reset behavior, and rejection of reused default passwords.
4. Specify member write authorization: a member can edit only assigned items, self-owned entries, or explicitly delegated items; document whether leaders can edit others' entries.
5. Map participation rules to data relationships such as workspace-member, item-member, item-leader, and entry-owner so access can be checked from stored state.
6. Define state-sensitive exceptions: absence, exclusion, completed periods, deleted members, inactive items, and password reset during an open entry session.
7. Define audit events for login attempts, password changes, role changes, member order changes, participation changes, writes, exclusions, and completion actions.
8. Define output privacy rules for member lists, role labels, report previews, exports, and historical views; remove password hashes and internal flags from public payloads.
9. Create an access policy JSON and run `scripts/validate-access-policy.mjs` before implementation review to catch missing boundaries or unsafe defaults.

## Procedure
1. Prepare an access policy file for the target workspace. To start from an example, run `node skills/role-based-team-workspace-access/scripts/validate-access-policy.mjs --print-example > access-policy.json` and edit the result.
2. Configure the runtime environment with service URLs, allowed origins, and credential storage settings; never place plaintext credentials in source code or client bundles.
3. Run the helper validation before rollout: `node skills/role-based-team-workspace-access/scripts/validate-access-policy.mjs --config access-policy.json --strict`.
4. Execute the adapted workflow by creating the workspace account, forcing any temporary password changes, creating members and roles, assigning members to work items, and enabling only the menus and backend actions permitted by the validated policy.
5. Test access with at least one administrator, one coordinator or lead if used, and one general member; verify that forbidden backend calls fail even if the frontend menu is hidden.
6. Validate the result by confirming the helper exits successfully, password hashes or secrets are never returned in public payloads, admin-only actions are blocked for non-admin roles, and members can write only to authorized assigned items.

## Failure and exception handling
- Duplicate workspace login or member identity: reject creation with a conflict response and require an operator to choose a unique identifier.
- Missing or unknown role: block save operations until the role is mapped to a known configured role ID.
- Temporary password reused or unchanged: reject the password change and keep the must-change flag enabled.
- Unauthorized member write: return a permission error when the entry owner, participant mapping, or delegated role does not match the requested item.
- Hidden-menu bypass attempt: enforce the same permission rule in backend authorization, not only in the frontend route or navigation state.
- Inactive or completed item edit: prevent mutation unless the policy explicitly allows reopening or administrator override, and audit the override.
- Password reset during active work: invalidate active member entry sessions and require re-authentication before the next write.
- Audit write failure: fail closed for sensitive actions such as role changes and password resets; queue or retry lower-risk activity logs if the policy allows it.

## Security and privacy precautions
- Store only salted password hashes; never store or log plaintext temporary or member passwords.
- Deliver initial credentials through an approved out-of-band channel and require change on first use.
- Keep service URLs, API keys, allowed origins, and credential-store settings in environment variables or deployment configuration.
- Return public user and workspace objects without password hashes, reset tokens, internal audit metadata, or unnecessary personal fields.
- Apply least privilege: administrator menus are convenience controls, while backend authorization is the security boundary.
- Treat names, roles, assignments, absences, and work entries as personal or sensitive business data; define retention, masking, export, and deletion rules before rollout.

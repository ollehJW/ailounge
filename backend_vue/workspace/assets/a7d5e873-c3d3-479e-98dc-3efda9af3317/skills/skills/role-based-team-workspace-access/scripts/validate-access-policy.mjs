#!/usr/bin/env node
import fs from 'node:fs';

function usage() {
  console.log(`Validate a role-based team workspace access policy.\n\nUsage:\n  node scripts/validate-access-policy.mjs --config access-policy.json [--strict]\n  node scripts/validate-access-policy.mjs --print-example\n\nFlags:\n  --config <path>     Path to a JSON access policy file.\n  --strict            Treat warnings as errors.\n  --print-example     Print an example policy JSON to stdout.\n  --help              Show this help message.`);
}

const examplePolicy = {
  roles: [
    { id: 'ADMIN', label: 'Workspace administrator', scope: 'workspace' },
    { id: 'LEAD', label: 'Work item lead', scope: 'assigned_items' },
    { id: 'MEMBER', label: 'General member', scope: 'self_and_assigned_items' }
  ],
  adminRoleIds: ['ADMIN'],
  permissions: [
    { id: 'manage_members', adminOnly: true, allowedRoleIds: ['ADMIN'] },
    { id: 'reset_member_password', adminOnly: true, allowedRoleIds: ['ADMIN'] },
    { id: 'manage_workspace_items', adminOnly: false, allowedRoleIds: ['ADMIN', 'LEAD'] },
    { id: 'write_assigned_entry', adminOnly: false, allowedRoleIds: ['LEAD', 'MEMBER'] },
    { id: 'view_aggregate_outputs', adminOnly: false, allowedRoleIds: ['ADMIN', 'LEAD'] }
  ],
  accessRules: {
    workspaceLogin: { accountType: 'team', requiresPassword: true },
    memberWriteAuth: { requiresMemberPassword: true, validFor: 'singleEntrySession' },
    participation: { writeRequiresAssignment: true, leaderCanEditAssignedItems: false }
  },
  initialPasswordPolicy: {
    usesTemporaryPassword: true,
    mustChangeOnFirstLogin: true,
    minLength: 12,
    rotationDays: 0,
    delivery: 'out_of_band'
  },
  audit: {
    logLogin: true,
    logRoleChanges: true,
    logPasswordResets: true,
    logMemberWrites: true,
    logParticipationChanges: true
  },
  privacy: {
    piiFields: ['name', 'role', 'assignment'],
    retentionDays: 365,
    maskInExports: true
  }
};

function parseArgs(argv) {
  const args = { strict: false, printExample: false, help: false, config: '' };
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--strict') args.strict = true;
    else if (arg === '--print-example') args.printExample = true;
    else if (arg === '--help' || arg === '-h') args.help = true;
    else if (arg === '--config') {
      args.config = argv[i + 1] || '';
      i += 1;
    } else {
      throw new Error(`Unknown flag: ${arg}`);
    }
  }
  return args;
}

function isObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value);
}

function validate(policy) {
  const errors = [];
  const warnings = [];

  if (!isObject(policy)) {
    return { errors: ['Policy must be a JSON object.'], warnings };
  }

  const roles = Array.isArray(policy.roles) ? policy.roles : [];
  if (!roles.length) errors.push('roles must contain at least one role.');

  const roleIds = new Set();
  for (const role of roles) {
    if (!isObject(role) || !role.id || typeof role.id !== 'string') {
      errors.push('Each role must be an object with a string id.');
      continue;
    }
    if (roleIds.has(role.id)) errors.push(`Duplicate role id: ${role.id}`);
    roleIds.add(role.id);
    if (!role.label) warnings.push(`Role ${role.id} has no label.`);
    if (!role.scope) warnings.push(`Role ${role.id} has no scope.`);
  }

  const adminRoleIds = Array.isArray(policy.adminRoleIds) ? policy.adminRoleIds : [];
  if (!adminRoleIds.length) errors.push('adminRoleIds must list at least one administrator role.');
  for (const roleId of adminRoleIds) {
    if (!roleIds.has(roleId)) errors.push(`adminRoleIds contains unknown role: ${roleId}`);
  }
  const adminSet = new Set(adminRoleIds);

  const permissions = Array.isArray(policy.permissions) ? policy.permissions : [];
  if (!permissions.length) errors.push('permissions must contain explicit permission rules.');
  for (const permission of permissions) {
    if (!isObject(permission) || !permission.id) {
      errors.push('Each permission must be an object with an id.');
      continue;
    }
    const allowed = Array.isArray(permission.allowedRoleIds) ? permission.allowedRoleIds : [];
    if (!allowed.length) errors.push(`Permission ${permission.id} has no allowedRoleIds.`);
    for (const roleId of allowed) {
      if (!roleIds.has(roleId)) errors.push(`Permission ${permission.id} references unknown role: ${roleId}`);
    }
    if (permission.adminOnly && allowed.some((roleId) => !adminSet.has(roleId))) {
      warnings.push(`Permission ${permission.id} is adminOnly but allows a non-admin role.`);
    }
  }

  const sensitiveNames = ['initialPassword', 'defaultPassword', 'temporaryPassword', 'password'];
  for (const name of sensitiveNames) {
    if (Object.prototype.hasOwnProperty.call(policy, name)) {
      errors.push(`Do not store plaintext credential field at policy root: ${name}`);
    }
  }

  const passwordPolicy = isObject(policy.initialPasswordPolicy) ? policy.initialPasswordPolicy : null;
  if (!passwordPolicy) {
    errors.push('initialPasswordPolicy is required.');
  } else {
    for (const name of sensitiveNames) {
      if (Object.prototype.hasOwnProperty.call(passwordPolicy, name)) {
        errors.push(`Do not store plaintext credential field in initialPasswordPolicy: ${name}`);
      }
    }
    if (passwordPolicy.mustChangeOnFirstLogin !== true) errors.push('initialPasswordPolicy.mustChangeOnFirstLogin must be true.');
    if (typeof passwordPolicy.minLength !== 'number' || passwordPolicy.minLength < 10) {
      warnings.push('initialPasswordPolicy.minLength should be at least 10; 12 or more is preferred.');
    }
    if (!passwordPolicy.delivery) warnings.push('initialPasswordPolicy.delivery should describe an approved delivery channel.');
  }

  const accessRules = isObject(policy.accessRules) ? policy.accessRules : {};
  if (!isObject(accessRules.workspaceLogin) || accessRules.workspaceLogin.requiresPassword !== true) {
    errors.push('accessRules.workspaceLogin.requiresPassword must be true.');
  }
  if (!isObject(accessRules.memberWriteAuth) || accessRules.memberWriteAuth.requiresMemberPassword !== true) {
    errors.push('accessRules.memberWriteAuth.requiresMemberPassword must be true.');
  }
  if (!isObject(accessRules.participation) || accessRules.participation.writeRequiresAssignment !== true) {
    errors.push('accessRules.participation.writeRequiresAssignment must be true.');
  }

  const audit = isObject(policy.audit) ? policy.audit : null;
  const requiredAudit = ['logLogin', 'logRoleChanges', 'logPasswordResets', 'logMemberWrites'];
  if (!audit) {
    errors.push('audit rules are required.');
  } else {
    for (const field of requiredAudit) {
      if (audit[field] !== true) warnings.push(`audit.${field} should be true.`);
    }
  }

  const privacy = isObject(policy.privacy) ? policy.privacy : null;
  if (!privacy) {
    errors.push('privacy rules are required.');
  } else {
    if (!Array.isArray(privacy.piiFields)) errors.push('privacy.piiFields must be an array.');
    if (typeof privacy.retentionDays !== 'number' || privacy.retentionDays <= 0) {
      errors.push('privacy.retentionDays must be a positive number.');
    }
    if (privacy.maskInExports !== true) warnings.push('privacy.maskInExports should be true for member-oriented exports.');
  }

  return { errors, warnings };
}

function main() {
  let args;
  try {
    args = parseArgs(process.argv);
  } catch (error) {
    console.error(error.message);
    usage();
    process.exit(2);
  }

  if (args.help) {
    usage();
    return;
  }
  if (args.printExample) {
    console.log(JSON.stringify(examplePolicy, null, 2));
    return;
  }
  if (!args.config) {
    console.error('Missing required --config <path>.');
    usage();
    process.exit(2);
  }

  let policy;
  try {
    policy = JSON.parse(fs.readFileSync(args.config, 'utf8'));
  } catch (error) {
    console.error(`Failed to read or parse ${args.config}: ${error.message}`);
    process.exit(2);
  }

  const result = validate(policy);
  const strictErrors = args.strict ? result.warnings : [];
  const failed = result.errors.length > 0 || strictErrors.length > 0;

  console.log(JSON.stringify({
    ok: !failed,
    strict: args.strict,
    errors: result.errors,
    warnings: result.warnings,
    summary: failed ? 'Access policy validation failed.' : 'Access policy validation passed.'
  }, null, 2));

  process.exit(failed ? 1 : 0);
}

main();

#!/usr/bin/env node

/**
 * Promote a user to a given role in the local PostgreSQL database.
 *
 * Usage:
 *   npm run promote-admin -- <email-or-id>
 *   npm run promote-role -- <email-or-id> <Role>
 *
 * Examples:
 *   npm run promote-admin -- zacharyleahan@gmail.com
 *   npm run promote-role -- zacharyleahan@gmail.com VolunteerPlus
 *
 * Notes:
 * - Uses `psql` (must be installed and on PATH).
 * - Reads connection info from `.env` in repo root:
 *   POSTGRES_HOST, POSTGRES_PORT, POSTGRES_DATABASE, POSTGRES_USER, POSTGRES_PASSWORD
 */

const { execSync } = require("child_process");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

// Colors for terminal output
const colors = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
};

function log(message, color = "reset") {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function requirePsql() {
  try {
    execSync("psql --version", { stdio: "pipe" });
  } catch {
    log("\n❌ Error: psql command not found!", "red");
    log("   Please ensure PostgreSQL is installed and psql is in your PATH", "red");
    process.exit(1);
  }
}

function validateRole(role) {
  const allowed = new Set(["User", "Admin", "Volunteer", "VolunteerPlus"]);
  if (!allowed.has(role)) {
    log(`\n❌ Error: invalid role '${role}'`, "red");
    log(`Allowed roles: ${Array.from(allowed).join(", ")}`, "blue");
    process.exit(1);
  }
}

function isProbablyEmail(value) {
  return /@/.test(value);
}

function main() {
  const args = process.argv.slice(2);
  const target = (args[0] || "").trim();
  const role = (args[1] || "Admin").trim();

  if (target === "--help" || target === "-h") {
    log("\nUsage:", "blue");
    log("  npm run promote-admin -- <email-or-id>", "blue");
    log("  npm run promote-role -- <email-or-id> <Role>", "blue");
    log("\nExamples:", "blue");
    log("  npm run promote-admin -- zacharyleahan@gmail.com", "blue");
    log("  npm run promote-role -- zacharyleahan@gmail.com VolunteerPlus", "blue");
    process.exit(0);
  }

  if (!target) {
    log("\n❌ Error: email-or-id is required", "red");
    log("\nUsage:", "blue");
    log("  npm run promote-admin -- <email-or-id>", "blue");
    log("  npm run promote-role -- <email-or-id> <Role>", "blue");
    process.exit(1);
  }

  validateRole(role);
  requirePsql();

  const host = process.env.POSTGRES_HOST || "localhost";
  const port = process.env.POSTGRES_PORT || "5432";
  const database = process.env.POSTGRES_DATABASE || "pac";
  const user = process.env.POSTGRES_USER || "pac_user";
  const password = process.env.POSTGRES_PASSWORD;

  if (!password) {
    log("\n❌ Error: POSTGRES_PASSWORD not found in .env", "red");
    log("   Please set POSTGRES_PASSWORD in your .env file", "red");
    process.exit(1);
  }

  // Build an update statement. We keep the identifier controlled (Email vs Id) and
  // defensively reject quotes to avoid SQL injection via command line args.
  if (target.includes("'") || target.includes('"')) {
    log("\n❌ Error: target must not contain quotes", "red");
    process.exit(1);
  }

  const whereClause = isProbablyEmail(target)
    ? `"Email" = '${target}'`
    : `"Id" = '${target}'`;

  // Update Role + ModifiedAt (keep behavior consistent with schema expectations)
  const sql =
    `UPDATE "user" ` +
    `SET "Role" = '${role}', "ModifiedAt" = CURRENT_TIMESTAMP ` +
    `WHERE ${whereClause}; ` +
    `SELECT "Id", "Email", "Role", "Verified" FROM "user" WHERE ${whereClause};`;

  const cmd = `psql -U ${user} -h ${host} -p ${port} -d ${database} -c "${sql.replace(/"/g, '\\"')}"`;

  log("\n🚀 Promoting user...", "green");
  log(`Target: ${target}`, "blue");
  log(`Role:   ${role}`, "blue");
  log(`DB:     ${user}@${host}:${port}/${database}`, "blue");

  try {
    const out = execSync(cmd, {
      stdio: "pipe",
      env: { ...process.env, PGPASSWORD: password },
    }).toString();

    // If no rows matched, psql will still succeed but show (0 rows)
    log("\n✅ Done. Result:", "green");
    process.stdout.write(out);
    log("\nNext: log out + log back in to refresh your cookie role claim.", "yellow");
  } catch (err) {
    log("\n❌ Failed to promote user", "red");
    const stderr = err?.stderr?.toString?.() || err?.message || String(err);
    process.stderr.write(stderr);
    process.exit(1);
  }
}

main();



#!/usr/bin/env node

/**
 * PostgreSQL Setup Script for PAC (Plant Agents Collective)
 * Cross-platform Node.js script to set up PostgreSQL database
 * 
 * Usage: npm run setup:postgres
 * 
 * Requires:
 * - PostgreSQL installed and running
 * - psql command available in PATH
 * - .env.local file with POSTGRES_SUPERUSER and POSTGRES_SUPERUSER_PASSWORD
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

// Colors for terminal output (cross-platform)
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function execCommand(command, description) {
  try {
    log(`\n${description}...`, 'blue');
    execSync(command, { 
      stdio: 'inherit',
      env: { ...process.env, PGPASSWORD: process.env.POSTGRES_SUPERUSER_PASSWORD }
    });
    return true;
  } catch (error) {
    log(`\n❌ ${description} failed!`, 'red');
    return false;
  }
}

function main() {
  log('\n🚀 PostgreSQL Setup for PAC', 'green');
  log('=' .repeat(50), 'blue');

  // Check for required environment variables
  const superuser = process.env.POSTGRES_SUPERUSER || 'postgres';
  const superuserPassword = process.env.POSTGRES_SUPERUSER_PASSWORD;

  if (!superuserPassword) {
    log('\n⚠️  Warning: POSTGRES_SUPERUSER_PASSWORD not found in .env.local', 'yellow');
    log('   Using empty password (may prompt for password)', 'yellow');
  }

  log(`\nUsing superuser: ${superuser}`, 'blue');
  log(`Password: ${superuserPassword ? '***' : '(empty)'}`, 'blue');

  // Check if psql is available
  try {
    execSync('psql --version', { stdio: 'pipe' });
  } catch (error) {
    log('\n❌ Error: psql command not found!', 'red');
    log('   Please ensure PostgreSQL is installed and psql is in your PATH', 'red');
    process.exit(1);
  }

  // Get script directory paths
  const scriptsDir = __dirname;
  const setupScript = path.join(scriptsDir, 'setup_postgres.sql');
  const schemaScript = path.join(scriptsDir, 'setup_postgres_schema.sql');

  // Check if SQL files exist
  if (!fs.existsSync(setupScript)) {
    log(`\n❌ Error: ${setupScript} not found!`, 'red');
    process.exit(1);
  }

  if (!fs.existsSync(schemaScript)) {
    log(`\n❌ Error: ${schemaScript} not found!`, 'red');
    process.exit(1);
  }

  // Step 1: Run main setup script
  const setupCmd = `psql -U ${superuser} -h localhost -f "${setupScript}"`;
  if (!execCommand(setupCmd, 'Running database and user setup')) {
    process.exit(1);
  }

  // Step 2: Run schema setup script
  const schemaCmd = `psql -U ${superuser} -h localhost -d pac -f "${schemaScript}"`;
  if (!execCommand(schemaCmd, 'Running schema setup')) {
    process.exit(1);
  }

  // Success!
  log('\n✅ PostgreSQL setup complete!', 'green');
  log('\nDatabase: pac', 'blue');
  log('User: pac_user', 'blue');
  log('Password: (check scripts/setup_postgres.sql - change "pac_password_change_me")', 'yellow');
  log('\nNext steps:', 'blue');
  log('1. Update the password in scripts/setup_postgres.sql', 'blue');
  log('2. Update your connection string in web/webapi/appsettings.json', 'blue');
  log('3. Run your database migrations', 'blue');
}

// Run the script
main();





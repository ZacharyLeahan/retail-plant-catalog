#!/usr/bin/env node

/**
 * PostgreSQL Migration Runner for PAC (Plant Agents Collective)
 * Cross-platform Node.js script to run database migrations
 * 
 * Usage: npm run migrate
 * 
 * Requires:
 * - PostgreSQL installed and running
 * - psql command available in PATH
 * - Database and user already created (run npm run setup:postgres first)
 * - .env file with POSTGRES_* variables
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

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
      env: { 
        ...process.env, 
        PGPASSWORD: process.env.POSTGRES_PASSWORD 
      }
    });
    return true;
  } catch (error) {
    log(`\n❌ ${description} failed!`, 'red');
    return false;
  }
}

function main() {
  log('\n🚀 Running PostgreSQL Migrations', 'green');
  log('=' .repeat(50), 'blue');

  // Get database connection info from environment
  const host = process.env.POSTGRES_HOST || 'localhost';
  const port = process.env.POSTGRES_PORT || '5432';
  const database = process.env.POSTGRES_DATABASE || 'pac';
  const user = process.env.POSTGRES_USER || 'pac_user';
  const password = process.env.POSTGRES_PASSWORD;

  if (!password) {
    log('\n❌ Error: POSTGRES_PASSWORD not found in .env', 'red');
    log('   Please set POSTGRES_PASSWORD in your .env file', 'red');
    process.exit(1);
  }

  log(`\nDatabase: ${database}`, 'blue');
  log(`User: ${user}`, 'blue');
  log(`Host: ${host}:${port}`, 'blue');

  // Check if psql is available
  try {
    execSync('psql --version', { stdio: 'pipe' });
  } catch (error) {
    log('\n❌ Error: psql command not found!', 'red');
    log('   Please ensure PostgreSQL is installed and psql is in your PATH', 'red');
    process.exit(1);
  }

  // Get migrations directory
  const rootDir = path.join(__dirname, '..');
  const migrationsDir = path.join(rootDir, 'migrations_pg');

  if (!fs.existsSync(migrationsDir)) {
    log(`\n❌ Error: ${migrationsDir} not found!`, 'red');
    process.exit(1);
  }

  // Get all migration files, sorted
  const migrationFiles = fs.readdirSync(migrationsDir)
    .filter(file => file.endsWith('.sql'))
    .sort();

  if (migrationFiles.length === 0) {
    log('\n⚠️  No migration files found!', 'yellow');
    process.exit(0);
  }

  log(`\nFound ${migrationFiles.length} migration file(s)`, 'blue');

  // Run each migration
  for (const file of migrationFiles) {
    const filePath = path.join(migrationsDir, file);
    const cmd = `psql -U ${user} -h ${host} -p ${port} -d ${database} -f "${filePath}"`;
    
    if (!execCommand(cmd, `Running migration: ${file}`)) {
      log(`\n❌ Migration ${file} failed!`, 'red');
      process.exit(1);
    }
  }

  // Success!
  log('\n✅ All migrations completed successfully!', 'green');
  log('\nNext steps:', 'blue');
  log('1. Start the API: cd web/webapi && dotnet run', 'blue');
  log('2. Start the Vue app: cd web/vueapp && npm start', 'blue');
}

// Run the script
main();




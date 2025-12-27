#!/usr/bin/env node

/**
 * Create a user via the API for local development
 * 
 * Usage: node scripts/create-user.js <email> <password>
 * Example: node scripts/create-user.js test@example.com MyPassword123!
 * 
 * This will:
 * 1. Create the user via the API
 * 2. Automatically verify the user in the database (for local dev)
 */

const { execSync } = require('child_process');
const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

// Colors for terminal output
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

function makeRequest(url, data) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const isHttps = urlObj.protocol === 'https:';
    const client = isHttps ? https : http;
    
    // For local dev, ignore SSL certificate errors
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || (isHttps ? 443 : 80),
      path: urlObj.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      },
      rejectUnauthorized: false // For local dev only
    };

    const req = client.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          resolve({ status: res.statusCode, data: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, data: body });
        }
      });
    });

    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function verifyUserInDatabase(email) {
  const host = process.env.POSTGRES_HOST || 'localhost';
  const port = process.env.POSTGRES_PORT || '5432';
  const database = process.env.POSTGRES_DATABASE || 'pac';
  const user = process.env.POSTGRES_USER || 'pac_user';
  const password = process.env.POSTGRES_PASSWORD;

  if (!password) {
    log('\n⚠️  Warning: POSTGRES_PASSWORD not found in .env', 'yellow');
    log('   Skipping database verification. You can manually verify with:', 'yellow');
    log(`   psql -U ${user} -d ${database}`, 'yellow');
    log(`   UPDATE "user" SET "Verified" = true WHERE "Email" = '${email}';`, 'yellow');
    return false;
  }

  try {
    const cmd = `psql -U ${user} -h ${host} -p ${port} -d ${database} -c "UPDATE \\"user\\" SET \\"Verified\\" = true WHERE \\"Email\\" = '${email}';"`;
    execSync(cmd, {
      stdio: 'pipe',
      env: { ...process.env, PGPASSWORD: password }
    });
    return true;
  } catch (error) {
    log('\n⚠️  Could not auto-verify user in database', 'yellow');
    log('   You can manually verify with:', 'yellow');
    log(`   psql -U ${user} -d ${database}`, 'yellow');
    log(`   UPDATE "user" SET "Verified" = true WHERE "Email" = '${email}';`, 'yellow');
    return false;
  }
}

async function main() {
  const email = process.argv[2];
  const password = process.argv[3];

  if (!email || !password) {
    log('\n❌ Error: Email and password required', 'red');
    log('\nUsage: node scripts/create-user.js <email> <password>', 'blue');
    log('Example: node scripts/create-user.js test@example.com MyPassword123!', 'blue');
    process.exit(1);
  }

  // Validate password requirements
  if (password.length < 10) {
    log('\n❌ Error: Password must be at least 10 characters', 'red');
    process.exit(1);
  }

  log('\n🚀 Creating user...', 'green');
  log(`Email: ${email}`, 'blue');

  const apiUrl = process.env.API_URL || 'https://localhost:29324';
  const url = `${apiUrl}/User/Create`;
  
  const payload = JSON.stringify({
    user: {
      email: email,
      password: password
    },
    redirectUrl: '#/login'
  });

  try {
    log(`\nCalling API: ${url}`, 'blue');
    const response = await makeRequest(url, payload);

    if (response.status === 200 && response.data.success) {
      log('\n✅ User created successfully!', 'green');
      log(`User ID: ${response.data.id}`, 'blue');
      
      // Auto-verify for local dev
      log('\nVerifying user in database...', 'blue');
      const verified = await verifyUserInDatabase(email);
      if (verified) {
        log('✅ User verified in database', 'green');
      }

      log('\n✅ You can now login at: https://localhost:5002/#/login', 'green');
    } else if (response.status === 200 && response.data.message && response.data.message.includes('already exists')) {
      // User already exists - verify them anyway
      log('\n⚠️  User already exists', 'yellow');
      log('Verifying user in database...', 'blue');
      const verified = await verifyUserInDatabase(email);
      if (verified) {
        log('✅ User verified in database', 'green');
        log('\n✅ You can now login at: https://localhost:5002/#/login', 'green');
      } else {
        log('\n⚠️  Could not verify user. You may need to verify manually.', 'yellow');
      }
    } else {
      log('\n❌ Failed to create user', 'red');
      log(`Status: ${response.status}`, 'red');
      log(`Response: ${JSON.stringify(response.data, null, 2)}`, 'red');
      process.exit(1);
    }
  } catch (error) {
    log('\n❌ Error calling API', 'red');
    log(`Error: ${error.message}`, 'red');
    log('\nMake sure the API is running:', 'yellow');
    log('  cd web/webapi', 'yellow');
    log('  dotnet run', 'yellow');
    process.exit(1);
  }
}

main();


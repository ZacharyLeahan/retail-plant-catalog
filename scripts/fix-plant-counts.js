#!/usr/bin/env node

/**
 * Fix PlantCount for all vendors by recalculating from vendor_plant associations
 * 
 * Usage: node scripts/fix-plant-counts.js
 */

const path = require("path");
const { Client } = require("pg");

require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

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

async function main() {
  const client = new Client({
    host: process.env.POSTGRES_HOST || "localhost",
    port: parseInt(process.env.POSTGRES_PORT || "5432", 10),
    database: process.env.POSTGRES_DATABASE || "pac",
    user: process.env.POSTGRES_USER || "pac_user",
    password: process.env.POSTGRES_PASSWORD,
  });

  try {
    await client.connect();
    log("\n🔧 Fixing PlantCount for all vendors...", "green");

    // Get all vendors with their actual plant counts
    const result = await client.query(`
      SELECT 
        v."Id",
        v."StoreName",
        v."PlantCount" as current_count,
        COUNT(vp."PlantId")::int as actual_count
      FROM vendor v
      LEFT JOIN vendor_plant vp ON vp."VendorId" = v."Id"
      GROUP BY v."Id", v."StoreName", v."PlantCount"
      ORDER BY v."StoreName"
    `);

    let updated = 0;
    for (const row of result.rows) {
      if (row.current_count !== row.actual_count) {
        await client.query(
          `UPDATE vendor SET "PlantCount" = $1 WHERE "Id" = $2`,
          [row.actual_count, row.id]
        );
        log(
          `  ✓ ${row.StoreName}: ${row.current_count} → ${row.actual_count}`,
          "blue"
        );
        updated++;
      }
    }

    if (updated === 0) {
      log("\n✅ All PlantCount values are correct!", "green");
    } else {
      log(`\n✅ Updated PlantCount for ${updated} vendor(s)`, "green");
    }
  } catch (error) {
    log(`\n❌ Error: ${error.message}`, "red");
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();



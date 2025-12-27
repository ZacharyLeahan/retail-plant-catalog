#!/usr/bin/env node

/**
 * Sync plants from a Google Sheet CSV (MASTER_CSV_URL) into PostgreSQL.
 *
 * Behavior:
 * - Downloads CSV from MASTER_CSV_URL
 * - Parses rows
 * - Upserts into `plant` table using ScientificName as the natural key
 * - Optionally deletes plants not present in the latest sheet (SYNC_DELETE_MISSING=true)
 *
 * Required env:
 * - MASTER_CSV_URL
 * - POSTGRES_HOST, POSTGRES_PORT, POSTGRES_DATABASE, POSTGRES_USER, POSTGRES_PASSWORD
 *
 * Optional env:
 * - SYNC_DELETE_MISSING=true|false
 */

const path = require("path");
const crypto = require("crypto");
const http = require("http");
const https = require("https");
const { Client } = require("pg");
const { parse } = require("csv-parse/sync");

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

function requireEnv(name) {
  const v = (process.env[name] || "").trim();
  if (!v) {
    log(`\n❌ Missing required environment variable: ${name}`, "red");
    process.exit(1);
  }
  return v;
}

function toBool(value, defaultValue = false) {
  if (value == null) return defaultValue;
  const v = String(value).trim().toLowerCase();
  if (["1", "true", "yes", "y", "on"].includes(v)) return true;
  if (["0", "false", "no", "n", "off"].includes(v)) return false;
  return defaultValue;
}

function normalizeHeader(s) {
  return String(s || "").trim();
}

function normalizeValue(s) {
  if (s == null) return "";
  return String(s).trim();
}

function pick(row, keys) {
  for (const k of keys) {
    if (row[k] != null && String(row[k]).trim() !== "") return row[k];
  }
  return "";
}

function isTruthyCell(value) {
  const v = String(value || "").trim().toLowerCase();
  return ["yes", "y", "true", "1"].includes(v);
}

function clampString(s, maxLen) {
  const v = normalizeValue(s);
  if (!maxLen) return v;
  return v.length > maxLen ? v.slice(0, maxLen) : v;
}

function parseScore(value) {
  const v = normalizeValue(value);
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : 0;
}

function requestText(url, maxRedirects = 5) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const lib = urlObj.protocol === "https:" ? https : http;

    const req = lib.request(
      {
        method: "GET",
        hostname: urlObj.hostname,
        port: urlObj.port || (urlObj.protocol === "https:" ? 443 : 80),
        path: `${urlObj.pathname}${urlObj.search || ""}`,
        headers: {
          // Google Sheets CSV export works fine without special headers, but keep UA stable.
          "User-Agent": "retail-plant-catalog-sync/1.0",
          "Accept": "text/csv,text/plain,*/*",
        },
      },
      (res) => {
        const status = res.statusCode || 0;

        // Follow redirects
        if (status >= 300 && status < 400 && res.headers.location) {
          if (maxRedirects <= 0) {
            reject(new Error("Too many redirects fetching CSV"));
            res.resume();
            return;
          }
          const nextUrl = new URL(res.headers.location, urlObj).toString();
          res.resume();
          requestText(nextUrl, maxRedirects - 1).then(resolve, reject);
          return;
        }

        if (status < 200 || status >= 300) {
          let body = "";
          res.setEncoding("utf8");
          res.on("data", (chunk) => (body += chunk));
          res.on("end", () => {
            reject(
              new Error(
                `Failed to fetch CSV. HTTP ${status}. Response: ${body.slice(0, 300)}`
              )
            );
          });
          return;
        }

        let data = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => resolve(data));
      }
    );

    req.on("error", reject);
    req.end();
  });
}

function buildPlantRows(csvText) {
  const records = parse(csvText, {
    columns: (headers) => headers.map(normalizeHeader),
    skip_empty_lines: true,
  });

  const plants = [];

  for (const record of records) {
    // Clean keys and values
    const row = {};
    for (const [k, v] of Object.entries(record)) {
      row[normalizeHeader(k)] = normalizeValue(v);
    }

    const scientificName = normalizeValue(
      pick(row, ["Scientific Name", "ScientificName", "scientificName"])
    );
    const commonName = normalizeValue(
      pick(row, ["Common Name", "CommonName", "commonName"])
    );

    if (!scientificName || !commonName) continue;

    const symbol = normalizeValue(pick(row, ["USDA Symbol", "Symbol", "symbol"]));
    const recommendationScore = parseScore(
      pick(row, ["Recommendation Score", "RecommendationScore", "recommendationScore"])
    );

    const floweringMonths = clampString(
      pick(row, ["Flowering Months", "FloweringMonths", "floweringMonths"]),
      20
    );

    // DB column is VARCHAR(15). CSV is typically numeric; store as trimmed string.
    const heightRaw = pick(row, ["Height (feet)", "Height", "height"]);
    const height = clampString(heightRaw, 15);

    const blurb = clampString(pick(row, ["Blurb", "Description", "blurb"]), 1000);

    const superPlant = isTruthyCell(pick(row, ["Super Plant", "Superplant", "SuperPlant", "superPlant", "Super Plant?"]));
    const showy = isTruthyCell(pick(row, ["Showy", "showy"]));

    const imageUrl = clampString(pick(row, ["imageUrl", "ImageUrl", "Image URL", "Image Url", "image_url"]), 500);
    const hasImage = toBool(pick(row, ["hasImage", "HasImage"]), Boolean(imageUrl));
    const hasPreview = toBool(pick(row, ["hasPreview", "HasPreview"]), false);

    const source = clampString(pick(row, ["source", "Source"]), 30) || "google_sheet";
    const attribution = normalizeValue(pick(row, ["attribution", "Attribution"]));

    plants.push({
      scientificName,
      commonName,
      symbol,
      recommendationScore,
      showy,
      superPlant,
      floweringMonths: floweringMonths || null,
      height: height || null,
      imageUrl: imageUrl || null,
      hasImage,
      hasPreview,
      source: source || null,
      attribution: attribution || null,
      blurb: blurb || null,
    });
  }

  return plants;
}

function makePgClientFromEnv() {
  const host = process.env.POSTGRES_HOST || "localhost";
  const port = parseInt(process.env.POSTGRES_PORT || "5432", 10);
  const database = process.env.POSTGRES_DATABASE || "pac";
  const user = process.env.POSTGRES_USER || "pac_user";
  const password = requireEnv("POSTGRES_PASSWORD");

  return new Client({ host, port, database, user, password });
}

async function main() {
  const masterCsvUrl = requireEnv("MASTER_CSV_URL");
  const deleteMissing = toBool(process.env.SYNC_DELETE_MISSING, false);

  log("\n🌿 Syncing plants from Google Sheet → PostgreSQL", "green");
  log(`CSV: ${masterCsvUrl}`, "blue");
  log(`Delete missing: ${deleteMissing ? "YES" : "no"}`, "blue");

  const csvText = await requestText(masterCsvUrl);
  const plants = buildPlantRows(csvText);

  log(`\nParsed ${plants.length} plant row(s) from CSV`, "blue");
  if (plants.length === 0) {
    log("⚠️  No plants parsed. Check MASTER_CSV_URL and column headers.", "yellow");
    process.exit(1);
  }

  const client = makePgClientFromEnv();
  await client.connect();

  try {
    await client.query("BEGIN");

    // Build a lookup of existing plants keyed by ScientificName
    const existingRes = await client.query(
      `select "Id", "ScientificName" from plant`
    );
    const existingBySci = new Map();
    for (const row of existingRes.rows) {
      existingBySci.set(row.ScientificName, row.Id);
    }

    const insertSql =
      `insert into plant (` +
      `"Id","Symbol","RecommendationScore","Showy","SuperPlant","ScientificName","CommonName","FloweringMonths","Height","ImageUrl","HasImage","HasPreview","Source","Attribution","Blurb"` +
      `) values (` +
      `$1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15` +
      `)`;

    const updateSql =
      `update plant set ` +
      `"Symbol"=$2, "RecommendationScore"=$3, "Showy"=$4, "SuperPlant"=$5, ` +
      `"ScientificName"=$6, "CommonName"=$7, "FloweringMonths"=$8, "Height"=$9, ` +
      `"ImageUrl"=$10, "HasImage"=$11, "HasPreview"=$12, "Source"=$13, "Attribution"=$14, "Blurb"=$15 ` +
      `where "Id"=$1`;

    let inserted = 0;
    let updated = 0;

    for (const p of plants) {
      const id = existingBySci.get(p.scientificName) || crypto.randomUUID();
      const params = [
        id,
        p.symbol || null,
        p.recommendationScore,
        p.showy,
        p.superPlant,
        p.scientificName,
        p.commonName,
        p.floweringMonths,
        p.height,
        p.imageUrl,
        p.hasImage,
        p.hasPreview,
        p.source,
        p.attribution,
        p.blurb,
      ];

      if (existingBySci.has(p.scientificName)) {
        await client.query(updateSql, params);
        updated++;
      } else {
        await client.query(insertSql, params);
        inserted++;
        existingBySci.set(p.scientificName, id);
      }
    }

    if (deleteMissing) {
      const sciNames = plants.map((p) => p.scientificName);
      const delRes = await client.query(
        `delete from plant where not ("ScientificName" = any($1::text[]))`,
        [sciNames]
      );
      log(`Deleted ${delRes.rowCount} plant(s) not in the sheet`, "yellow");
    }

    await client.query("COMMIT");
    log(`\n✅ Done. Inserted: ${inserted}, Updated: ${updated}`, "green");
  } catch (err) {
    try {
      await client.query("ROLLBACK");
    } catch {}
    log("\n❌ Plant sync failed", "red");
    log(err && err.stack ? err.stack : String(err), "red");
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  log("\n❌ Unhandled error", "red");
  log(err && err.stack ? err.stack : String(err), "red");
  process.exit(1);
});



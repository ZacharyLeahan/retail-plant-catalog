-- PostgreSQL Migration: Initial Schema
-- This migration creates all tables for a fresh PostgreSQL database with PostGIS

-- Enable PostGIS extension (should already be enabled, but ensure it)
CREATE EXTENSION IF NOT EXISTS postgis;

-- Create ENUM types
CREATE TYPE user_role AS ENUM ('User', 'Admin', 'Volunteer', 'VolunteerPlus');
CREATE TYPE crawl_status AS ENUM ('Ok', 'UrlParsingError', 'Timeout', 'DnsFailure', 'Missing', 'RobotDenied', 'Redirect', 'None');

-- Migration tracking table
CREATE TABLE IF NOT EXISTS _migrations (
    key VARCHAR(20) NOT NULL PRIMARY KEY,
    hash VARCHAR(50) NOT NULL UNIQUE
);

-- User table
CREATE TABLE IF NOT EXISTS "user" (
    "Id" CHAR(38) NOT NULL PRIMARY KEY,
    "Email" VARCHAR(320) NOT NULL UNIQUE,
    "HashedPassword" VARCHAR(150),
    "Role" user_role NOT NULL DEFAULT 'User',
    "CreatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ModifiedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ApiKey" CHAR(38),
    "Verified" BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_user_email ON "user"("Email");
CREATE INDEX IF NOT EXISTS idx_user_apikey ON "user"("ApiKey");

-- User invite table
CREATE TABLE IF NOT EXISTS user_invite (
    "Id" CHAR(38) NOT NULL PRIMARY KEY,
    "UserId" CHAR(38) NOT NULL,
    "ExpiresAt" TIMESTAMP,
    "Path" VARCHAR(255) DEFAULT '#/login',
    CONSTRAINT fk_user_invite_user FOREIGN KEY ("UserId") REFERENCES "user"("Id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_user_invite_userid ON user_invite("UserId");

-- API Info table
CREATE TABLE IF NOT EXISTS api_info (
    "Id" SERIAL PRIMARY KEY,
    "Name" VARCHAR(60),
    "UserId" CHAR(38) NOT NULL,
    "OrganizationName" VARCHAR(255) NOT NULL,
    "Phone" VARCHAR(16) NOT NULL,
    "Address" VARCHAR(1000) NOT NULL,
    "IntendedUse" TEXT NOT NULL,
    "CreatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "Lng" DECIMAL(10,8) NOT NULL,
    "Lat" DECIMAL(10,8) NOT NULL,
    CONSTRAINT fk_api_info_user FOREIGN KEY ("UserId") REFERENCES "user"("Id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_api_info_userid ON api_info("UserId");

-- Plant table
CREATE TABLE IF NOT EXISTS plant (
    "Id" CHAR(38) NOT NULL PRIMARY KEY,
    "Symbol" VARCHAR(20),
    "RecommendationScore" DECIMAL(10,0) NOT NULL DEFAULT 0,
    "Showy" BOOLEAN NOT NULL DEFAULT FALSE,
    "SuperPlant" BOOLEAN NOT NULL DEFAULT FALSE,
    "ScientificName" VARCHAR(100) NOT NULL,
    "CommonName" VARCHAR(100) NOT NULL,
    "FloweringMonths" VARCHAR(20),
    "Height" VARCHAR(15),
    "ImageUrl" VARCHAR(500),
    "HasImage" BOOLEAN NOT NULL DEFAULT FALSE,
    "HasPreview" BOOLEAN NOT NULL DEFAULT FALSE,
    "Source" VARCHAR(30),
    "Attribution" TEXT,
    "Blurb" VARCHAR(1000)
);

CREATE INDEX IF NOT EXISTS idx_plant_symbol ON plant("Symbol");
CREATE INDEX IF NOT EXISTS idx_plant_scientificname ON plant("ScientificName");
CREATE INDEX IF NOT EXISTS idx_plant_commonname ON plant("CommonName");

-- Plant state junction table
CREATE TABLE IF NOT EXISTS plant_state (
    "Id" SERIAL PRIMARY KEY,
    "State" CHAR(2) NOT NULL,
    "PlantId" CHAR(38) NOT NULL,
    CONSTRAINT fk_plant_state_plant FOREIGN KEY ("PlantId") REFERENCES plant("Id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_plant_state_plantid ON plant_state("PlantId");
CREATE INDEX IF NOT EXISTS idx_plant_state_state ON plant_state("State");

-- Vendor table
CREATE TABLE IF NOT EXISTS vendor (
    "Id" CHAR(38) NOT NULL PRIMARY KEY,
    "UserId" CHAR(38),
    "StoreName" VARCHAR(255),
    "Geo" geography(Point,4326) NOT NULL,
    "Lat" DECIMAL(10,8),
    "Lng" DECIMAL(10,8),
    "Approved" BOOLEAN NOT NULL DEFAULT FALSE,
    "Address" VARCHAR(500),
    "State" CHAR(2),
    "StoreUrl" VARCHAR(500),
    "PublicEmail" VARCHAR(255),
    "PublicPhone" VARCHAR(15),
    "CreatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    "AllNative" BOOLEAN NOT NULL DEFAULT FALSE,
    "IsDeleted" BOOLEAN NOT NULL DEFAULT FALSE,
    "Notes" TEXT,
    "PlantCount" INTEGER DEFAULT 0,
    "LastCrawled" TIMESTAMP,
    "LastChanged" TIMESTAMP,
    "LastCrawlStatus" crawl_status DEFAULT 'None',
    "CrawlErrors" INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_vendor_storename ON vendor("StoreName");
CREATE INDEX IF NOT EXISTS idx_vendor_state_approved ON vendor("State", "Approved");
CREATE INDEX IF NOT EXISTS idx_vendor_userid ON vendor("UserId");
-- GIST index for spatial queries on Geo column
CREATE INDEX IF NOT EXISTS idx_vendor_geo ON vendor USING GIST("Geo");

-- Vendor-Plant junction table
CREATE TABLE IF NOT EXISTS vendor_plant (
    "Id" SERIAL PRIMARY KEY,
    "VendorId" CHAR(38) NOT NULL,
    "PlantId" CHAR(38) NOT NULL,
    CONSTRAINT fk_vendor_plant_vendor FOREIGN KEY ("VendorId") REFERENCES vendor("Id") ON DELETE CASCADE,
    CONSTRAINT fk_vendor_plant_plant FOREIGN KEY ("PlantId") REFERENCES plant("Id") ON DELETE CASCADE,
    CONSTRAINT uk_vendor_plant UNIQUE ("VendorId", "PlantId")
);

CREATE INDEX IF NOT EXISTS idx_vendor_plant_vendorid ON vendor_plant("VendorId");
CREATE INDEX IF NOT EXISTS idx_vendor_plant_plantid ON vendor_plant("PlantId");

-- Vendor URLs table
CREATE TABLE IF NOT EXISTS vendor_urls (
    "Id" CHAR(38),
    "Uri" VARCHAR(500),
    "VendorId" CHAR(38),
    "LastSucceeded" TIMESTAMP,
    "LastFailed" TIMESTAMP,
    "LastStatus" crawl_status DEFAULT 'None',
    CONSTRAINT fk_vendor_urls_vendor FOREIGN KEY ("VendorId") REFERENCES vendor("Id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_vendor_urls_vendorid ON vendor_urls("VendorId");

-- Zip code table
CREATE TABLE IF NOT EXISTS zip (
    "Code" CHAR(5) NOT NULL PRIMARY KEY,
    "Lat" DOUBLE PRECISION NOT NULL,
    "Lng" DOUBLE PRECISION NOT NULL,
    "City" VARCHAR(255),
    "State" CHAR(2) NOT NULL,
    "StateFull" VARCHAR(255),
    "Population" INTEGER,
    "CountyFips" INTEGER,
    "CountyName" VARCHAR(255),
    "Geo" geography(Point,4326)
);

-- GIST index for spatial queries on Geo column
CREATE INDEX IF NOT EXISTS idx_zip_geo ON zip USING GIST("Geo");
CREATE INDEX IF NOT EXISTS idx_zip_state ON zip("State");

-- Function to update vendor Geo from Lat/Lng
CREATE OR REPLACE FUNCTION update_vendor_geo()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW."Lat" IS NOT NULL AND NEW."Lng" IS NOT NULL THEN
        NEW."Geo" := ST_SetSRID(ST_MakePoint(NEW."Lng"::double precision, NEW."Lat"::double precision), 4326)::geography;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update vendor Geo on INSERT
CREATE TRIGGER update_vendor_geo_insert
    BEFORE INSERT ON vendor
    FOR EACH ROW
    EXECUTE FUNCTION update_vendor_geo();

-- Trigger to update vendor Geo on UPDATE
CREATE TRIGGER update_vendor_geo_update
    BEFORE UPDATE ON vendor
    FOR EACH ROW
    EXECUTE FUNCTION update_vendor_geo();

-- Function to update zip Geo from Lat/Lng
CREATE OR REPLACE FUNCTION update_zip_geo()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW."Lat" IS NOT NULL AND NEW."Lng" IS NOT NULL THEN
        NEW."Geo" := ST_SetSRID(ST_MakePoint(NEW."Lng"::double precision, NEW."Lat"::double precision), 4326)::geography;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update zip Geo on INSERT
CREATE TRIGGER update_zip_geo_insert
    BEFORE INSERT ON zip
    FOR EACH ROW
    EXECUTE FUNCTION update_zip_geo();

-- Trigger to update zip Geo on UPDATE
CREATE TRIGGER update_zip_geo_update
    BEFORE UPDATE ON zip
    FOR EACH ROW
    EXECUTE FUNCTION update_zip_geo();




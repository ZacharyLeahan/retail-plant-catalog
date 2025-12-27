-- PostgreSQL Setup Script for PAC (Plant Agents Collective)
-- 
-- RECOMMENDED: Use the npm script (cross-platform):
--   npm install  (first time only)
--   npm run setup:postgres
--
-- This will automatically:
--   1. Read credentials from .env.local
--   2. Run this script and setup_postgres_schema.sql
--   3. Set up the database, user, and PostGIS extension
--
-- MANUAL: To run this script manually:
--   psql -U postgres -h localhost -f scripts/setup_postgres.sql
--   (will prompt for password)
--
-- Note: The script itself doesn't authenticate - you authenticate when running psql
-- The .env.local file should contain: POSTGRES_SUPERUSER and POSTGRES_SUPERUSER_PASSWORD

-- 1. Create the application database
CREATE DATABASE pac;

-- 2. Create a dedicated user for the application
CREATE USER pac_user WITH PASSWORD 'pac_password_change_me';

-- 3. Grant privileges on the database
GRANT ALL PRIVILEGES ON DATABASE pac TO pac_user;

-- Note: The following commands need to run while connected to the 'pac' database
-- If running via psql, you can either:
--   A) Run this script, then manually: \c pac and run the rest
--   B) Split into two scripts (this one, then setup_postgres_schema.sql)
--   C) Use: psql -U postgres -d pac -f scripts/setup_postgres_schema.sql

-- For now, connect to pac database first, then run:
-- \c pac

-- 4. Grant schema privileges (PostgreSQL 15+ requires this)
-- GRANT ALL ON SCHEMA public TO pac_user;

-- 5. Enable PostGIS extension (required for spatial queries)
-- CREATE EXTENSION IF NOT EXISTS postgis;

-- 6. Set default privileges for future tables
-- ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO pac_user;
-- ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO pac_user;

-- Done! Now you can use:
-- Host=localhost;Port=5432;Database=pac;Username=pac_user;Password=pac_password_change_me;





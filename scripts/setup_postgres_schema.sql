-- PostgreSQL Schema Setup Script for PAC
-- Run this AFTER setup_postgres.sql
-- This must be run while connected to the 'pac' database
--
-- To run:
--   psql -U postgres -d pac -f scripts/setup_postgres_schema.sql
--   (or: psql -U postgres, then: \c pac, then: \i scripts/setup_postgres_schema.sql)

-- 1. Grant schema privileges (PostgreSQL 15+ requires this)
GRANT ALL ON SCHEMA public TO pac_user;

-- 2. Enable PostGIS extension (required for spatial queries)
CREATE EXTENSION IF NOT EXISTS postgis;

-- 3. Set default privileges for future tables
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO pac_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO pac_user;

-- Done! The pac_user can now create tables and use PostGIS functions.






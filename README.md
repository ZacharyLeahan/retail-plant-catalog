# Retail Plant Catalog

This repository contains the source code for the Plant Agents Collective API and web application, which powers both the **staging** and **production** environments.

## Environments

This codebase is deployed to two environments:

- **Production**: [https://app.plantagents.org](https://app.plantagents.org)
  - API Documentation: [https://app.plantagents.org/swagger/index.html](https://app.plantagents.org/swagger/index.html)
  
- **Staging**: [https://pac-stage.savvyotter.com](https://pac-stage.savvyotter.com)
  - API Documentation: [https://pac-stage.savvyotter.com/swagger/index.html](https://pac-stage.savvyotter.com/swagger/index.html)

## Project Overview

The Plant Agents Collective (PAC) project allows vendors to be added and maintained by administrators. The system parses vendor websites to determine which native plants they currently have in inventory.

## Technology Stack

* C# .NET Core MVC
* Vue.js
* PostgreSQL + PostGIS via Dapper
* Node.js

## Local Development

### Prerequisites
- .NET 8.0 SDK
- Node.js
- PostgreSQL (with PostGIS extension)

### Quick Start

1. **Set up database:**
   ```bash
   npm install
   npm run setup:postgres
   ```

2. **Run database migrations:**
   ```bash
   npm run migrate
   ```

3. **Configure database connection** in `.env` (in the root directory):
   ```env
   POSTGRES_HOST=localhost
   POSTGRES_PORT=5432
   POSTGRES_DATABASE=pac
   POSTGRES_USER=pac_user
   POSTGRES_PASSWORD=your_password
   ```
   
   Replace `your_password` with the password from `setup_postgres.sql` (default: `pac_password_change_me`).

4. **Run the API** (Terminal 1):
   ```bash
   cd web/webapi
   dotnet run --launch-profile webapi
   ```
   API runs on `https://localhost:29324`

5. **Run Vue app** (Terminal 2):
   ```bash
   cd web/vueapp
   npm install  # first time only
   npm start
   ```
   Vue app runs on `https://localhost:5002`

6. **Open browser:** `https://localhost:5002`

### Populate Plants (from Google Sheet)

The crawler needs `plant` rows populated so it has a term list (symbol + scientific/common names) to search for.

1. Add to your root `.env`:

```bash
MASTER_CSV_URL="<google-sheets-csv-export-url>"
POSTGRES_PASSWORD="pac_password_change_me"
```

2. Install root deps (if you haven’t already):

```bash
npm install
```

3. Sync plants into Postgres:

```bash
npm run sync:plants
```

Optional: to delete plants that are not present in the sheet:

```bash
SYNC_DELETE_MISSING=true npm run sync:plants
```

### Creating a User

After the app is running, you can create a user via:

1. **Using the helper script** (easiest for local dev):
   ```bash
   npm run create-user your-email@example.com YourPassword123!
   ```
   This will create the user and automatically verify it in the database.

2. **Swagger API**:
   - Go to: `https://localhost:29324/swagger`
   - Select "API V2" from the dropdown at the top
   - Find `/User/Create` endpoint (under User controller)
   - Click "Try it out"
   - Use JSON:
     ```json
     {
       "user": {
         "email": "your-email@example.com",
         "password": "YourPassword123!"
       },
       "redirectUrl": "#/login"
     }
     ```
   - After creating, manually verify in database:
     ```sql
     psql -U pac_user -d pac
     UPDATE "user" SET "Verified" = true WHERE "Email" = 'your-email@example.com';
     ```

3. **Or use the UI** at `https://localhost:5002/#/user-create` (requires email verification setup)

**Note:** Password requirements: at least 10 characters, 1 uppercase, 1 lowercase, 1 digit, 1 symbol (!@$#%^&*())

**Note:** If API runs on a different port, update `proxyDestination` in `web/vueapp/vue.config.js`

## Project Structure

* See README.md in sub projects for detailed information about each component.

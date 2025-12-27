# Scripts

Utility scripts for testing and development.

## Setup

### Quick Setup (Recommended)

**Windows (PowerShell):**
```powershell
cd scripts
.\setup_venv.ps1
```

**Linux/Mac:**
```bash
cd scripts
chmod +x setup_venv.sh
./setup_venv.sh
```

### Manual Setup

1. Create a virtual environment:
   ```bash
   python -m venv venv
   ```

2. Activate the virtual environment:
   - **Windows (PowerShell):**
     ```powershell
     .\venv\Scripts\Activate.ps1
     ```
   - **Windows (CMD):**
     ```cmd
     venv\Scripts\activate.bat
     ```
   - **Linux/Mac:**
     ```bash
     source venv/bin/activate
     ```

3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

## Running Scripts

**Important:** Make sure the virtual environment is activated before running scripts.

**Windows (PowerShell):**
```powershell
.\venv\Scripts\Activate.ps1
python test_auth.py
```

**Linux/Mac:**
```bash
source venv/bin/activate
python test_auth.py
```

## Scripts

### test_auth.py

Tests Bearer token authentication with the Plant Agents Collective API using credentials from the `.env` file in the project root.

**Usage:**
```bash
python test_auth.py
```

**Requirements:**
- `.env` file in the project root with `PAC_STAGE_API_BASE_URL` and `PAC_STAGE_API_KEY` set
- Creating vendors requires **cookie auth** (same as the UI). Set:
  - `PAC_EMAIL` and `PAC_PASSWORD` (or pass `--pac-email` / `--pac-password`)

### create_vendor_from_openai.py

Extracts vendor details for a nursery (name or URL), checks for duplicates in PAC using `Vendor/FindByState` + `Vendor/FindById`, geocodes via `Geo/ValidateAddress`, then shows a **preview** and only creates the vendor via `POST /Vendor/CreateClient` after confirmation.

**Usage:**
```bash
python create_vendor_from_openai.py "Some Nursery Name"
python create_vendor_from_openai.py "https://example.com"

# Nevada example (dry-run)
python create_vendor_from_openai.py "native plant nursery in Nevada" --state NV --dry-run
```

**Common flags:**
- `--dry-run`: Show preview + payload, but do not POST
- `--yes`: Auto-confirm prompts
- `--refresh-cache`: Refresh the per-state vendor cache from PAC
- `--skip-duplicates`: Skip when a possible duplicate is found (definite duplicates are always skipped)
- `--batch <file.json>`: Process a JSON array of entries (each object should have `storeUrl` or `storeName`, and optionally `state`)
- `--verify-urls / --no-verify-urls`: Verify plant listing URLs over HTTP and drop 404/invalid URLs before create/update (default: verify)

**Outputs:**
- `scripts/cache/vendor_cache_{host}_{STATE}.json`: per-state vendor cache
- `scripts/incomplete_vendors.jsonl`: incomplete/skipped/error records (JSONL)

### import_growitbuildit.py

Parses GrowItBuildIt's "Where To Buy Native Plants In The United States" page into a JSON array of entries you can feed into `create_vendor_from_openai.py --batch`.

**Usage:**
```bash
# all states
python import_growitbuildit.py --output growit_all.json

# one state
python import_growitbuildit.py --state NV --output growit_nv.json

# then (dry-run batch)
python create_vendor_from_openai.py --batch growit_nv.json --dry-run --yes --skip-duplicates
```

### cleanup_vendor_urls.py

Cleans up existing vendors by removing `plantListingUrls` that 404 / are invalid, with a preview step.

**Usage:**
```bash
# One vendor
python cleanup_vendor_urls.py --vendor-id <VENDOR_ID> --dry-run
python cleanup_vendor_urls.py --vendor-id <VENDOR_ID> --yes

# Whole state
python cleanup_vendor_urls.py --state CA --dry-run
python cleanup_vendor_urls.py --state CA --yes
```

### discover_nurseries.py

Discovery-only helper that uses OpenAI web search to list candidate nurseries for a state.

**Usage:**
```bash
python discover_nurseries.py --state NV --limit 10 --output discovered_nv.json
```

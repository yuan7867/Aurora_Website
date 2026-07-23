# Aurora Update Platform V1

Aurora Update Platform provides one shared update flow for Aurora MT5 AI Trader
and Aurora XAU Trader. Future Aurora products should reuse the same API,
manifest format and `Aurora_Update` client library.

## Runtime Flow

1. Product starts.
2. License initializes.
3. Product calls `GET https://aurorahy.com/api/update/latest/{product}`.
4. Commerce API reads the private R2 `version.json`.
5. Commerce API returns the latest version and short-lived R2 download URL.
6. The Aurora updater downloads the EXE, verifies SHA256, replaces the product
   executable and restarts the product.

Supported products:

- `mt5`
- `xau`

## Update API

```http
GET /api/update/latest/mt5
GET /api/update/latest/xau
```

Response:

```json
{
  "product": "mt5",
  "version": "2.4.1",
  "minimum_version": "2.3.8",
  "force_update": false,
  "release_date": "2026-07-23",
  "sha256": "...",
  "download_url": "...",
  "release_notes": [
    "Improved Exit Engine",
    "Performance Optimisation"
  ]
}
```

`download_url` is a temporary Cloudflare R2 presigned URL. It is not GitHub,
Google Drive or a public website static file.

## R2 Manifest

Private R2 objects:

- `updates/mt5/version.json`
- `updates/xau/version.json`

Manifest fields stored in R2:

```json
{
  "product": "mt5",
  "version": "2.4.1",
  "minimum_version": "2.3.8",
  "force_update": false,
  "release_date": "2026-07-23",
  "sha256": "...",
  "object_key": "releases/aurora-mt5-ai-trader/2.4.1/Aurora_MT5_AI_Trader.exe",
  "filename": "Aurora_MT5_AI_Trader.exe",
  "release_notes": []
}
```

## GitHub Actions

Workflow:

```text
.github/workflows/aurora-update-release.yml
```

Required GitHub Secrets:

- `R2_ACCOUNT_ID`
- `R2_BUCKET`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`

The workflow uploads the EXE to R2, computes SHA256 and updates the product
`version.json`.

For Git Push automation, commit the EXE and this release manifest under
`Aurora_Releases/`:

```json
{
  "product": "mt5",
  "version": "2.4.1",
  "minimum_version": "2.3.8",
  "force_update": false,
  "release_date": "2026-07-23",
  "artifact_path": "Aurora_Releases/Aurora_MT5_AI_Trader.exe",
  "release_notes": "Improved Exit Engine;Performance Optimisation"
}
```

## Client Library

Shared library:

```text
Aurora_Update/
```

Modules:

- `update_client.py`
- `update_service.py`
- `update_dialog.py`
- `sha256.py`
- `version_compare.py`

Products should use an independent `Aurora Updater.exe` wrapper. The product
EXE should not overwrite itself while running.

## Rollback

`UpdateService.replace_exe()` moves the current EXE to `.bak` before replacing
it. If replacement fails, the previous EXE is restored.

This phase does not modify License, Trading Engine, Entry, Exit, Strategy,
Payment or Customer Dashboard logic.

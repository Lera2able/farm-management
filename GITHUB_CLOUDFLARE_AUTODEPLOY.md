# GitHub to Cloudflare auto deploy

This repo is set up to deploy to Cloudflare automatically on every push to `main`.

## GitHub Actions workflow

Workflow file:

- `.github/workflows/deploy-cloudflare.yml`

It does this:

1. Checks out the repo
2. Installs dependencies with `npm ci`
3. Builds the deploy bundle with `npm run build:cloudflare`
4. Deploys with `cloudflare/wrangler-action@v3`

## Required GitHub repository secrets

Add these in GitHub:

`Settings` -> `Secrets and variables` -> `Actions` -> `New repository secret`

Create:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

Use this account ID for Khumotaka:

- `e1634d61290c9b92907e2d1012a684c7`

## Recommended token permissions

For the Cloudflare API token, use the Khumotaka Cloudflare account and grant:

- `Account` -> `Workers Scripts` -> `Edit`
- `Account` -> `Account Settings` -> `Read`
- `Zone` -> `Zone` -> `Read`
- `Zone` -> `DNS` -> `Edit`
- `Zone` -> `Workers Routes` -> `Edit`

Scope it to:

- the Khumotaka Cloudflare account
- the `khumotaka.co.za` zone

## After secrets are added

Any push to `main` will redeploy automatically.

You can also trigger a manual deployment from:

- `GitHub` -> `Actions` -> `Deploy to Cloudflare` -> `Run workflow`

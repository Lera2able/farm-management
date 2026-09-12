# Khumotaka Supabase setup

This repo now includes replacement Edge Function code for the new Khumotaka Supabase project.

## What is included

- `supabase/functions/farm-admin/index.ts`
- `supabase/functions/farm-ocr/index.ts`
- `supabase/functions/farm-voice/index.ts`
- `supabase/functions/farm-notify/index.ts`
- `supabase/functions/.env.example`

## SQL to run

Run these in the new Supabase project's SQL Editor:

1. `khumotaka-migration/04_run_in_supabase_sql_editor.sql`
2. `khumotaka-migration/05_enable_app_access.sql`
3. `khumotaka-migration/07_owner_backend.sql`

## Required secrets

Set these in Supabase `Project Settings` → `Edge Functions` → `Secrets`.

Required for all functions:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `FARM_PASSWORD_PEPPER`
- `FARM_BOOTSTRAP_PASSWORD`

Useful defaults:

- `FARM_BOOTSTRAP_NAME=Khumotaka Owner`
- `FARM_BOOTSTRAP_ROLE=supersuper`

Email function:

- `RESEND_API_KEY`
- `FARM_NOTIFY_FROM`
- `FARM_NOTIFY_TO`

OCR / voice functions:

- `OPENAI_API_KEY`
- `OPENAI_BASE_URL`
- `OPENAI_VISION_MODEL`
- `OPENAI_TEXT_MODEL`
- `OPENAI_TRANSCRIBE_MODEL`

## Deploy order

If you are using the Supabase CLI:

1. Link the repo to the new project.
2. Set the secrets from `.env.example`.
3. Deploy:
   - `supabase functions deploy farm-admin`
   - `supabase functions deploy farm-notify`
   - `supabase functions deploy farm-ocr`
   - `supabase functions deploy farm-voice`

## Notes

- `farm-admin` supports:
  - password login
  - 3-day owner sessions
  - supersuper account management
  - lineage updates
  - calf registration
  - comments
  - audit trail
  - shared attendance
  - shared sick/dead state

- `farm-notify` sends attendance emails using Resend.
- `farm-ocr` reads tag numbers and an optional date from a photo using an OpenAI-compatible vision API.
- `farm-voice` transcribes a voice note and extracts numbers plus an optional date.

## First login

The first successful login can be created automatically from:

- `FARM_BOOTSTRAP_PASSWORD`
- `FARM_BOOTSTRAP_NAME`
- `FARM_BOOTSTRAP_ROLE`

If `farm_owner_users` is empty, `farm-admin` creates this bootstrap account on first login attempt.

## Important limitation

I reconstructed this backend from the frontend contract because the original Edge Function source was not in the repo. This replacement should match the current app behavior closely, but it is still a rebuilt version rather than an exact copy of the old server code.

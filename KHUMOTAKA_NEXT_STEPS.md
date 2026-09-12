# Khumotaka next steps

This is the shortest path to get the migrated farm system fully working.

## Supabase first

### 1. Run the backend SQL

In the new Supabase project SQL Editor, run:

1. `khumotaka-migration/04_run_in_supabase_sql_editor.sql`
2. `khumotaka-migration/05_enable_app_access.sql`
3. `khumotaka-migration/07_owner_backend.sql`

### 2. Add Edge Function secrets

Open Supabase:

- `Project Settings` → `Edge Functions` → `Secrets`

Add these values:

#### Required

- `SUPABASE_URL=https://thgtdaxnsobxgykvzhni.supabase.co`
- `SUPABASE_SERVICE_ROLE_KEY=<copy from Supabase API settings>`
- `FARM_PASSWORD_PEPPER=<a long random secret phrase>`
- `FARM_BOOTSTRAP_PASSWORD=<the owner login password you want to use>`

#### Recommended

- `FARM_BOOTSTRAP_NAME=Khumotaka Owner`
- `FARM_BOOTSTRAP_ROLE=supersuper`

#### Only if you want email notifications

- `RESEND_API_KEY=<your Resend key>`
- `FARM_NOTIFY_FROM=<verified sender address>`
- `FARM_NOTIFY_TO=<comma-separated recipient emails>`

#### Only if you want OCR and voice

- `OPENAI_API_KEY=<your OpenAI-compatible API key>`
- `OPENAI_BASE_URL=https://api.openai.com/v1`
- `OPENAI_VISION_MODEL=gpt-4.1-mini`
- `OPENAI_TEXT_MODEL=gpt-4.1-mini`
- `OPENAI_TRANSCRIBE_MODEL=gpt-4o-mini-transcribe`

### 3. Deploy the functions

If you have Supabase CLI on your own computer:

```powershell
supabase login
supabase link --project-ref thgtdaxnsobxgykvzhni
supabase functions deploy farm-admin
supabase functions deploy farm-notify
supabase functions deploy farm-ocr
supabase functions deploy farm-voice
```

Deploy `farm-admin` first.

### 4. First tests

After deploying, test these in order:

1. Open `index.html` / the site home page
2. Enter the bootstrap password
3. Confirm the app opens
4. Confirm herd rows load
5. Log in as owner in the owner panel
6. Add a comment to one animal
7. Register one test calf if needed
8. Save one attendance record

If email is not configured yet, the rest of the app can still work.

## Cloudflare next

### Recommended use of Cloudflare

Use Cloudflare to host the frontend and protect the site.

Recommended stack:

- `Cloudflare Workers Static Assets` for the frontend
- `Supabase` for database and Edge Functions
- optional `Cloudflare Turnstile` later for extra login abuse protection

### Why this is the right fit

- the current app is mostly static frontend files
- Supabase is already the active backend
- Cloudflare gives fast global delivery and simple hosting
- you avoid doing another backend migration right now

### Cloudflare deployment path

1. Keep this GitHub repo as the source
2. Create a new Cloudflare Worker with static assets
3. Connect it to the repo
4. Deploy the site from `main`
5. Add your custom domain in Cloudflare
6. Keep the frontend calling Supabase at `https://thgtdaxnsobxgykvzhni.supabase.co`

## Recommended order

1. Finish Supabase SQL
2. Add Supabase secrets
3. Deploy `farm-admin`
4. Test owner login
5. Deploy `farm-notify`, `farm-ocr`, `farm-voice`
6. Test all app features
7. Put the frontend on Cloudflare
8. Add domain and security polish

## Important note

The new backend code is a rebuilt version based on the frontend behavior because the original Supabase function source was not in the repo.

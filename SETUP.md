# Member Login & Curriculum Gating — Setup Checklist

The code is scaffolded with placeholders. Nothing works until you complete these steps.

## 1. Create the Supabase project
1. Go to https://supabase.com, sign up (free), and create a new project.
2. In **Project Settings > API**, copy:
   - **Project URL** → used as `SUPABASE_URL`
   - **anon public key** → goes directly into `index.html` (see step 5)
   - **service_role key** → used as `SUPABASE_SERVICE_ROLE_KEY` (server-side only, never in `index.html`)
3. In **Project Settings > Auth > Email**, confirm "Enable email confirmations" / invite emails are on (default). Members log in with a password they set from an emailed invite link.
4. Open **SQL Editor**, paste the contents of `sql/schema.sql`, and run it. This creates the `subscribers` table.

## 2. Create the private storage bucket
1. Go to **Storage** in the Supabase dashboard, create a bucket named `curriculum`.
2. Leave it **private** (not public) — this is what makes files inaccessible without going through the API.
3. Upload your curriculum PDFs, matching the folder/file paths listed in `config/curriculum-files.json` (edit that file's `path` values to match whatever you actually upload).

## 3. Set up the Stripe webhook
Your existing Stripe Payment Links already work fine for checkout — no change needed there.
1. In the Stripe dashboard, go to **Developers > Webhooks > Add endpoint**.
2. Endpoint URL: `https://YOUR-DOMAIN/api/stripe-webhook`
3. Subscribe to these events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`.
4. Copy the **Signing secret** (`whsec_...`) → used as `STRIPE_WEBHOOK_SECRET`.
5. Copy your **Secret key** from **Developers > API keys** → used as `STRIPE_SECRET_KEY`.

## 4. Set environment variables in Vercel
In your Vercel project (Settings > Environment Variables), add everything listed in `.env.example` with your real values:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `SUPABASE_STORAGE_BUCKET` (`curriculum`)
- `SITE_URL` (e.g. `https://www.buildkidsfaith.com`)

Redeploy after adding them.

## 5. Fill in the client-side Supabase keys in `index.html`
Near the bottom of `index.html`, replace:
```js
const SUPABASE_URL = 'https://YOUR-PROJECT-REF.supabase.co';
const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY';
```
with your real Project URL and **anon public key** (not the service role key — the anon key is meant to be public).

## 6. Prevent the free-tier project from pausing
1. In your GitHub repo, go to **Settings > Secrets and variables > Actions**.
2. Add secrets `SUPABASE_URL` and `SUPABASE_ANON_KEY` (same values as above).
3. The workflow at `.github/workflows/supabase-keepalive.yml` will ping the project automatically every 4 days, so it never auto-pauses from inactivity — even with zero site traffic.

## 7. Test end to end
1. Run through checkout yourself with a Stripe test-mode card.
2. Confirm the webhook fires (Stripe dashboard > Webhooks > your endpoint > recent deliveries) and a row appears in the `subscribers` table.
3. Check the email inbox for the Supabase invite email, set a password.
4. Log in on the site via "Member Login," confirm the Members section appears and Download buttons return real files.
5. Cancel the test subscription in Stripe and confirm downloads stop working (status flips to `canceled`).

## Notes
- `config/curriculum-files.json` is the allowlist of downloadable files — the API will never serve a file that isn't listed there, even if someone tampers with the request.
- Signed download URLs expire after 5 minutes, so they can't be usefully shared around.
- To add a new file later: upload it to the `curriculum` bucket and add an entry to `config/curriculum-files.json` (and mirror it in the `files` object inside `index.html`'s script, used for display).

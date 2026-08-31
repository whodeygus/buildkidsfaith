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
3. Upload every file listed in `config/curriculum-files.json`, matching its `path` values exactly. That file is auto-generated to cover the full catalog, so the folder layout is:
   - `Month 1/curriculum-pack.pdf` ... `Month 12/curriculum-pack.pdf`, `Bonus Month/curriculum-pack.pdf` — the 13 full Curriculum Pack PDFs (Younger Kids)
   - `Month 1/week-01-story-slides.pptx` through `week-04-story-slides.pptx` (and so on per month), `Bonus Month/week-49-story-slides.pptx` through `week-52-story-slides.pptx` — the 52 weekly Story Slides decks (Younger Kids)
   - `Month 1/student-edition-pack.pdf` ... `Month 12/student-edition-pack.pdf`, `Bonus Month/student-edition-pack.pdf` — the 13 Student Edition packs (Grades 6-12), one per month, sitting in the same month folder as that month's Younger Kids pack

   78 files total. Folder names are `Month 1`...`Month 12` and `Bonus Month` (capitalized, with a space) — that's what actually exists in Storage, so `config/curriculum-files.json` was generated to match rather than the other way around. The Student Edition pack for a given month shares that month's `month` number in `curriculum-files.json`, so it unlocks on the exact same drip schedule as the Younger Kids pack for that month — there's no separate price, tier, or gate for it; every active subscriber (monthly or annual) gets both tracks together. If you ever add a new month, regenerate `config/curriculum-files.json` (or edit it by hand) using that same folder naming rather than editing `index.html`'s catalog directly — the site's `buildCatalog()` function only derives the display key/label pattern, not the Storage path, so it doesn't need to change.

## 2a. How access is gated (monthly drip vs. annual)
- **Annual subscribers** see the entire catalog immediately — they already paid for the full year.
- **Monthly subscribers** unlock one content month per completed billing cycle, starting at Month 1 the day they subscribe (tracked in `subscribers.months_unlocked`). This means a single month's payment can only ever access that one month's files, not the whole library — cancelling stops any further unlocks.
- This is enforced server-side in `api/get-download-url.js` regardless of what the browser shows, so it can't be bypassed by editing client-side code.
- The Stripe webhook (`customer.subscription.updated`) is what advances `months_unlocked` — it fires automatically when Stripe renews a subscription and its billing period moves forward, so no extra Stripe event subscription is needed beyond what's listed in step 3.

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
1. Run through checkout yourself with a Stripe test-mode card, once on the monthly link and once on the annual link.
2. Confirm the webhook fires (Stripe dashboard > Webhooks > your endpoint > recent deliveries) and a row appears in the `subscribers` table with the correct `plan` and `months_unlocked = 1`.
3. Check the email inbox for the Supabase invite email, set a password.
4. Log in on the site via "Member Login": the monthly test account should show only Month 1 unlocked (everything else shown locked); the annual test account should show all 13 months unlocked immediately. Confirm Download buttons on unlocked months return real files.
5. To verify the monthly drip advances, use a [Stripe test clock](https://stripe.com/docs/billing/testing/test-clocks) to fast-forward the monthly test subscription past its renewal date, then confirm the webhook fires again and `months_unlocked` increments to 2 (Month 2 becomes downloadable).
6. Cancel the test subscription in Stripe and confirm downloads stop working entirely (status flips to `canceled`).

## Notes
- `config/curriculum-files.json` is the allowlist of downloadable files, each tagged with the content `month` it belongs to — the API will never serve a file that isn't listed there, and never serves a file whose month is beyond what that subscriber has unlocked, even if someone tampers with the request.
- Signed download URLs expire after 5 minutes, so they can't be usefully shared around.
- To add a new month later: upload its files to the `curriculum` bucket following the same `Month NN/curriculum-pack.pdf` + `week-NN-story-slides.pptx` + `Month NN/student-edition-pack.pdf` pattern, add matching entries to `config/curriculum-files.json`, and bump `TOTAL_MONTHS` in `index.html`'s `buildCatalog()` to match. Both the server-side gate (`config/total-months.js`) and the client-side display derive the month count from those two spots, so there's no separate list of files to hand-maintain.

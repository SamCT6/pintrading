# Pinfolio

Pinfolio is a responsive React + Vite app for managing a pin collection, tracking wishlists, finding other collectors, and proposing trades. It uses Supabase Auth, Postgres, Row Level Security (RLS), Storage, and Edge Functions.

## What is implemented

- Email/password sign-up, sign-in, and sign-out using Supabase Auth.
- Cloud-saved pin collection with add/search/create, quantity owned, tradeable quantity, purchase cost, authenticity status, notes, personal photos, and per-pin visibility.
- Collection visibility: **Private**, **Friends**, or **Public**. Private rows are only readable by their owner. Shared trader listings are returned through a narrow database function so other users do not receive your private notes or purchase costs. Uploaded photos use a private Storage bucket and short-lived signed URLs, with access tied to the owning/shared collection item.
- Wishlist with priority, target price, notes, edit, and remove.
- Username profile settings, searchable/discoverable profile option, friend requests, accepting/declining requests, and friend listing.
- Trade proposals between accepted friends, quantity validation, accept/decline, and mutual confirmation. Inventory transfers only after both traders confirm.
- Collection cost report, catalog group overview, authenticity notes, responsive mobile navigation, and installable PWA shell.

## Important limitations

- Pinfolio does not import a complete official Disney pin catalog. The catalog starts with pins entered by users, so checklist/group reporting reflects the entries in your own Supabase catalog.
- The cost report totals user-entered purchase costs; it does **not** estimate current market/resale value.
- Authenticity status is a personal note, not professional authentication.
- PWA offline caching is limited to static app files. Account data and Supabase requests are not cached for offline access.
- The service worker and manifest assume deployment at the domain root (such as a Vercel project root).

## Run in VS Code on macOS

1. Download and unzip the project.
2. Open the `pinfolio` folder in VS Code.
3. In VS Code, choose **Terminal → New Terminal**.
4. Install dependencies:

   ```bash
   npm install
   ```

5. Create your local environment file:

   ```bash
   cp .env.example .env
   ```

6. Open `.env`. Keep the project URL and replace `PASTE_YOUR_SUPABASE_PUBLISHABLE_OR_ANON_KEY_HERE` with your project's **publishable key** (`sb_publishable_...`) or legacy anon key. Never use a secret/service-role key in `.env`.
7. Start Pinfolio:

   ```bash
   npm run dev
   ```

8. Open the local URL Vite prints, usually `http://localhost:5173`.

## Supabase setup (do these before testing features)

### 1. Run the database migration

1. Open your project in Supabase.
2. Open **SQL Editor → New query**.
3. Open `supabase/migrations/20261023000000_pinfolio_core.sql` in VS Code.
4. Copy the entire file into SQL Editor and click **Run**.
5. Confirm the query finishes successfully. It creates/updates the tables, triggers, indexes, RLS policies, Storage bucket, and trade/friend RPC functions used by the app.

The migration is designed to update the tables already used by the prototype. If SQL Editor reports an error, stop and resolve that error before continuing; don't skip statements in the middle.

### 2. Check Authentication

1. Go to **Authentication → Providers → Email** and make sure Email is enabled.
2. For development, you can temporarily disable email confirmation under **Authentication → Settings** if you want new accounts to sign in immediately. If you keep confirmation enabled, new users must click the email link before signing in.
3. Under **Authentication → URL Configuration**, set the Site URL to your production URL when you deploy. Add your local URL (usually `http://localhost:5173`) to the Redirect URLs list.

### 3. Set the Edge Function secret

The `find-trading-user` function uses a server-side key to search discoverable profiles. This key must never go in the browser `.env` file.

1. In Supabase **Project Settings → API Keys**, copy the server-side **secret key** (`sb_secret_...`) for this same project, or use the legacy `service_role` key if your project provides that format.
2. Open **Edge Functions → Secrets** (Custom Secret Keys).
3. Create/update the secret named exactly `PINFOLIO_SERVICE_ROLE_KEY` and set its value to that server-side key.
4. Do not paste the value into source code, GitHub, or chat.

The project already contains `supabase/functions/find-trading-user/index.ts`.

### 4. Deploy the username-search function

If the Supabase CLI is installed and linked to this project, open a terminal in the project folder and run:

```bash
supabase functions deploy find-trading-user
```

If the CLI is not linked, run `supabase login`, then `supabase link --project-ref xxarsofujqcwujvtfcyn`, and then deploy. Docker is not required for deploying a hosted function, even if the CLI prints a Docker warning.

### 5. Configure profile discoverability

1. Start Pinfolio and create/sign in to an account.
2. Open **More → Trader profile**.
3. Set a unique username (2–30 characters: letters, numbers, periods, underscores, and hyphens).
4. Turn on **Allow my profile to be discoverable** and save.
5. Your friend must do the same before username search can find them.

A profile must be discoverable to appear in username search. Collection pins are separately private by default; making a profile discoverable does not make the collection public.

### 6. Test the full workflow

Use two separate accounts (for example, a regular browser window and a private/incognito window):

1. Give each account a username and enable profile discoverability.
2. Search for the other username under **Traders** and send a friend request.
3. Sign into the receiving account and accept the request.
4. Add pins to both collections. Mark one or more copies tradeable and set visibility to **Friends** or **Public**.
5. Return to the first account and open **Traders → Available to trade**.
6. Propose a trade. The recipient can accept/decline; for a trade to complete, both people must confirm.
7. Inventory is transferred only after both confirmations. Test first with non-valuable test records.

## Deployment

Vercel is a straightforward option for this Vite project:

1. Push the project to a private GitHub repository (do not commit `.env`).
2. Import the repository into Vercel.
3. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` under Vercel project environment variables.
4. Build command: `npm run build`; output directory: `dist`.
5. Update Supabase Auth Site URL and Redirect URLs to your deployed domain.

## Security notes

- Only browser-safe Supabase publishable/anon keys belong in `VITE_*` variables.
- Never add `sb_secret_...` or legacy `service_role` keys to the repository or frontend.
- RLS is enabled on user data tables. Keep it enabled in production.
- Uploaded image access is controlled by Storage policies. Do not switch the `pin-images` bucket to public.
- Shared listing queries return only trade-relevant fields; private notes and purchase costs are not returned to other users.

## Trading feature update (October 2026)

This package adds a Supabase migration for:

- In-app notifications for incoming friend requests and trade proposals/status changes.
- Friend wishlist matches against tradeable pins shared with friends.
- Counteroffers: a counteroffer closes the old pending proposal and creates a new proposal in the opposite direction.
- Trade history: the Traders page now loads prior as well as active trades.
- A shared collection-pin editor launched from both a collection card and pin details.

### Apply the database migration

Before using these additions, apply `supabase/migrations/20261024000000_pinfolio_trading_features.sql` to the same Supabase project used by this app. In Supabase Dashboard, open **SQL Editor → New query**, paste the migration file contents, and run it. Do not run this migration against a production project until you have a backup and have reviewed the changes.

### Run locally

1. Keep your existing `.env` values for `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (do not share the `.env` file).
2. From the project folder run `npm install` and then `npm run dev`.
3. For a production build run `npm run build`.

The migration adds the database-side checks and notifications; client-side display depends on the signed-in user having the expected table permissions and the migration being applied. Test with two disposable accounts and pins before relying on trades with real collection data.

## Pin catalog and set tracking

The catalog page uses the shared `pin_sets` table and catalog-marked rows in `pins`.

1. In Supabase Dashboard, open **SQL Editor → New query**.
2. Open `supabase/migrations/20261025000000_pinfolio_pin_catalog.sql` and run its complete contents once.
3. Start the app, sign in, and open **Catalog** in the sidebar.
4. Use **CSV template** to download the expected header row. Fill it with a catalog dataset you have permission to import, then use **Import CSV**.

CSV columns: `catalog_code` (stable unique ID required), `name` (required), `set_name` (leave blank for a standalone pin), `character_name`, `franchise`, `park`, `release_year`, `edition_type`, `set_number`, `image_url`, `description`, and `set_description`. Set names group pins together. Existing `catalog_code` values are skipped on re-import to avoid duplicate records; update existing catalog entries through a controlled admin workflow rather than expecting re-import to overwrite them.

The code provides the catalog, CSV import, set progress, standalone pins, search, and add-to-collection flow. It does **not** include a complete Disney pin dataset. Populate it from a source whose data and image licensing permits your intended use; don't assume product photos or a third-party catalog can be republished freely. For large files, the importer batches pin inserts, but the browser still reads the CSV into memory, so split exceptionally large files into manageable CSVs (for example, 5,000–10,000 rows each).

# Pinfolio GitHub Pages deployment fix

This project is configured for the GitHub Pages URL `https://samct6.github.io/pinfolio/`.

## Apply the fix

1. Replace the corresponding files in your repository with the files in this ZIP. Keep the `src/` app code and other project files intact.
2. Do **not** upload `.env`, `node_modules/`, `.git/`, or an old `dist/` directory. They are intentionally excluded from this ZIP.
3. Commit and push the changes to the `main` branch.
4. In GitHub repository **Settings → Pages**, set **Source** to **GitHub Actions**.
5. Open **Actions** and inspect the `Deploy Pinfolio to GitHub Pages` workflow. It builds the app and checks the generated output before deployment.
6. After the workflow succeeds, open `https://samct6.github.io/pinfolio/` in a private window. If a previous service worker is still caching old files, unregister it under browser developer tools → Application/Storage → Service Workers and reload.

## Local development

Run `npm ci`, copy `.env.example` to `.env`, fill in the Supabase URL and publishable/anon key, then run `npm run dev`.

## Supabase values for GitHub Actions

If the deployed app needs Supabase, add repository **Actions variables** named `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (publishable/anon key only; never a service-role secret). The current workflow can build without these values, but Supabase-backed features will not connect unless the values are provided at build time. Add the following `env` block to the `Build Vite app` step if needed:

```yaml
env:
  VITE_SUPABASE_URL: ${{ vars.VITE_SUPABASE_URL }}
  VITE_SUPABASE_ANON_KEY: ${{ vars.VITE_SUPABASE_ANON_KEY }}
```

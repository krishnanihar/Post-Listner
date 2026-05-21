# Supabase setup — desktop journal accounts + backend

One-time setup for the desktop journal's auth + entries backend (design doc
slice 2). Until this is done the desktop runs a no-auth dev fallback (the
journal on mock data).

## 1. Create the project
1. Sign in at https://supabase.com and create a new project.
2. Wait for it to provision, then open **Project Settings → API**.
3. Copy the **Project URL** and the **anon / publishable key**.

## 2. Create the entries table
1. Open the Supabase **SQL Editor**.
2. Paste the contents of `supabase/schema.sql` and run it.
3. Confirm the `entries` table exists under **Table Editor** with RLS enabled.

> **Note — the Vite dev server runs over HTTPS** (`https://localhost:5173`,
> self-signed cert). So every localhost URL below must be `https://`, not
> `http://` — Supabase and Google match the scheme exactly.

## 3. Google OAuth — Google Cloud side
1. In the Google Cloud Console, create an **OAuth 2.0 Client ID** of type
   **Web application**.
2. **Authorized JavaScript origins:** add `https://localhost:5173`,
   `https://localhost:5174`, and `https://post-listner.vercel.app`.
3. **Authorized redirect URIs:** add the Supabase callback —
   `https://<project-ref>.supabase.co/auth/v1/callback`.
4. Save; copy the **Client ID** and **Client Secret**.

## 4. Google OAuth — Supabase side
1. Supabase Dashboard → **Authentication → Providers → Google**.
2. Enable it; paste the Client ID and Client Secret; save.
3. **Authentication → URL Configuration → Redirect URLs:** add
   `https://localhost:5173/journal`, `https://localhost:5174/journal`, and
   `https://post-listner.vercel.app/journal` (the `redirectTo` allow list).

## 5. Local env
Add to `.env.local` (gitignored):

    VITE_SUPABASE_URL=https://<project-ref>.supabase.co
    VITE_SUPABASE_ANON_KEY=<anon-or-publishable-key>

Restart `npm run dev` after editing `.env.local`.

## 6. Production env
Add the same two variables to the Vercel project (**Settings → Environment
Variables**, Production environment), then redeploy.

# LK Ops — Setup Guide

## What you need
- This project folder (`lk-ops`)
- A Supabase account (free) — supabase.com
- An Anthropic API key — console.anthropic.com
- A Vercel account (free) — vercel.com

---

## Step 1 — Create Supabase project

1. Go to supabase.com → New project
2. Name it `lk-ops`, pick a region close to Lithuania (EU West / Stockholm)
3. Wait ~1 min for it to provision

---

## Step 2 — Run the database schema

1. In your Supabase project: **SQL Editor** (left sidebar)
2. Click **New query**
3. Open `supabase_schema.sql` from this folder, paste the entire contents, click **Run**
4. You should see "Success. No rows returned"

---

## Step 3 — Configure email auth (magic link)

1. Supabase → **Authentication** → **Email** (under Providers)
2. Make sure **Email** is enabled
3. Under **Email Templates**, you can leave defaults for now
4. Supabase → **Authentication** → **URL Configuration**
   - Set **Site URL** to your Vercel URL (you'll get this in Step 5 — come back and update it)
   - Add to **Redirect URLs**: `https://your-vercel-url.vercel.app/auth/callback`

---

## Step 4 — Get your keys

In Supabase: **Project Settings** → **API**

Copy:
- **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
- **anon / public key** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`

In Anthropic console: **API Keys** → create one → copy it as `ANTHROPIC_API_KEY`

---

## Step 5 — Deploy to Vercel

1. Push this folder to a private GitHub repo (File → new repo in GitHub Desktop, or `git init && git add . && git commit -m "init" && git remote add origin ... && git push`)
2. Go to vercel.com → **Add New Project** → import your GitHub repo
3. In the **Environment Variables** section, add:
   - `NEXT_PUBLIC_SUPABASE_URL` = your project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = your anon key
   - `ANTHROPIC_API_KEY` = your Anthropic key
4. Click **Deploy**
5. Copy the deployed URL (e.g. `https://lk-ops-xyz.vercel.app`)

---

## Step 6 — Finish Supabase auth config

Go back to Supabase → Authentication → URL Configuration:
- **Site URL**: `https://lk-ops-xyz.vercel.app`
- **Redirect URLs**: `https://lk-ops-xyz.vercel.app/auth/callback`

---

## Step 7 — First sign-in + make yourself admin

1. Go to your Vercel URL
2. Enter your email, click Send magic link
3. Click the link in the email — you're in (with `core` role by default)
4. Go to Supabase → **Table Editor** → `profiles`
5. Find your row, click the `role` cell, change it to `admin`, save

You're now admin — full access including budget.

---

## Invite others

Share the Vercel URL. They sign in with their email, get `core` role automatically (Lineup + Hosp edit, Budget read-only). Promote to `admin` in the `profiles` table if needed.

---

## Local development (optional)

1. `cp .env.local.example .env.local`
2. Fill in your keys
3. `npm run dev`
4. Open `http://localhost:3000`

---

## Seed the hospitality roster

The original 24-person roster from the prototype is not auto-seeded (the DB starts empty so you control what's in it). Two options:

**Option A — Import tab**: Take a screenshot of the original roster from the prototype, go to Import → Hosp, upload it. Claude will extract the rows for you to confirm.

**Option B — Manual**: Add people one by one in the Hosp tab.

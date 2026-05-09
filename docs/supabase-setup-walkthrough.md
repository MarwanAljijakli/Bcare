# Supabase setup walkthrough

> A click-by-click guide to setting up the BlueCare backend on Supabase.
> Written for someone who has never used Supabase before. Should take about
> **15 minutes**. **Nothing in this walkthrough costs money** — Supabase's
> free tier is more than enough for development.

This walkthrough is the **first step of Module 2** (auth + onboarding). Before
I can write any auth code, I need a real Supabase project to talk to. You'll
follow the steps below, then paste five values back into the chat, and I'll
take it from there.

---

## What is Supabase?

Supabase is the company that hosts the database, the authentication system,
and the file storage that BlueCare will use behind the scenes. Think of it as
"the part of the app that you, the user, never see, but that stores everything
safely." Free tier limits:

- 500 MB database — about 5 million rows for our schema
- 1 GB file storage — about 5,000 caregiver-recorded voice clips
- 50,000 monthly active users
- 50,000 file egress per month

For development we will not come close to any of these.

---

## Step 1 — Create your Supabase account

1. Open <https://supabase.com> in your browser.
2. Click the green **Start your project** button (top right corner).
3. Sign up with **GitHub** if you have a GitHub account. If you don't, use
   **Sign up with email** — Supabase will email you a confirmation link;
   click the link to confirm your account.
4. After confirming, you'll land on a page titled **Welcome to Supabase**.

✓ Done with Step 1.

---

## Step 2 — Create the BlueCare project

1. On the welcome page (or by going to <https://supabase.com/dashboard>), click
   **New project**. (If you've never created an organization, Supabase will
   ask you to create one first — name it `BlueCare` and choose the **Free**
   plan.)

2. You'll see a form titled **Create a new project**. Fill it in like this:

   | Field                 | What to enter                                                                                                                                                    |
   | --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
   | **Project name**      | `BlueCare Dev`                                                                                                                                                   |
   | **Database password** | Click **Generate a password**. A long random string appears. **Copy it now and save it somewhere safe** — you cannot see it again later. We'll use it in Step 5. |
   | **Region**            | Pick **Central EU (Frankfurt)** — see the note below for why.                                                                                                    |
   | **Pricing plan**      | **Free** (already selected).                                                                                                                                     |

3. **Why Frankfurt?** You're in Saudi Arabia. Supabase doesn't have a data
   center in the Middle East, so the closest options are:
   - **Central EU (Frankfurt)** — about 50–60 ms latency to Jeddah/Riyadh,
     reliable peering. **Recommended.**
   - **South Asia (Mumbai)** — about 70–90 ms; geographically closer but the
     undersea cable routing is less consistent.
   - **West EU (Ireland)** or **Central EU (Paris)** — slightly slower than
     Frankfurt; pick one of these only if Frankfurt is greyed out.

   Frankfurt also keeps your data within the EU's data-protection regime,
   which is a useful posture for our future GDPR-aligned privacy policy.

   > **Important:** you cannot easily change region later — moving a project
   > requires a manual export and re-import. Pick the right one now.

4. Click **Create new project**. Supabase begins provisioning. You'll see a
   spinner that says "Setting up project…" — this takes about **2 minutes**.

✓ Done with Step 2 once the dashboard loads with your new project.

---

## Step 3 — Find your five required values

Once the project is ready you'll be on its dashboard. We need to copy **five
values** into a configuration file. Here's where each one lives — the click
paths are precise on purpose.

### 3a — Project URL and the two API keys

1. In the **left sidebar**, click the **Settings** icon (gear icon, near the
   bottom).
2. In the secondary sidebar that appears, click **API**.
3. You'll see a page titled **API settings**. Three of the values you need
   are here:

   | Value                         | Where on this page                                                                                                                                                          |
   | ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
   | **Project URL**               | Top section, labeled `Project URL`. Looks like `https://abcdefghij.supabase.co`. Click the copy icon next to it.                                                            |
   | **anon (public) key**         | Section **Project API keys** → row labeled `anon` `public`. Click the copy icon.                                                                                            |
   | **service_role (secret) key** | Same section → row labeled `service_role` `secret`. Click **Reveal**, then the copy icon. **Treat this like a password — never share it publicly, never commit it to git.** |

### 3b — JWT secret

Stay on the **API settings** page.

4. Scroll down to the section titled **JWT Settings**. The fourth value is
   here:

   | Value          | Where                                                            |
   | -------------- | ---------------------------------------------------------------- |
   | **JWT Secret** | The long string under `JWT Secret`. Click **Reveal**, then copy. |

### 3c — Database connection string

The fifth value lets BlueCare's database tooling (Drizzle) talk to Postgres
directly to apply migrations.

5. Still in the **Settings** sidebar, click **Database** (just below API in the
   secondary sidebar).
6. Scroll down to **Connection string**. Click the **URI** tab (not Pooler,
   not Session — **URI**).
7. You'll see a string starting with `postgresql://postgres:...@...supabase.co:5432/postgres`.
   The placeholder `[YOUR-PASSWORD]` is in the middle. **Replace
   `[YOUR-PASSWORD]` with the database password you saved in Step 2.**
8. Copy the resulting full string.

✓ At the end of Step 3 you should have **five values** saved somewhere safe:

1. Project URL
2. anon (public) key
3. service_role (secret) key
4. JWT secret
5. Database connection string (with your password substituted in)

---

## Step 4 — Configure Auth URLs

These tell Supabase which web addresses are allowed to receive auth links
(sign-in, password reset, magic link). We need to configure both localhost
(for development on your computer) and the future production domain.

1. In the left sidebar, click the **Authentication** icon (a person silhouette).
2. In the secondary sidebar, click **URL Configuration**.
3. Fill in the fields like this:

   | Field             | Value                                                                                                                                   |
   | ----------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
   | **Site URL**      | `http://localhost:3000`                                                                                                                 |
   | **Redirect URLs** | Add **all three** of: `http://localhost:3000/**`, `https://bluecare.app/**`, `https://*.vercel.app/**`. Click **Add URL** between each. |

   > The `**` is a wildcard meaning "any path." We use it so Supabase doesn't
   > reject auth links pointing to `/auth/callback` or `/onboarding/etc`.

4. Click **Save** at the bottom.

✓ Done with Step 4.

---

## Step 5 — Verify the email provider is on

By default, Supabase has the **Email** provider enabled with magic-link and
password sign-in turned on. We're going to verify and leave it as-is.

1. Still under **Authentication** in the left sidebar, click **Providers**.
2. **Email** should be at the top, with a green toggle showing **Enabled**.
3. Click **Email** to expand it. Confirm:
   - **Enable Email Provider** = **on**
   - **Enable Email Signups** = **on**
   - **Confirm email** = **on** (we want to require email verification)
   - **Secure email change** = **on**
   - **Secure password change** = **on**

4. Leave everything else at defaults. Click **Save** if you changed anything
   (you probably didn't).

✓ Done with Step 5.

---

## Step 6 — A note on email templates (you do nothing here yet)

Supabase ships with default English email templates ("Confirm your email,"
"Reset your password," etc.). They work fine but they're not bilingual.

I'll deliver bilingual EN+AR email templates as part of Module 2 implementation
(in `db/supabase/email-templates/`), with click-by-click instructions for
pasting them into the dashboard at **Authentication → Email Templates**. For
now, **do nothing here** — the defaults will let you test signup end-to-end.

---

## Step 7 — Verify it works

A quick three-checks list before we finish:

- [ ] At <https://supabase.com/dashboard> you see a project named **BlueCare Dev**, status **Active**.
- [ ] On **Settings → API**, you can copy the **Project URL** and the two API keys.
- [ ] On **Settings → Database**, you have the URI connection string with your password substituted in.
- [ ] On **Authentication → URL Configuration**, the **Site URL** is `http://localhost:3000` and the redirect-URL list includes `http://localhost:3000/**`.
- [ ] On **Authentication → Providers**, Email is **Enabled**.

If all five boxes check, you're done.

---

## What to share back with me

Paste the **five values** below back into the chat in the format below. I will
then add them to `web/.env.local` (which is git-ignored — they never enter
the repo) and continue Module 2.

```
PROJECT_URL: https://...supabase.co
ANON_KEY: eyJ... (long string)
SERVICE_ROLE_KEY: eyJ... (long string)
JWT_SECRET: ...
DATABASE_URL: postgresql://postgres:YOUR-PASSWORD@...supabase.co:5432/postgres
```

> **Security reminder.** The `SERVICE_ROLE_KEY`, `JWT_SECRET`, and
> `DATABASE_URL` (which contains the database password) are secrets. Once
> you've shared them with me here, treat them as you would a password —
> don't paste them into Slack, email them, or post them in a screenshot to
> social media. They never get committed to git on my side; `.env.local`
> is in `.gitignore`.
>
> If you ever suspect a leak, rotate them in Supabase: **Settings → API →
> JWT Settings → Generate a new JWT secret** + **Settings → Database →
> Connection string → Reset database password**.

---

## If something doesn't work

| Problem                                                | Fix                                                                                                                                                       |
| ------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sign-up form rejects your email                        | Use a different email — sometimes Supabase's free tier rejects disposable-email-domain addresses. Personal Gmail/iCloud/Outlook always work.              |
| Region picker doesn't show Frankfurt                   | Try refreshing the page; sometimes the picker takes a moment to load. If still missing, pick **West EU (Ireland)** as the next-best option.               |
| Stuck on "Setting up project…" for more than 5 minutes | Refresh the dashboard. If it's still stuck, contact me — we may need to delete the project and retry in a different region.                               |
| Can't find a sidebar option                            | The Supabase dashboard occasionally rearranges. Search for the option name (e.g. "URL Configuration") in the URL bar of <https://supabase.com/dashboard>. |
| You accidentally lost the database password            | **Settings → Database → Reset database password.** Then update `DATABASE_URL`.                                                                            |

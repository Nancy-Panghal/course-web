# Third-party account setup

Every account below needs to exist, and every credential it produces goes
into the matching `.env.example` variable in the relevant repo. None of
these accounts transfer automatically with the code — each is a separate
account with its own owner, and stands up in the time noted.

## 1. Supabase (~10 minutes)
Create a project at supabase.com. All three repos connect to this one
project. From Project Settings → API, copy the URL, anon key, and
service-role key. There is no schema migration file to run — request a
current schema export separately and apply it in the SQL editor before
running any repo against a fresh project.

## 2. Cloudflare R2 (~10 minutes)
Create an R2 bucket in the Cloudflare dashboard, then an API token scoped
to that bucket (R2 → Manage API Tokens). This is where every course video,
PDF, and ebook file is actually stored.

## 3. Vercel — hosting `course-web` (~10 minutes)
Import the repo, set every variable from `course-web/.env.example`, deploy.
Cron jobs are already defined in `vercel.json` and start running
automatically once deployed — no separate setup.

## 4. Hosting the two bots (~15 minutes)
Any host that runs a persistent Node.js process works — Render and
Railway are both known to work, and either is a reasonable default if
you don't already have a preference. Two separate services, one per bot
repo. Set each repo's `.env.example` variables in that service's
environment. Both need to be reachable at a public URL — that URL is
what goes into `course-web`'s `WHATSAPP_BOT_URL` / `TELEGRAM_BOT_URL`.

**Whichever host you choose, use a plan that keeps the process running
continuously — not a free or trial tier that spins the service down
when idle.** See the note in `ARCHITECTURE.md` for why this specifically
breaks the reminder feature, not just performance.

## 5. Meta Business Manager + WhatsApp Cloud API (~1–2 hours, can take longer for verification)
This is the most involved setup step. In order:
1. Create a Meta Business Manager account (business.facebook.com) if one
   doesn't already exist.
2. Create an App at developers.facebook.com, add the "WhatsApp" product.
3. This provisions a test phone number automatically for development. For
   production, add and verify a real phone number under WhatsApp → API
   Setup, and complete Meta's business verification — this step is the one
   most likely to take real time (identity/business document review).
4. From API Setup, copy the Phone Number ID and generate a permanent
   System User access token (temporary tokens expire in 24 hours and are
   not usable for a live deployment).
5. Set up the webhook: point it at `<your-whatsapp-bot-url>/webhook/whatsapp`,
   enter the same verify token you set as `META_WEBHOOK_VERIFY_TOKEN`, and
   subscribe to the `messages` field.
6. Create and submit each message template this platform sends (see the
   template name variables in `Whatsapp-bot/.env.example`) for Meta's
   approval before they'll actually send in production.

**Important:** a WhatsApp Business phone number and its surrounding Meta
Business account are not something that transfers cleanly between two
unrelated businesses — Meta's transfer process requires business
verification on both sides and is not something most buyers of a codebase
will want to pursue. Expect a new owner to complete steps 1–6 themselves
under their own Meta Business account rather than inheriting an existing
one.

## 6. Telegram bot (~5 minutes)
Message @BotFather on Telegram, run `/newbot`, choose a name and username.
BotFather returns the bot token immediately. Set the bot's webhook to
`<your-telegram-bot-url>/webhook` using Telegram's `setWebhook` API call.

## 7. Payment gateways
- **Platform's own Cashfree account** (for billing creators): sign up at
  cashfree.com as a registered business, complete KYC, get API
  credentials from the dashboard. This is separate from anything a
  creator sets up — it belongs to whoever operates the platform.
- **Creators bring their own** Cashfree, Razorpay, and/or Stripe account —
  no setup needed on the platform operator's side beyond having the
  connection flow working; each creator supplies their own credentials
  through their dashboard.

## 8. Resend (email) (~5 minutes)
Sign up at resend.com, verify a sending domain, generate an API key.

## 9. Gemini API key (~5 minutes)
Create a key at Google AI Studio (aistudio.google.com). Powers the AI
Doubt Assistant feature — this is the only AI key this platform actually
uses. `ANTHROPIC_API_KEY` and `DEEPSEEK_API_KEY` are also referenced in
the code but are not currently used — leave them unset.

## Hardcoded values to find and change

A few things are hardcoded to specific values that a new owner will want to
change:

- **`KURSO_URL`** in both bot repos — see `ARCHITECTURE.md`. Functionally
  required in both.
- **Support/contact email addresses** — `support@...` and `info@...`
  addresses are hardcoded directly into several pages and API routes
  (terms, privacy, refund policy, contact page, feedback route, contact
  route). Search the codebase for the current domain's email addresses and
  replace every occurrence.
- **`src/lib/brand.ts`** — a single exported constant, `LOGO_SRC`, is the
  one place the site logo image path is set. Change it there, not
  anywhere it's used.
- **`src/lib/certificate.ts`** — the brand name shown on generated
  certificates is a hardcoded string in this file.
- **Brand name as literal text** — the current product name appears as
  plain text (not a variable) in close to 200 places across the UI
  (certificates, loading screens, the watermark overlay, dashboard copy,
  and more). There's no single find-and-replace-safe way to rebrand
  without checking each occurrence's context, since a straight text
  replace would also hit unrelated strings. Budget real time for this if
  rebranding is planned.
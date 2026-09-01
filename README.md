# Kurso

Kurso is a course-selling platform for creators — a lightweight alternative to Graphy, Learnyst, Classplus, or Tagmango, built for the Indian creator market.

Live at **[kurso.in](https://www.kurso.in/)**.

A creator signs up, uploads their course content, sets a price, and shares a link. Students pay, get access, and go through their lessons, assignments, quizzes, and certificates — all from one dashboard the creator controls.

## What it does

- **Course builder** — creators can generate a course landing page in minutes without having to design one from scratch, or embed the Kurso checkout link into a landing page they already have. Courses are structured into modules and lessons (video, PDF, text, live sessions), with drafts that can be published when ready and edited as the creator goes.
- **Content protection** — videos and PDFs are watermarked per-student and served through signed, time-limited URLs instead of public links, so shared content can be traced back to the student.
- **Payments, your way (BYOK)** — instead of locking creators into one payment processor, Kurso lets each creator connect their own Razorpay or Cashfree account. Money goes straight to them; Kurso never sits in the middle of the payout.
- **Assignments & quizzes** — students submit assignments and take quizzes tied to lessons; creators review and grade from the dashboard.
- **Certificates** — auto-generated on course completion, with the creator's branding, a signature, and a QR code that verifies the certificate is genuine.
- **Analytics & student management** — creators can see enrollments, revenue, and student progress, and export data when they need it.
- **Delivery beyond the website** — once a creator adds a course and a student enrolls, lessons and notifications are delivered automatically on WhatsApp and Telegram as well as the website (see the two companion bots below), with no extra setup needed from the creator.

## Tech stack

- **Framework**: Next.js (App Router) + TypeScript
- **Database & Auth**: Supabase (PostgreSQL)
- **Hosting**: Vercel
- **File storage**: Cloudflare R2
- **Caching / rate limiting**: Upstash Redis
- **Messaging**: Meta WhatsApp Business API, Telegram
- **Email**: Resend
- **Payments**: Razorpay and Cashfree (creator-connected via BYOK), plus Cashfree for Kurso's own subscription billing
- **Styling**: Tailwind CSS

## Related repos

Kurso delivers course content over chat apps in addition to the website:

- [**telegram-bot**](https://github.com/Nancy-Panghal/telegram-bot) — sends lessons, quizzes, and assignment prompts to students on Telegram.
- [**Whatsapp-bot**](https://github.com/Nancy-Panghal/Whatsapp-bot) — same idea, over WhatsApp, using Meta's official WhatsApp Business API.

Both bots share this app's Supabase database and use signed links to fetch content, so a student's progress stays in sync no matter which channel they use.

## Project status

Kurso is a working, self-built platform, currently not processing live customer payments yet. It's built and maintained solo, end to end — product, backend, and the two bot integrations above.
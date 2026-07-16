# Kurso Kurso — Architecture Notes

This file tells AI (and future contributors) which components/routes are canonical, and how things should work.

## Canonical Routes (DO NOT CREATE ALTERNATES)

### Course Landing Page (Sales Page)
- **Canonical**: `/about-course/[creatorName]/[courseName]/[courseId]`
  - Uses themes, modules, rich features
  - Imports `@/components/CoursePageClient` (the ONLY one)
  - **Deprecated**: `/c/[slug]` now redirects to canonical

### Student Course Learning Page
- **Canonical**: `/course/[creatorName]/[courseName]/[courseId]`
  - Where enrolled students watch lessons

### Content Signing
- **Canonical**: `/api/content/sign`
  - Handles both video and PDF
  - Uses Authorization header with token
  - **Deprecated**: `/api/video/sign` (DELETED)

## Shared Components — Single Source of Truth

- **CoursePageClient**: `src/components/CoursePageClient.tsx` (ONLY ONE)
- **EnrollModal**: `src/components/EnrollModal.tsx`
- **WatermarkedPlayer**: `src/components/WatermarkedPlayer.tsx`
- **DraftGate**: `src/components/DraftGate.tsx`

## Auth Pattern for API Routes

- Always verify using `Authorization: Bearer <token>` header
- Use `supabase.auth.getUser(token)` (never just `getUser()`)
- Example: See `/api/content/sign/route.ts`

## Enrollment Lookup Pattern (ALWAYS USE THIS)

```
enrollments.student_id → students.auth_id = auth user id
```

## Database Tables (For Bot State)

- **pending_submissions**: Stores pending assignment submissions from WhatsApp bot
- **rate_limit_events**: Stores rate limiting state from WhatsApp bot
- Both should use Supabase (not in-memory maps)

## Rules for AI/Contributors

1. **SEARCH BEFORE CREATING**: Always look for existing files/functions that do the job before making new ones
2. **NO DUPLICATES**: Never create a second CoursePageClient, second video sign route, etc.
3. **NO IN-MEMORY STATE**: Use Supabase for persistent state in bots
4. **WEBHOOK SECURITY**: Always verify Twilio webhook signatures

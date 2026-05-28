# Production Checklist

## Required Before Deploy

- Run `npm run lint`, `npm run test`, `npm run build`, and `npm audit --omit=dev`.
- Configure every variable listed in `.env.example` in the production host.
- Confirm Supabase Auth redirect URLs include the production domain and `/auth/callback`.
- Apply all Supabase migrations in order and verify RLS is enabled on user data tables and storage buckets.
- Configure production staff accounts in `staff_accounts`; keep service-role keys server-only.
- Verify OpenAI and Resend accounts have production billing/quota and signed DPAs where needed.
- Confirm the app is not using Stripe or any in-app payment route.

## Legal And Compliance

- Replace or confirm company legal details in `/privacy`, `/terms`, and `/cookies`.
- Add REA/Registro Imprese, PEC, capital/social info and other mandatory company data when available.
- Keep cookie banner disabled only while no profiling, advertising, or non-exempt analytics are present.
- Re-check accessibility obligations for the business size and service type before public launch.

## Operational Checks

- Test signup, email verification, login, password reset, profile update, dog CRUD, bookings, admin console, notifications, document upload and media upload.
- Verify uploaded documents and media are private unless intentionally exposed through signed URLs.
- Confirm admin-only APIs return 403 for normal customers.
- Confirm `/supabase-test`, payment routes, and Stripe webhook routes return 404 in production.

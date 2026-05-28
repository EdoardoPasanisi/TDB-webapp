# Tenuta del Barone Web App

Next.js app for customer profiles, dog records, service bookings, chatbot support, notifications and admin operations.

## Local Development

Create `.env.local` from `.env.example`, then run:

```bash
npm run dev
```

Open `http://localhost:3000`.

## Verification

```bash
npm run lint
npm run test
npm run build
npm audit --omit=dev
```

## Production Notes

- Stripe/in-app payments are intentionally disabled.
- Keep `SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY`, and `RESEND_API_KEY` server-only.
- Set `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_AUTH_REDIRECT_BASE_URL`, and `ALLOWED_ORIGINS` to the production origin.
- See `docs/production-checklist.md` before deploying.

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

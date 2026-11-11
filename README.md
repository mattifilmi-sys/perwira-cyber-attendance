# NADI x Cybersecurity – Perwira Cyber Attendance System v1.0

This is the Supabase-connected frontend package for the approved attendance dashboard.

## Included
- Admin email/password login using Supabase Auth.
- Admin authorization via `public.admin_users`.
- Create talks in `public.talks`.
- Open/close talk registration.
- Generate a real QR PNG for each talk, pointing to the deployed site's `?checkin=<talk UUID>` URL.
- Public audience check-in with full name and email.
- Duplicate email prevention per talk (database unique index).
- Admin audience list, filtering, and CSV export.
- Official NADI Cybersecurity logo.

## Supabase configuration
The project URL and browser-safe publishable key are set in `src/config.js`.
The publishable key is intended for frontend use. Do not add a secret/service_role key or database password to this project.

## Required database state
The project must already have these tables and policies:
- `public.admin_users`
- `public.talks`
- `public.audience_attendance`
- `public.is_admin()` helper
- RLS policies allowing public SELECT of active talk metadata and public INSERT to attendance only for active talks; admin-only talk management and attendance SELECT.

The SQL created during setup in this conversation provides this baseline. Verify the policies in Supabase before production.

## Run locally
Install Node.js 20 or newer, then in this folder:

```bash
npm install
npm run dev
```

Open the local URL printed by Vite (usually `http://localhost:5173`).

For production build:

```bash
npm run build
npm run preview
```

## Deploy
Deploy this folder to a static hosting service that supports Vite builds (for example, Vercel or Netlify):
- Build command: `npm run build`
- Output directory: `dist`

After deployment, add the deployed site's URL to Supabase Authentication URL Configuration:
- Site URL: your production domain
- Redirect URLs: your production domain and local development URL (e.g. `http://localhost:5173/**`)

The QR codes are generated using the current site URL. Therefore, use the deployed domain when generating QR codes for real audience use. Do not use a `file://` URL or a localhost URL for public QR attendance.

## First admin
1. Create an admin user in Supabase Authentication → Users.
2. Add that user's UUID to `public.admin_users` from the Supabase SQL Editor:

```sql
insert into public.admin_users (user_id)
values ('REAL-AUTH-USER-UUID');
```

The app checks the signed-in user's UUID against this table before showing the admin dashboard.

## Important production hardening before public launch
- Add CAPTCHA and server-side rate limiting to reduce spam submissions.
- Consider limiting check-in to the talk window or using a rotating QR if presence verification is needed.
- Add a clear privacy notice and data retention period.
- Test the full flow from a separate phone on mobile data after deployment.
- Set up backups and admin account recovery.

## Data limitation
This app's open QR flow confirms that a form was submitted, not that the person was physically present. Anyone with the active QR link can submit until the talk is closed.

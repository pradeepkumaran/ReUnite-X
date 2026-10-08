# REUNITE-X deployment and operations

## Current operational boundary

The checked-in API services use an in-memory repository for local development and tests. Supabase migrations, Auth JWT validation, and private Storage integration are included, but the case, match, verification, notification, and audit service repositories still need a PostgreSQL-backed adapter before deploying a multi-instance production service. Render instances restart and do not share in-memory state. **Do not process real disaster reports with this repository until that adapter has been implemented and exercised against a non-production Supabase project.**

## Local setup

1. Create a Supabase project and apply `supabase/migrations/001_initial_schema.sql` through `005_private_case_access.sql` in order. Run `supabase/seed.sql` only in a development project.
2. Create the private `case-photos` bucket (the migration configures its policies).
3. Copy the root `.env.example` to `.env`; configure backend values in `backend/.env` and browser-safe `VITE_*` settings in `frontend/.env`. Never put a service-role key or Firebase service-account secret in frontend variables.
4. Backend: `cd backend`, create/activate a Python 3.11 virtual environment, install `requirements.txt`, then run `uvicorn app.main:app --reload`. Swagger is at `/docs`.
5. Frontend: `cd frontend`, run `npm ci`, then `npm run dev`. Run `npm test` and `npm run build` for checks.

InsightFace downloads its `buffalo_l` model on first use. Provision model-cache storage and warm the model before enabling photo matching; do not download model weights during a disaster response. Face matching and geospatial fields are sensitive personal data and require valid consent.

## Deploy

- **Vercel:** set the project root to `frontend`, use `npm run build`, output `dist`, and configure `VITE_API_BASE_URL`, `VITE_MAP_PROVIDER`, and the corresponding public map key. `frontend/vercel.json` provides SPA routing. Map keys must be restricted by domain and API.
- **Render:** deploy from the repository using `render.yaml` / `backend/Dockerfile`. Configure all secret environment variables in the Render dashboard, set exact allowed CORS origins, and use a persistent model cache or pre-baked weights. `/health` is the health check.
- **Supabase:** use separate development/staging/production projects. Enable Auth email policies, review RLS policies with tests, retain the photo bucket as private, use signed URLs with short TTLs, and back up PostgreSQL. Never use the service-role key in a browser.
- **Notifications:** Resend API key or SMTP settings enable email delivery. Firebase Admin credentials enable FCM. An unconfigured channel returns `pending`, not a false `sent`; failed sends are recorded with an error.

## Release checklist

- Run CI, migrations on staging, API authorization/RLS tests, and upload/signed-URL tests.
- Confirm the backend is using a durable repository and validates Supabase JWTs against the production issuer.
- Verify no seeded/demo account or synthetic content is exposed publicly.
- Exercise offline report/photo sync, retries, duplicate delivery, authority rejection, verification, notification failure, reunification, and closure.
- Confirm retention/deletion policy and incident response contacts with the deploying organization.

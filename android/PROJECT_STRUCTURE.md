# Android Project Structure

This folder contains two production Android apps and shared Android code.

Apps:

- `admin-app` — Admin Android App
- `customer-app` — Customer Android App
- `shared` — shared API client, models, design system, session handling, i18n, formatting, status enums

Backend:

- Production API base URL: `https://crm.ayartuerk.me`
- API version: `/api/v1`
- Source of truth: `cloudflare-worker/`
- Database: Cloudflare D1

Important rule:

Do not use `android-api-worker/` for production Android apps. Android apps use the shared backend in `cloudflare-worker/`.

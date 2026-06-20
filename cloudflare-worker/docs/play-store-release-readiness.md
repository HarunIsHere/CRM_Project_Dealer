# Google Play Store Release Readiness

This project will have two Android apps:

1. Admin Android app
2. Customer Android app

Both apps use the same Cloudflare Worker backend and D1 database.

Base API:

https://crm.ayartuerk.me

## App package names

Final package names must be decided before Play Store upload.

Suggested structure:

Admin app:
com.horizend.crm.admin

Customer app:
com.horizend.crm.customer

Do not change package names after production release unless absolutely necessary.

## App names

Suggested public names:

Admin app:
Horizend Admin

Customer app:
Horizend

These can be changed later before Play Store listing.

## Backend requirements before release

Required:

- Production API base URL fixed
- HTTPS only
- No raw customer_id authentication
- Customer app uses bearer token session
- Admin app uses admin bearer token
- Android app messages saved with platform = android
- Telegram webhook remains unchanged
- Admin web remains working
- API contract documented

Already done:

- Public catalog API
- Public meeting point API
- Customer session/auth API
- Customer cart API
- Customer checkout API
- Customer order API
- Admin login/session API
- Admin order API
- Admin order status API
- Admin product/category APIs
- Admin meeting point APIs
- Admin customer APIs
- Admin settings API
- Android API contract document

## Privacy policy

A public privacy policy URL will be required before store submission.

It must explain:

- What customer data is collected
- Why customer data is collected
- How order/location data is used
- How admin users access orders
- How users can request deletion
- Contact email
- Backend provider: Cloudflare
- Messaging integration: Telegram, if Telegram remains part of user flow

Suggested future URL:

https://horizend.com/privacy

Temporary URL can be added later if needed.

## Data collected

Expected Customer app data:

- Name or display name
- Optional username
- Device/session identifier
- Cart/order data
- Delivery address or pickup location
- Google Maps location link if customer provides location
- Language preference
- App version/platform info

Expected Admin app data:

- Admin username
- Session token
- Admin actions/audit logs
- Order status updates
- Customer replies if sent from admin app

## Sensitive permissions

Avoid unnecessary Android permissions.

Customer app likely needs:

- Internet
- Optional location permission only if customer chooses current location

Admin app likely needs:

- Internet
- Notifications later, if push notifications are added

Avoid requesting contacts, camera, microphone, SMS, call log, or storage unless clearly needed.

## Data deletion

Before release, add a simple deletion policy.

Minimum requirement:

- Customer can contact support to request deletion
- Admin can delete customer records from admin interface/API
- Orders may be retained if required for business records

Future backend improvement:

- Add customer account deletion endpoint
- Add admin export/delete tools

## Play Store assets

Needed before upload:

- App icon
- Feature graphic
- Screenshots for phone
- Short description
- Full description
- Privacy policy URL
- Support email
- App category
- Content rating questionnaire
- Data safety form
- Signed release build
- Internal testing track before production

## Release tracks

Recommended order:

1. Internal testing
2. Closed testing
3. Open testing if needed
4. Production

## Build signing

Use Google Play App Signing.

Keep local upload keystore backed up securely.

Do not commit keystore files, passwords, service account files, or Play Console credentials to GitHub.

## Android API reference

See:

docs/android-api-contract.md

## Final reminder

Before Play Store submission, verify current Google Play policy requirements directly in Play Console because policy wording and forms can change.

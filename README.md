# CRM Project Dealer

Telegram-first CRM automation system for handling customer messages, products, meeting points, admin notifications, working hours, and unresolved-message routing.

## Public URL

https://crm.ayartuerk.me/admin/

The root domain https://ayartuerk.me is not used for this app because it already serves another website.

## Main features

- Telegram customer message intake
- Rule-based replies
- Fuzzy matching with RapidFuzz
- Product list and product-specific replies
- Meeting-point replies with Google Maps links
- Working-hours restrictions
- Admin Telegram notification for unresolved requests
- Admin dashboard for products, meeting points, customers, settings, and history
- JWT-cookie protected admin login
- Telegram inline buttons:
  - 1. Products
  - 2. Location
  - 3. Contact admin

## Local app

The FastAPI app runs locally on:

http://127.0.0.1:8001

Manual start:

~/bin/run_crm_app.sh

Project startup script:

scripts/run_crm_app.sh

## Cloudflare Tunnel

Public hostname:

crm.ayartuerk.me

Tunnel name:

crm-dealer

Tunnel config:

~/.cloudflared/crm-dealer.yml

Manual start:

~/bin/run_crm_tunnel.sh

Project startup script:

scripts/run_crm_tunnel.sh

## macOS auto-start

The app and tunnel run through LaunchAgents.

App:

~/Library/LaunchAgents/com.harun.crm-dealer-app.plist

Tunnel:

~/Library/LaunchAgents/com.harun.crm-dealer-tunnel.plist

Check status:

launchctl print gui/$(id -u)/com.harun.crm-dealer-app | grep state
launchctl print gui/$(id -u)/com.harun.crm-dealer-tunnel | grep state

Expected:

state = running
state = running

Restart app:

launchctl bootout gui/$(id -u) ~/Library/LaunchAgents/com.harun.crm-dealer-app.plist 2>/dev/null || true
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.harun.crm-dealer-app.plist

Restart tunnel:

launchctl bootout gui/$(id -u) ~/Library/LaunchAgents/com.harun.crm-dealer-tunnel.plist 2>/dev/null || true
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.harun.crm-dealer-tunnel.plist

## Logs

App logs:

/tmp/crm-dealer-app.out.log
/tmp/crm-dealer-app.err.log

Tunnel logs:

/tmp/crm-dealer-tunnel.out.log
/tmp/crm-dealer-tunnel.err.log

## Environment variables

Required in .env and not committed:

TELEGRAM_BOT_TOKEN=
ADMIN_USERNAME=
ADMIN_PASSWORD=
ADMIN_JWT_SECRET=

The app refuses to start if admin credentials or JWT secret are missing or weak.

## Admin authentication

Admin login:

https://crm.ayartuerk.me/admin/login

Authentication uses a JWT stored in an HTTP-only cookie.

## Useful commands

Run locally:

uvicorn app.main:app --host 127.0.0.1 --port 8001

Check public status:

curl -L -s -o /dev/null -w "%{http_code}\n" https://crm.ayartuerk.me/admin/

Check Git status:

git status

## Repository

https://github.com/HarunIsHere/CRM_Project_Dealer.git

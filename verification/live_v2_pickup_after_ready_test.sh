#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

if [ -f ".env" ]; then
  set -a
  source .env
  set +a
fi

API_BASE="https://crm.ayartuerk.me/api/v1"

ADMIN_TOKEN="$(curl -sS "$API_BASE/admin/login" \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"$ADMIN_USERNAME\",\"password\":\"$ADMIN_PASSWORD\"}" \
  | python3 -c 'import json,sys; data=json.load(sys.stdin); print(data.get("access_token") or "")')"

CUSTOMER_TOKEN="$(curl -sS "$API_BASE/customer/session/start" \
  -H "Content-Type: application/json" \
  -d '{"full_name":"V2 Smoke Customer","username":"v2_smoke","preferred_language":"en","device_id":"v2-smoke-cli","platform":"smoke","app_version":"v2-smoke"}' \
  | python3 -c 'import json,sys; data=json.load(sys.stdin); print(data["session"]["access_token"])')"

PRODUCT_ID="$(curl -sS "$API_BASE/public/catalog" \
  | python3 -c 'import json,sys; data=json.load(sys.stdin); print(data["catalog"]["products"][0]["id"])')"

echo "==== add item after pickup is ready ===="
curl -sS "$API_BASE/customer/cart/items" \
  -H "Authorization: Bearer $CUSTOMER_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"product_id\":$PRODUCT_ID,\"quantity\":1}" \
  | python3 -m json.tool | head -120

echo
echo "==== checkout pickup again after ready ===="
curl -sS "$API_BASE/customer/checkout/pickup" \
  -H "Authorization: Bearer $CUSTOMER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"notes":"V2 smoke pickup after ready"}' \
  | python3 -m json.tool | head -240

echo
echo "==== admin order after pickup-after-ready checkout ===="
curl -sS "$API_BASE/admin/customer-app-orders" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  | python3 -m json.tool | head -260

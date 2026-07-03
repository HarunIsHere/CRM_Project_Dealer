#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

if [ -f ".env" ]; then
  set -a
  source .env
  set +a
fi

API_BASE="https://crm.ayartuerk.me/api/v1"

echo "==== admin login ===="
ADMIN_LOGIN_JSON="$(curl -sS "$API_BASE/admin/login" \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"$ADMIN_USERNAME\",\"password\":\"$ADMIN_PASSWORD\"}")"

ADMIN_TOKEN="$(printf '%s' "$ADMIN_LOGIN_JSON" | python3 -c 'import json,sys; data=json.load(sys.stdin); print(data.get("access_token") or data.get("data",{}).get("access_token") or "")')"

if [ -z "$ADMIN_TOKEN" ]; then
  echo "$ADMIN_LOGIN_JSON"
  echo "Admin login failed"
  exit 1
fi
echo "admin login ok"

echo
echo "==== customer session start ===="
CUSTOMER_JSON="$(curl -sS "$API_BASE/customer/session/start" \
  -H "Content-Type: application/json" \
  -d '{"full_name":"V2 Smoke Customer","username":"v2_smoke","preferred_language":"en","device_id":"v2-smoke-cli","platform":"smoke","app_version":"v2-smoke"}')"

CUSTOMER_TOKEN="$(printf '%s' "$CUSTOMER_JSON" | python3 -c 'import json,sys; data=json.load(sys.stdin); session=data.get("session") or data.get("data",{}).get("session") or {}; print(session.get("access_token") or "")')"

if [ -z "$CUSTOMER_TOKEN" ]; then
  echo "$CUSTOMER_JSON"
  echo "Customer session failed"
  exit 1
fi
echo "customer session ok"

echo
echo "==== customer session verify ===="
curl -sS "$API_BASE/customer/session/verify" \
  -H "Authorization: Bearer $CUSTOMER_TOKEN" \
  | python3 -m json.tool | head -40

echo
echo "==== first active product ===="
CATALOG_JSON="$(curl -sS "$API_BASE/public/catalog")"
PRODUCT_ID="$(printf '%s' "$CATALOG_JSON" | python3 -c 'import json,sys; data=json.load(sys.stdin); catalog=data.get("catalog") or data.get("data",{}).get("catalog") or {}; products=catalog.get("products") or []; print(products[0]["id"] if products else "")')"

if [ -z "$PRODUCT_ID" ]; then
  echo "$CATALOG_JSON"
  echo "No product found"
  exit 1
fi

echo "product id: $PRODUCT_ID"

echo
echo "==== cart before ===="
curl -sS "$API_BASE/customer/cart" \
  -H "Authorization: Bearer $CUSTOMER_TOKEN" \
  | python3 -m json.tool | head -80

echo
echo "==== add cart item ===="
curl -sS "$API_BASE/customer/cart/items" \
  -H "Authorization: Bearer $CUSTOMER_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"product_id\":$PRODUCT_ID,\"quantity\":1}" \
  | python3 -m json.tool | head -120

echo
echo "==== cart after ===="
curl -sS "$API_BASE/customer/cart" \
  -H "Authorization: Bearer $CUSTOMER_TOKEN" \
  | python3 -m json.tool | head -120

echo
echo "==== admin customer app orders ===="
curl -sS "$API_BASE/admin/customer-app-orders" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  | python3 -m json.tool | head -160

echo
echo "live V2 smoke checks completed"

echo
echo "==== pickup checkout ===="
curl -sS "$API_BASE/customer/checkout/pickup" \
  -H "Authorization: Bearer $CUSTOMER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"notes":"V2 smoke pickup checkout"}' \
  | python3 -m json.tool | head -180

echo
echo "==== admin customer app orders after checkout ===="
curl -sS "$API_BASE/admin/customer-app-orders" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  | python3 -m json.tool | head -220

echo
echo "==== admin mark pickup ready ===="
ORDER_ID="$(curl -sS "$API_BASE/admin/customer-app-orders" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  | python3 -c 'import json,sys; data=json.load(sys.stdin); orders=data.get("orders") or []; pickup=[o for o in orders if o.get("fulfillment_type")=="pickup" and o.get("pickup_status")!="ready_to_pickup"]; print(pickup[0]["id"] if pickup else "")')"

if [ -z "$ORDER_ID" ]; then
  echo "No pickup order found for ready-to-pickup test"
  exit 1
fi

echo "order id: $ORDER_ID"

curl -sS "$API_BASE/admin/customer-app-orders/$ORDER_ID/ready-to-pickup" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"note":"V2 smoke ready pickup"}' \
  | python3 -m json.tool | head -220

#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

if [ -f ".env" ]; then
  set -a
  source .env
  set +a
fi

API_BASE="https://crm.ayartuerk.me/api/v1"
TS="$(date +%s)"

ADMIN_TOKEN="$(curl -sS "$API_BASE/admin/login" \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"$ADMIN_USERNAME\",\"password\":\"$ADMIN_PASSWORD\"}" \
  | python3 -c 'import json,sys; data=json.load(sys.stdin); print(data.get("access_token") or "")')"

CUSTOMER_TOKEN="$(curl -sS "$API_BASE/customer/session/start" \
  -H "Content-Type: application/json" \
  -d "{\"full_name\":\"V2 Delivery Cancel Customer $TS\",\"username\":\"v2_delivery_cancel_$TS\",\"preferred_language\":\"en\",\"device_id\":\"v2-delivery-cancel-$TS\",\"platform\":\"smoke\",\"app_version\":\"v2-smoke\"}" \
  | python3 -c 'import json,sys; data=json.load(sys.stdin); print(data["session"]["access_token"])')"

PRODUCT_ID="$(curl -sS "$API_BASE/public/catalog" \
  | python3 -c 'import json,sys; data=json.load(sys.stdin); print(data["catalog"]["products"][0]["id"])')"

echo "==== add cart item ===="
curl -sS "$API_BASE/customer/cart/items" \
  -H "Authorization: Bearer $CUSTOMER_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"product_id\":$PRODUCT_ID,\"quantity\":1}" \
  | python3 -m json.tool | head -80

echo
echo "==== create delivery order ===="
ORDER_ID="$(curl -sS "$API_BASE/customer/checkout/address" \
  -H "Authorization: Bearer $CUSTOMER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"address":"Selchower Str. 10, 12049 Berlin","label":"Smoke test delivery cancel location","google_maps_link":"https://maps.google.com/?q=Selchower%20Str.%2010%2C%2012049%20Berlin","notes":"V2 smoke delivery cancel after patch"}' \
  | python3 -c 'import json,sys; data=json.load(sys.stdin); print(data["order"]["id"])')"

echo "order id: $ORDER_ID"

echo
echo "==== cancel delivery order ===="
curl -sS "$API_BASE/admin/customer-app-orders/$ORDER_ID/cancel" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"reason":"V2 smoke cancel delivery after patch"}' \
  | python3 -m json.tool | head -260

echo
echo "==== assert cancelled delivery detail ===="
curl -sS "$API_BASE/admin/customer-app-orders/$ORDER_ID" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  | python3 -c 'import json,sys
data=json.load(sys.stdin)
o=data.get("order") or {}
cancelled=((o.get("section_totals") or {}).get("cancelled") or {})
print("ok:", data.get("ok"))
print("order_status:", o.get("order_status"))
print("delivery_status:", o.get("delivery_status"))
print("delivery_status_label:", o.get("delivery_status_label"))
print("total_amount:", o.get("total_amount"))
print("cancelled_total:", cancelled.get("total_amount"))
if not data.get("ok"):
    sys.exit(1)
if o.get("order_status")!="cancelled":
    sys.exit(1)
if o.get("delivery_status")!="cancelled":
    sys.exit(1)
if o.get("delivery_status_label")!="Cancelled":
    sys.exit(1)
if o.get("total_amount") != 0:
    sys.exit(1)
if cancelled.get("total_amount") != 5000:
    sys.exit(1)
print("PASSED: delivery cancellation override works after patch")'

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
  -d '{"full_name":"V2 Delivery Valid Customer","username":"v2_delivery_valid","preferred_language":"en","device_id":"v2-delivery-valid-cli","platform":"smoke","app_version":"v2-smoke"}' \
  | python3 -c 'import json,sys; data=json.load(sys.stdin); print(data["session"]["access_token"])')"

PRODUCT_ID="$(curl -sS "$API_BASE/public/catalog" \
  | python3 -c 'import json,sys; data=json.load(sys.stdin); print(data["catalog"]["products"][0]["id"])')"

echo "==== add delivery addition cart item for rejection ===="
curl -sS "$API_BASE/customer/cart/items" \
  -H "Authorization: Bearer $CUSTOMER_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"product_id\":$PRODUCT_ID,\"quantity\":1}" \
  | python3 -m json.tool | head -100

echo
echo "==== checkout delivery addition for rejection ===="
curl -sS "$API_BASE/customer/checkout/address" \
  -H "Authorization: Bearer $CUSTOMER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"address":"Selchower Str. 10, 12049 Berlin","label":"Smoke test delivery location","google_maps_link":"https://maps.google.com/?q=Selchower%20Str.%2010%2C%2012049%20Berlin","notes":"V2 smoke delivery rejection addition"}' \
  | python3 -m json.tool | head -220

echo
echo "==== find pending delivery group ===="
PENDING_INFO="$(curl -sS "$API_BASE/admin/customer-app-orders" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  | python3 -c 'import json,sys; data=json.load(sys.stdin); orders=data.get("orders") or [];
for o in orders:
    if o.get("fulfillment_type")=="delivery":
        for g in o.get("groups") or []:
            if g.get("group_status")=="pending_admin_approval":
                print(str(o["id"]) + ":" + str(g["id"]))
                raise SystemExit
print("")')"

if [ -z "$PENDING_INFO" ]; then
  echo "No pending delivery group found"
  exit 1
fi

ORDER_ID="${PENDING_INFO%%:*}"
GROUP_ID="${PENDING_INFO##*:}"

echo "order id: $ORDER_ID"
echo "group id: $GROUP_ID"

echo
echo "==== reject pending delivery group ===="
curl -sS "$API_BASE/admin/customer-app-orders/$ORDER_ID/groups/$GROUP_ID/reject" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"note":"V2 smoke reject delivery addition"}' \
  | python3 -m json.tool | head -300

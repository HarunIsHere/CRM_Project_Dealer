#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

if [ -f ".env" ]; then
  set -a
  source .env
  set +a
fi

API_BASE="https://crm.ayartuerk.me/api/v1"

CUSTOMER_TOKEN="$(curl -sS "$API_BASE/customer/session/start" \
  -H "Content-Type: application/json" \
  -d '{"full_name":"V2 Delivery Validation Customer","username":"v2_delivery_validation","preferred_language":"en","device_id":"v2-delivery-validation-cli","platform":"smoke","app_version":"v2-smoke"}' \
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
echo "==== delivery checkout with weak address Berlin ===="
RESPONSE="$(curl -sS "$API_BASE/customer/checkout/address" \
  -H "Authorization: Bearer $CUSTOMER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"address":"Berlin","notes":"weak address test"}')"

printf '%s\n' "$RESPONSE" | python3 -m json.tool | head -180

echo
echo "==== validation assertion ===="
RESPONSE="$RESPONSE" python3 - <<'PY'
import json, os, sys

data = json.loads(os.environ["RESPONSE"])

if data.get("ok") is True and data.get("order"):
    print("FAILED: weak address created an order")
    sys.exit(1)

error = data.get("error") or {}
code = error.get("code") or data.get("code") or ""

if code not in {"delivery_location_required", "delivery_location_needs_confirmation"}:
    print(f"FAILED: unexpected response code: {code}")
    sys.exit(1)

print(f"PASSED: weak address blocked with code: {code}")
PY

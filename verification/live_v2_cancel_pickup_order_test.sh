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

ORDER_ID="$(curl -sS "$API_BASE/admin/customer-app-orders" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  | python3 -c 'import json,sys; data=json.load(sys.stdin); orders=data.get("orders") or []; active=[o for o in orders if o.get("order_status")!="cancelled" and o.get("fulfillment_type")=="pickup"]; print(active[0]["id"] if active else "")')"

if [ -z "$ORDER_ID" ]; then
  echo "No active pickup order found for cancel test"
  exit 1
fi

echo "order id: $ORDER_ID"

echo
echo "==== admin cancel pickup order ===="
curl -sS "$API_BASE/admin/customer-app-orders/$ORDER_ID/cancel" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"reason":"V2 smoke cancel pickup order"}' \
  | python3 -m json.tool | head -340

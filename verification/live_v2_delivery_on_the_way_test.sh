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
  | python3 -c 'import json,sys; data=json.load(sys.stdin); orders=data.get("orders") or []; delivery=[o for o in orders if o.get("fulfillment_type")=="delivery" and o.get("delivery_status")!="on_the_way"]; print(delivery[0]["id"] if delivery else "")')"

if [ -z "$ORDER_ID" ]; then
  echo "No delivery order found for on-the-way test"
  exit 1
fi

echo "order id: $ORDER_ID"

echo
echo "==== admin mark delivery on the way ===="
curl -sS "$API_BASE/admin/customer-app-orders/$ORDER_ID/on-the-way" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"note":"V2 smoke delivery on the way"}' \
  | python3 -m json.tool | head -260

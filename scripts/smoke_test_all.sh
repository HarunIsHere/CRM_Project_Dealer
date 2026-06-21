#!/usr/bin/env bash
set -euo pipefail

BASE_URL="https://crm.ayartuerk.me/api/v1"

echo "== Public API smoke tests =="

for endpoint in \
  "/health" \
  "/capabilities" \
  "/public/catalog" \
  "/public/meeting-points" \
  "/public/shops" \
  "/public/payment-methods"
do
  echo "Testing ${BASE_URL}${endpoint}"
  curl -fsS "${BASE_URL}${endpoint}" > /tmp/crm-smoke-response.json
  python3 - <<'PY'
import json
from pathlib import Path

data = json.loads(Path("/tmp/crm-smoke-response.json").read_text())
if data.get("ok") is not True:
    raise SystemExit(f"API returned ok != true: {data}")
PY
done

echo "== Android build smoke tests =="

export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
export PATH="$JAVA_HOME/bin:$PATH"

cd android
./gradlew :shared:assemble :admin-app:assembleDebug :customer-app:assembleDebug
cd ..

echo "== Apple build smoke tests =="

xcodegen generate --spec apple/project.yml
xcodebuild -project apple/CRMDeliveryApple.xcodeproj -scheme AdminApp -sdk iphonesimulator -destination 'generic/platform=iOS Simulator' build
xcodebuild -project apple/CRMDeliveryApple.xcodeproj -scheme CustomerApp -sdk iphonesimulator -destination 'generic/platform=iOS Simulator' build

echo "== Telegram mini-app build smoke test =="

cd telegram/mini-app
npm run build
cd ../..

echo "== Cloudflare Worker smoke test =="

cd cloudflare-worker
node --check src/index.js
npx wrangler deploy --dry-run
cd ..

echo "All smoke tests passed."

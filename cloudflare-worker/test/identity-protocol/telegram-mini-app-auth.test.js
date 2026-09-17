import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  verifyTelegramMiniAppInitData
} from "../../src/identity/customer/telegram-init-data.js";
import {
  CUSTOMER_TELEGRAM_AUTH_ROUTE
} from "../../src/identity/customer/telegram-http.js";

const BOT_TOKEN = "123456:telegram-test-token";
const NOW_SECONDS = 1_800_000_000;
const NOW = new Date(NOW_SECONDS * 1000);

function signedInitData({
  authDate = NOW_SECONDS,
  user = {
    id: "9007199254740993",
    first_name: "Ada",
    username: "ada",
    language_code: "en"
  },
  queryId = "AAHdF6IQAAAAAN0XohDhrOrc",
  signature = "telegram-ed25519-signature"
} = {}) {
  const values = {
    auth_date: String(authDate),
    query_id: queryId,
    signature,
    user: JSON.stringify(user).replace(
      /("id"\s*:\s*)"([0-9]+)"/,
      "$1$2"
    )
  };
  const dataCheckString = Object.entries(values)
    .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");
  const secret = createHmac("sha256", "WebAppData")
    .update(BOT_TOKEN)
    .digest();
  const hash = createHmac("sha256", secret)
    .update(dataCheckString)
    .digest("hex");
  return Object.entries({ ...values, hash })
    .map(([key, value]) => (
      `${encodeURIComponent(key)}=${encodeURIComponent(value)}`
    ))
    .join("&");
}

test("valid Telegram initData verifies without losing the digit-string subject", async () => {
  const verified = await verifyTelegramMiniAppInitData(
    signedInitData(),
    BOT_TOKEN,
    { now: NOW }
  );

  assert.equal(verified.user.id, "9007199254740993");
  assert.equal(verified.user.username, "ada");
  assert.equal(verified.authDate, NOW_SECONDS);
  assert.match(verified.dataCheckString, /signature=telegram-ed25519-signature/);
});

test("forged, stale, future, duplicate, and malformed initData fail generically", async () => {
  const valid = signedInitData();
  const cases = [
    valid.replace(/hash=[^&]+/, `hash=${"0".repeat(64)}`),
    signedInitData({ authDate: NOW_SECONDS - 301 }),
    signedInitData({ authDate: NOW_SECONDS + 31 }),
    `${valid}&auth_date=${NOW_SECONDS}`,
    `${valid}&broken=%E0%A4%A`
  ];

  for (const value of cases) {
    await assert.rejects(
      verifyTelegramMiniAppInitData(value, BOT_TOKEN, { now: NOW }),
      (error) => error?.code === "invalid_telegram_authorization"
    );
  }
});

test("Mini App uses the exact Telegram auth route and keeps bearer state out of storage", async () => {
  const [apiSource, mainSource, serviceSource, indexSource] = await Promise.all([
    readFile(new URL("../../../telegram/mini-app/src/api.ts", import.meta.url), "utf8"),
    readFile(new URL("../../../telegram/mini-app/src/main.ts", import.meta.url), "utf8"),
    readFile(new URL("../../src/identity/service.js", import.meta.url), "utf8"),
    readFile(new URL("../../src/index.js", import.meta.url), "utf8")
  ]);

  assert.equal(CUSTOMER_TELEGRAM_AUTH_ROUTE, "/api/v1/customer/auth/telegram");
  assert.match(apiSource, /customer\/auth\/telegram/);
  assert.match(apiSource, /init_data: input\.initData/);
  assert.doesNotMatch(apiSource, /device_id|customer\/session\/start/);
  assert.doesNotMatch(mainSource, /localStorage|initDataUnsafe/);
  assert.match(mainSource, /tg\?\.initData/);
  assert.match(mainSource, /sessionStorage\.getItem/);
  assert.doesNotMatch(
    mainSource,
    /sessionStorage\.setItem\([^,]+,\s*accessToken/
  );
  assert.match(serviceSource, /handleCustomerTelegramAuthentication/);
  assert.match(
    indexSource,
    /request\.method === "OPTIONS"[\s\S]*handleIdentityApi\(request, env, ctx\)/
  );
  assert.match(
    indexSource,
    /async function handlePublicShopsApi[\s\S]*return apiOk\(\{ shops \}\);/
  );
  assert.match(
    indexSource,
    /async function handlePublicPaymentMethodsApi[\s\S]*return apiOk\(\{[\s\S]*payment_methods:/
  );
  assert.doesNotMatch(
    mainSource,
    /catch \(error\) \{\s*accessToken = "";\s*message = `Loading failed:/
  );
});

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const indexSource = await readFile(
  new URL("../src/index.js", import.meta.url),
  "utf8"
);

function functionSource(startMarker, nextMarker) {
  const start = indexSource.indexOf(startMarker);
  const end = indexSource.indexOf(nextMarker, start + startMarker.length);

  assert.notEqual(start, -1, `${startMarker} is missing`);
  assert.notEqual(end, -1, `${nextMarker} is missing`);
  return indexSource.slice(start, end);
}

test("guest creation never restores identity from device metadata", () => {
  assert.doesNotMatch(indexSource, /getExistingAppCustomerByDeviceId/);

  const source = functionSource(
    "async function createAppCustomer(",
    "async function createCustomerAppSession("
  );

  assert.doesNotMatch(source, /device_id|deviceId/);
  assert.match(source, /makeMobileCustomerIdentity\(\)/);
  assert.match(source, /INSERT INTO customers/);
});

test("customer bearer sessions bind to canonical account state", () => {
  const source = functionSource(
    "async function getApiCustomerSession(",
    "async function requireApiCustomerSession("
  );

  assert.match(source, /JOIN auth_accounts a/);
  assert.match(source, /c\.auth_account_id = s\.auth_account_id/);
  assert.match(source, /a\.realm = 'customer'/);
  assert.match(source, /a\.status = 'active'/);
  assert.match(source, /s\.issued_auth_version = a\.auth_version/);
});

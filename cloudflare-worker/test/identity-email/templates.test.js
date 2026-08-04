import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  listIdentityEmailTemplateKeys,
  renderAuthEmail,
  renderIdentityEmail
} from "../../src/identity/email/templates.js";
import { getIdentityEmailTemplatePolicy } from "../../src/identity/email/policy.js";

const catalog = JSON.parse(
  readFileSync(
    new URL("../../../shared/i18n/identity_email_templates.json", import.meta.url),
    "utf8"
  )
);

const TIMESTAMP = "2026-08-02T12:00:00.000Z";

function variablesFor(templateKey, overrides = {}) {
  const definition = catalog.templates[templateKey];
  const values = {};
  for (const [name, type] of Object.entries(definition.variables)) {
    switch (type) {
      case "username":
        values[name] = "staff-user";
        break;
      case "staff_role":
        values[name] = "admin";
        break;
      case "first_party_auth_url":
        values[name] = [
          "https://crm.ayartuerk.me",
          getIdentityEmailTemplatePolicy(templateKey).landingPath,
          "#token=",
          "A".repeat(43)
        ].join("");
        break;
      case "email_code":
        values[name] = "12345678";
        break;
      case "rfc3339_timestamp":
        values[name] = TIMESTAMP;
        break;
      default:
        throw new Error(`unsupported test variable type: ${type}`);
    }
  }
  return { ...values, ...overrides };
}

test("the renderer exposes every canonical identity email template key", () => {
  const canonicalKeys = Object.keys(catalog.templates).sort();
  const renderedKeys = listIdentityEmailTemplateKeys().sort();

  assert.equal(canonicalKeys.length, 25);
  assert.deepEqual(renderedKeys, canonicalKeys);
});

test("all templates render text and HTML in all five supported locales", () => {
  const templateKeys = listIdentityEmailTemplateKeys();
  assert.deepEqual(catalog.supported_locales, ["en", "de", "tr", "ar", "ru"]);

  for (const locale of catalog.supported_locales) {
    const expectedDirection = locale === "ar" ? "rtl" : "ltr";

    for (const templateKey of templateKeys) {
      const definition = catalog.templates[templateKey];
      const rendered = renderIdentityEmail(
        templateKey,
        locale,
        variablesFor(templateKey)
      );

      assert.equal(rendered.template_key, templateKey);
      assert.equal(rendered.locale, locale);
      assert.equal(rendered.direction, expectedDirection);
      assert.deepEqual(rendered.from, {
        email: "security@auth.ayartuerk.me",
        name: "CRM Delivery Security"
      });
      assert.ok(rendered.subject.trim(), `${templateKey}/${locale} subject`);
      assert.ok(rendered.text.trim(), `${templateKey}/${locale} text`);
      assert.ok(rendered.html.trim(), `${templateKey}/${locale} html`);
      assert.match(
        rendered.html,
        new RegExp(`<html lang="${locale}" dir="${expectedDirection}">`)
      );
      assert.doesNotMatch(rendered.subject, /\{[a-z][a-z0-9_]*\}/);
      assert.doesNotMatch(rendered.text, /\{[a-z][a-z0-9_]*\}/);
      assert.doesNotMatch(rendered.html, /\{[a-z][a-z0-9_]*\}/);

      if (definition.layout.includes("link")) {
        assert.match(rendered.text, /https:\/\/crm\.ayartuerk\.me\/auth\//);
        assert.match(rendered.html, /https:\/\/crm\.ayartuerk\.me\/auth\//);
      }
      if (definition.layout.includes("code")) {
        assert.match(rendered.text, /12345678/);
        assert.match(rendered.html, /12345678/);
      }
    }
  }
});

test("Arabic output is explicitly RTL", () => {
  const templateKey = "auth.customer.step_up.email.v1";
  const rendered = renderIdentityEmail(
    templateKey,
    "ar",
    variablesFor(templateKey)
  );

  assert.equal(rendered.direction, "rtl");
  assert.match(rendered.html, /<html lang="ar" dir="rtl">/);
  assert.match(rendered.html, /text-align:right/);
});

test("HTML escapes user-controlled values while preserving plain text", () => {
  const templateKey = "auth.staff.invitation.v1";
  const hostileUsername = `Admin <script>alert("x")</script> & Owner`;
  const rendered = renderIdentityEmail(
    templateKey,
    "en",
    variablesFor(templateKey, {
      username: hostileUsername
    })
  );

  assert.match(rendered.text, /Admin <script>alert\("x"\)<\/script> & Owner/);
  assert.doesNotMatch(rendered.html, /<script>/);
  assert.match(
    rendered.html,
    /Admin &lt;script&gt;alert\(&quot;x&quot;\)&lt;\/script&gt; &amp; Owner/
  );
});

test("authentication links reject non-first-party, insecure, query-token, and malformed URLs", () => {
  const templateKey = "auth.staff.invitation.v1";
  const landingPath = getIdentityEmailTemplatePolicy(templateKey).landingPath;
  const badUrls = [
    `http://crm.ayartuerk.me${landingPath}#token=${"A".repeat(43)}`,
    `https://evil.example${landingPath}#token=${"A".repeat(43)}`,
    `https://crm.ayartuerk.me${landingPath}?token=${"A".repeat(43)}`,
    `https://crm.ayartuerk.me${landingPath}#token=${"A".repeat(42)}`,
    `https://crm.ayartuerk.me/auth/customer/continue#token=${"A".repeat(43)}`
  ];

  for (const action_url of badUrls) {
    assert.throws(
      () => renderIdentityEmail(
        templateKey,
        "en",
        variablesFor(templateKey, { action_url })
      ),
      TypeError
    );
  }
});

test("unknown templates and non-exact variable sets are rejected", () => {
  assert.throws(
    () => renderIdentityEmail("auth.unknown.v1", "en", {}),
    RangeError
  );

  const templateKey = "auth.customer.step_up.email.v1";
  const variables = variablesFor(templateKey);

  assert.throws(
    () => renderIdentityEmail(templateKey, "en", { ...variables, extra: "no" }),
    TypeError
  );
  assert.throws(
    () => renderIdentityEmail(
      templateKey,
      "en",
      { expires_at: variables.expires_at }
    ),
    TypeError
  );
});

test("unknown locale falls back to English and renderAuthEmail is the canonical alias", () => {
  const templateKey = "auth.customer.step_up.email.v1";
  const variables = variablesFor(templateKey);

  const fallback = renderIdentityEmail(templateKey, "xx", variables);
  const alias = renderAuthEmail(templateKey, "en", variables);

  assert.equal(fallback.locale, "en");
  assert.deepEqual(alias, fallback);
});

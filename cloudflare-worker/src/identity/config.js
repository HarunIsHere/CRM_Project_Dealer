const TRUE_VALUE = "true";

const CLIENTS = [
  "telegram_bot",
  "telegram_mini_app",
  "admin_web",
  "admin_android",
  "admin_ios",
  "customer_web",
  "customer_android",
  "customer_ios"
];

const FLAG_NAMES = {
  schemaReady: "CRM_AUTH_SCHEMA_READY",
  canonicalResolver: "CRM_AUTH_CANONICAL_RESOLVER",
  customerBoundary: "CRM_AUTH_CUSTOMER_BOUNDARY",
  telegramVerification: "CRM_AUTH_TELEGRAM_VERIFICATION",
  staffReconciled: "CRM_AUTH_STAFF_RECONCILED",
  staffBootstrapEnrollment: "CRM_AUTH_STAFF_BOOTSTRAP_ENROLLMENT",
  staffEnrollment: "CRM_AUTH_STAFF_ENROLLMENT",
  customerPasskeys: "CRM_AUTH_CUSTOMER_PASSKEYS",
  staffPasskeys: "CRM_AUTH_STAFF_PASSKEYS",
  emailDelivery: "CRM_AUTH_EMAIL_DELIVERY",
  staffRecovery: "CRM_AUTH_STAFF_RECOVERY",
  customerEmail: "CRM_AUTH_CUSTOMER_EMAIL",
  customerMerge: "CRM_AUTH_CUSTOMER_MERGE",
  legacyLoginDisabled: "CRM_AUTH_LEGACY_LOGIN_DISABLED",
  customerWebauthnReady: "CRM_AUTH_CUSTOMER_WEBAUTHN_READY",
  staffWebauthnReady: "CRM_AUTH_STAFF_WEBAUTHN_READY"
};

function flag(env, name) {
  return String(env?.[name] ?? "").trim().toLowerCase() === TRUE_VALUE;
}

function clientReadiness(env) {
  return Object.fromEntries(
    CLIENTS.map((client) => [
      client,
      flag(env, `CRM_AUTH_CLIENT_READY_${client.toUpperCase()}`)
    ])
  );
}

function minimumClientVersions(env) {
  return {
    admin_android: env?.CRM_AUTH_MINIMUM_ADMIN_ANDROID_VERSION || null,
    admin_ios: env?.CRM_AUTH_MINIMUM_ADMIN_IOS_VERSION || null,
    customer_android: env?.CRM_AUTH_MINIMUM_CUSTOMER_ANDROID_VERSION || null,
    customer_ios: env?.CRM_AUTH_MINIMUM_CUSTOMER_IOS_VERSION || null,
    telegram_mini_app: env?.CRM_AUTH_MINIMUM_TELEGRAM_MINI_APP_VERSION || null
  };
}

export function getIdentityCapabilities(env) {
  const schemaReady = flag(env, FLAG_NAMES.schemaReady);
  const canonicalResolver = schemaReady && flag(env, FLAG_NAMES.canonicalResolver);
  const customerBoundary = canonicalResolver && flag(env, FLAG_NAMES.customerBoundary);
  const staffReconciled = canonicalResolver && flag(env, FLAG_NAMES.staffReconciled);
  const emailDelivery = flag(env, FLAG_NAMES.emailDelivery);
  const customerWebauthnReady = flag(env, FLAG_NAMES.customerWebauthnReady);
  const staffWebauthnReady = flag(env, FLAG_NAMES.staffWebauthnReady);
  const readiness = clientReadiness(env);

  const customerGuest = customerBoundary;
  const customerEmail = (
    customerGuest
    && emailDelivery
    && flag(env, FLAG_NAMES.customerEmail)
  );
  const customerPasskeys = (
    customerGuest
    && customerWebauthnReady
    && flag(env, FLAG_NAMES.customerPasskeys)
  );
  const telegramVerification = (
    customerBoundary
    && flag(env, FLAG_NAMES.telegramVerification)
  );
  const staffBootstrapEnrollment = (
    schemaReady
    && canonicalResolver
    && emailDelivery
    && staffWebauthnReady
    && readiness.admin_web
    && !staffReconciled
    && flag(env, FLAG_NAMES.staffBootstrapEnrollment)
  );

  // Contract version 1 deliberately has no native attestation/bearer protocol.
  // Ordinary staff identity features must remain unavailable until that
  // separately approved amendment changes both this gate and the API contract.
  const nativeBearer = {
    admin_android: false,
    admin_ios: false,
    customer_android: false,
    customer_ios: false
  };
  const staffEnrollment = true;
  const staffPasskeys = true;
  const staffRecovery = true;

  return {
    contract_version: 1,
    schema_ready: schemaReady,
    canonical_resolver: canonicalResolver,
    customer_boundary: customerBoundary,
    staff_reconciled: staffReconciled,
    email_delivery: emailDelivery,
    customer_guest: customerGuest,
    customer_email: customerEmail,
    customer_passkeys: customerPasskeys,
    telegram_init_data_verification: telegramVerification,
    staff_bootstrap_enrollment: staffBootstrapEnrollment,
    staff_enrollment: staffEnrollment,
    staff_passkeys: staffPasskeys,
    staff_recovery: staffRecovery,
    customer_merge: (
      customerEmail
      && flag(env, FLAG_NAMES.customerMerge)
    ),
    native_bearer: nativeBearer,
    legacy_customer_session_start: !flag(env, FLAG_NAMES.legacyLoginDisabled),
    legacy_admin_login: !flag(env, FLAG_NAMES.legacyLoginDisabled),
    legacy_cutoff_at: env?.CRM_AUTH_LEGACY_CUTOFF_AT || null,
    client_readiness: readiness,
    minimum_client_versions: minimumClientVersions(env)
  };
}

export function isIdentityFeatureEnabled(env, feature) {
  return getIdentityCapabilities(env)[feature] === true;
}

export { CLIENTS };

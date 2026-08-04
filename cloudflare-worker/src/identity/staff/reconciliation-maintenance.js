import { reconcileEnvironmentStaffAccounts } from "./bootstrap.js";

export const STAFF_RECONCILIATION_WORKFLOW_NAME =
  "crm-environment-staff-reconciliation";
export const STAFF_RECONCILIATION_STEP_NAME =
  "reconcile-protected-environment-staff";

export class StaffReconciliationMaintenanceInvocationError extends Error {
  constructor(code) {
    super("Protected staff reconciliation maintenance invocation was rejected.");
    this.name = "StaffReconciliationMaintenanceInvocationError";
    this.code = code;
  }
}

function isEmptyPayload(payload) {
  return payload === undefined || (
    payload !== null
    && typeof payload === "object"
    && !Array.isArray(payload)
    && Object.keys(payload).length === 0
  );
}

function reject(code) {
  throw new StaffReconciliationMaintenanceInvocationError(code);
}

/**
 * Management-plane-only adapter for the idempotent environment-staff
 * reconciliation. It accepts no caller data and returns the reconciliation
 * function's existing masked result without adding fields or logging it.
 */
export async function runEnvironmentStaffReconciliationMaintenance(
  env,
  event,
  step
) {
  if (event?.workflowName !== STAFF_RECONCILIATION_WORKFLOW_NAME) {
    reject("E_STAFF_RECONCILIATION_WORKFLOW_INVALID");
  }
  if (event.schedule !== undefined) {
    reject("E_STAFF_RECONCILIATION_SCHEDULE_FORBIDDEN");
  }
  if (!isEmptyPayload(event.payload)) {
    reject("E_STAFF_RECONCILIATION_PARAMETERS_FORBIDDEN");
  }
  if (!step || typeof step.do !== "function") {
    reject("E_STAFF_RECONCILIATION_STEP_UNAVAILABLE");
  }

  return step.do(
    STAFF_RECONCILIATION_STEP_NAME,
    async () => reconcileEnvironmentStaffAccounts(env, { now: event.timestamp })
  );
}

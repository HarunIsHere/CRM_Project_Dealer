import { WorkflowEntrypoint } from "cloudflare:workers";

import {
  runEnvironmentStaffReconciliationMaintenance
} from "./reconciliation-maintenance.js";

export class EnvironmentStaffReconciliationWorkflow extends WorkflowEntrypoint {
  async run(event, step) {
    return runEnvironmentStaffReconciliationMaintenance(this.env, event, step);
  }
}

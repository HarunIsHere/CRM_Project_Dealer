# Environment staff reconciliation

Status: reviewed maintenance mechanism; this change does not deploy or run it.

## Security boundary

`EnvironmentStaffReconciliationWorkflow` is a Cloudflare Workflow exported by
the production Worker. It is created only through Cloudflare's authenticated
management API by `wrangler workflows trigger`. There is no HTTP route,
scheduled trigger, queue consumer, service-binding caller, or application UI for
this operation.

The Workflow receives the same `DB` binding and encrypted Worker secrets as the
deployed `crm-delivery-worker`. It accepts no parameters. Its sole durable step
calls `reconcileEnvironmentStaffAccounts` and returns that function's existing
masked result unchanged. It does not log the result or any configuration.

The Cloudflare Workflow event does not provide a caller identity that the Worker
can independently compare with an account role. Therefore the owner-only rule
is enforced at the management plane: before proceeding, confirm that only the
Cloudflare account owner controls credentials with `Workers Scripts Write` for
this Worker. If a non-owner retains that permission, stop; the owner-only
prerequisite is not met.

The temporary `CRM_AUTH_STAFF_RECONCILIATION_MAINTENANCE` secret is deliberately
absent during normal operation and deliberately absent from `[vars]` and the
permanent required-secret list. It is a second fail-closed control, not a value
to store in source control.

## Preconditions

1. Review the exact release diff and the focused tests.
2. Confirm migration `0014` is present remotely and the production D1 binding is
   `crm-delivery-db`.
3. Confirm the two bootstrap email, locale, owner-receipt, HMAC, fingerprint, and
   encrypted-outbox bindings are already stored on the production Worker.
4. Confirm the bootstrap destinations and locales with the owner. Never supply
   or override them as Workflow parameters.
5. From `cloudflare-worker/`, run the following and manually verify that the
   active identity is the Cloudflare account owner and the account is correct:

```bash
./node_modules/.bin/wrangler whoami
```

6. Deploying the reviewed Worker version is a separate, explicitly approved
   release action. Do not trigger a Workflow until that deployed version lists
   `crm-environment-staff-reconciliation`.

## Controlled run

Open a short owner-only maintenance window. Set the temporary gate through
Wrangler's hidden interactive prompt; do not pipe it, place it in a command
argument, use an environment file, or save it in a temporary file:

```bash
./node_modules/.bin/wrangler secret put CRM_AUTH_STAFF_RECONCILIATION_MAINTENANCE
```

Trigger with no second positional argument and no JSON payload. Do not use
`--local`; the remote Workflow is what supplies the real production bindings:

```bash
./node_modules/.bin/wrangler workflows trigger crm-environment-staff-reconciliation
```

Copy the non-secret instance ID printed by Wrangler, wait for completion, and
inspect that exact instance:

```bash
./node_modules/.bin/wrangler workflows instances describe crm-environment-staff-reconciliation <instance-id>
```

The successful output is only `outcome`, `account_count`, and the existing
masked account summaries (`role`, `locale`, `email_masked`, and
`enrollment_state`). A repeat run is safe and returns `already_reconciled`
without adding accounts, invitations, challenges, events, or outbox items.

After the instance reaches a terminal success state, remove the temporary gate
before doing anything else:

```bash
./node_modules/.bin/wrangler secret delete CRM_AUTH_STAFF_RECONCILIATION_MAINTENANCE
```

Confirm the secret deletion and record only the owner receipt, Workflow instance
ID, timestamps, and masked outcome in the maintenance record. Never copy secret
values, invitation tokens, unmasked destinations, or encrypted payloads into
the terminal log or maintenance record.

## Failure handling

- A configuration, collision, or postcondition error is fail-closed. Do not
  modify D1 rows manually and do not retry with altered parameters.
- Remove the temporary gate after the failed instance reaches a terminal state.
- Preserve the instance ID and safe error code, then review the D1 state and
  configuration before a separately approved retry.
- Do not delete or reseed legacy identities as a rollback. The reconciliation
  function either performs its exact atomic creation or makes no partial change.

## References

- [Cloudflare Workflows Workers API](https://developers.cloudflare.com/workflows/build/workers-api/)
- [Cloudflare Workflows configuration](https://developers.cloudflare.com/workflows/get-started/guide/)
- [Wrangler Workflows commands](https://developers.cloudflare.com/workers/wrangler/commands/workflows/)
- [Cloudflare Worker bindings](https://developers.cloudflare.com/workers/runtime-apis/bindings/)

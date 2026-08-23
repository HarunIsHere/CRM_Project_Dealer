# Lifecycle State Transitions

Canonical state transitions for the shared lifecycle. Verification source: `cloudflare-worker/src/index.js` (branch `unified-order-v2`).

## Canonical customer-app orders (`customer_orders_v2`, `customer_order_items_v2`, `customer_order_status_history_v2`)

Default/new order status: `submitted` (`:12744`).

### Status set mutable from the admin lifetime API

`PATCH/POST /api/v1/admin/customer-app-orders/{id}/status` allows only (`:10258`):

```
submitted, preparing, scheduled_for_next_online_order, cancelled, closed
```

### Dedicated fulfillment transitions

| Endpoint | Transition | Guard |
|---|---|---|
| `POST .../on-the-way` | sets delivery status to `on_the_way` | fulfillment = delivery (`:10314`) |
| `POST .../ready-to-pickup` | sets pickup status to `ready_to_pickup` | fulfillment = pickup (`:10338`) |
| `POST .../delivered` | sets `delivered` (delivery) / `picked_up` (pickup) final state | `order_status` not `cancelled` (`:10404`) |
| `POST .../not-delivered` | sets `not_delivered` final state | `order_status` not `cancelled` (`:10436`) |
| `POST .../cancel` | sets `cancelled` (`:10587`) | — |
| `POST .../groups/{gid}/approve` | approve delivery group (`:10468`) | — |
| `POST .../groups/{gid}/reject` | reject delivery group (`:10525`) | — |

Every status change is recorded to `customer_order_status_history_v2` via `addV2OrderHistory` (`:10129`); the aggregate history is readable for admin detail views (`:5741`).

### Status label set (display)

The canonical V2 order model is being consolidated. The legacy admin order status label set (`getOrderStatusLabel`, `:5289`) is:

```
submitted, scheduled_for_next_online_order, in_progress, waiting_location,
ready_to_delivery, on_the_way, ready_to_pickup, picked_up,
cancelled, not_delivered, delivered, closed
```

Legacy "closed" classification = `('delivered','closed','cancelled')` (`:5337`). Per AGENTS.md, new work must use the canonical V2 lifecycle, not the legacy parallel model.

## Open requests (`customer_requests`)

Status values: `new`, `in_progress`, `done` (`:10917`).

- Reads exclude `done` requests (`:7066`).
- Single status update: `PATCH/PUT /api/v1/admin/open-requests/{id}/status`.
- Group done: `POST /api/v1/admin/open-requests/group/done`, posts status `done`.
- Requests are considered admin-actionable only; viewing/selecting a location must not itself create a request.

## Rules

- Backend is the source of truth for transitions; clients call dedicated endpoints and never silently write status values into order rows.
- When a transition changes, verify Web Admin, Admin Android, Admin iOS, and the customer-visible order state.
- New lifecycle work should be documented here before implementation.
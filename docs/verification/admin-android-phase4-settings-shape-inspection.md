# Admin Android Phase 4 Settings Shape Inspection

Mode: read-only production settings inspection.

Result: passed

Purpose:

- inspect /api/v1/admin/settings response
- choose the safest setting for update/restore mutation verification
- avoid changing production settings before restore logic is confirmed

Settings top-level keys:

- admin_telegram_chat_id
- working_hours_enabled
- working_hours_timezone
- working_hours_start
- working_hours_end
- working_hours_closed_message
- working_hours_message_mode
- admin_view_language
- allow_preferred_customer_location
- allow_new_customer_location
- allow_customer_pickup
- allowed_delivery_cities
- ai_response_mode
- ai_custom_instructions

Candidate restore-safe keys found:

- ai_response_mode

Recommendation:

- Use ai_response_mode for first settings update/restore verification.

JSON result file:

docs/verification/admin-android-phase4-settings-shape-inspection.json

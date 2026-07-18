# Website to Admin Mobile Parity Matrix

Status values:

- Ready: verified API and current app support exist
- Partial: some API or UI support exists
- Missing: implementation or verification required
- Deferred: intentionally excluded from the first mobile release

| Website area | Mobile feature | Current status | Required next work |
|---|---|---|---|
| Login | Login and token storage | Ready | Replace prototype layout with shared design system |
| Session | Restore and logout | Ready | Add role-aware navigation |
| Dashboard | Summary and latest records | Partial | Verify response mapping and redesign |
| General | Admin language | Missing | Verify/update API and add screen |
| General | Notification receiver | Missing | Verify/update API and add screen |
| General | Working hours | Missing | Verify full settings update contract |
| General | Fulfillment options | Missing | Verify full settings update contract |
| General | Delivery cities | Missing | Verify full settings update contract |
| General | Bot response mode | Partial | Existing limited update; build full settings screen |
| General | AI project instructions | Missing | Verify API field update |
| Orders | Active order list | Partial | Redesign cards and verify all response fields |
| Orders | Order detail | Partial | Add sections, history, additions, notes |
| Orders | Delivery lifecycle | Missing UI | Wire verified lifecycle endpoints |
| Orders | Pickup lifecycle | Missing UI | Wire verified lifecycle endpoints |
| Orders | Cancel with reason | Missing UI | Add action sheet and confirmation |
| Closed Orders | List and detail | Missing | Verify API mapping and build screens |
| Open Requests | List | Ready | Redesign cards and filters |
| Open Requests | Single status | Ready | Add confirmation/feedback |
| Open Requests | Group done | Ready | Add scoped confirmation |
| Open Requests | All done | Deferred | Keep web-only until scoped behavior exists |
| Customers | List | Partial | Add filters and website-equivalent fields |
| Customers | Detail | Partial | Add complete sections |
| Customers | Reply | Ready | Convert to native conversation UI |
| Customers | Delete | Missing | Verify endpoint and add confirmation |
| Products | List | Partial | Add search/filter and proper models |
| Products | Create | Missing UI | Add native form |
| Products | Edit | Missing UI | Add native form |
| Products | Delete | Missing UI | Add confirmation |
| Categories | List | Partial | Add segmented catalogue navigation |
| Categories | Create/edit/delete | Missing UI | Add native forms/actions |
| Meeting Points | List | Partial | Add map action and status badges |
| Meeting Points | Create/edit/delete | Missing UI | Add forms and actions |
| Meeting Points | Set preferred | Missing | Verify endpoint and add confirmation |
| AI Info | Counters | Missing | Verify API support |
| AI Info | Learned patterns | Missing | Verify API support |
| AI Info | Approve/reject/delete | Missing | Verify mutation endpoints |
| Superadmin | Account list | Missing | Verify role-aware API |
| Superadmin | Create admin | Missing | Verify API and add form |
| Superadmin | Deny access | Missing | Verify API and add confirmation |
| Superadmin | Delete credential | Missing | Verify API and add confirmation |
| Superadmin | Audit log | Missing | Verify API and add list/detail |
| Password | Change password | Missing | Verify API and build screen |
| Password | Forgot/reset | Missing | Verify API and build screens |

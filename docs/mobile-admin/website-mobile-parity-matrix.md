# Website to Admin Mobile Parity Matrix

Status values:

- Ready: verified API and current app support exist
- Partial: some API or UI support exists, but a documented parity or safety gap remains
- Missing: implementation or verification required
- Deferred: intentionally excluded from the first mobile release

| Website area | Mobile feature | Current status | Required next work |
|---|---|---|---|
| Login | Login and token storage | Ready | Apply final shared navigation and design-system polish |
| Session | Restore and logout | Ready | Verify session-expiry behavior and recovery UX |
| Dashboard | Summary and latest records | Partial | Manually verify response mapping, empty states, and error states |
| General | Admin language | Ready | Preserve five-locale regression coverage |
| General | Notification receiver | Ready | Preserve server-confirmed settings behavior |
| General | Working hours | Ready | Preserve unrelated settings during updates |
| General | Fulfillment options | Ready | Preserve unrelated settings during updates |
| General | Delivery cities | Ready | Preserve unrelated settings during updates |
| General | Bot response mode | Ready | Preserve server-confirmed settings behavior |
| General | AI project instructions | Ready | Preserve server-confirmed settings behavior |
| Orders | Active order list | Ready | Continue layout and responsive-design refinement |
| Orders | Order detail | Ready | Continue layout and responsive-design refinement |
| Orders | Delivery lifecycle | Ready | Preserve lifecycle regression coverage |
| Orders | Pickup lifecycle | Ready | Preserve lifecycle regression coverage |
| Orders | Cancel with reason | Ready | Preserve confirmation and mutation feedback |
| Orders | Group approval and rejection | Ready | Preserve Web and Android workflow parity |
| Orders | Recreate cancelled order | Ready | Preserve immutable source-order history |
| Orders | One active recreated successor | Ready | Preserve backend race-condition enforcement |
| Closed Orders | List and detail | Ready | Continue layout and responsive-design refinement |
| Open Requests | List | Ready | Continue native card and filter refinement |
| Open Requests | Single status | Ready | Preserve mutation feedback |
| Open Requests | Group done | Ready | Add a scoped confirmation if required by final UX review |
| Open Requests | All done | Ready | Preserve the existing confirmation dialog |
| Customers | List and filters | Ready | Continue responsive-design refinement |
| Customers | Detail | Ready | Continue native conversation-layout refinement |
| Customers | Reply | Ready | Continue native conversation-layout refinement |
| Customers | Delete | Ready | Preserve confirmation and atomic backend deletion |
| Products | List and filters | Ready | Continue responsive-design refinement |
| Products | Create | Ready | Preserve validation and mutation feedback |
| Products | Edit | Ready | Preserve validation and mutation feedback |
| Products | Delete | Partial | Add a destructive-action confirmation |
| Categories | List | Ready | Continue catalogue-navigation refinement |
| Categories | Create and edit | Ready | Preserve validation and mutation feedback |
| Categories | Delete | Partial | Add a destructive-action confirmation |
| Meeting Points | List and map action | Ready | Continue responsive-design refinement |
| Meeting Points | Create and edit | Ready | Preserve validation and mutation feedback |
| Meeting Points | Delete | Partial | Add a destructive-action confirmation |
| Meeting Points | Set preferred | Partial | Add confirmation or explicit mutation feedback |
| AI Info | Counters | Ready | Preserve API mapping regression coverage |
| AI Info | Learned patterns | Ready | Add a dedicated detail presentation if required |
| AI Info | Approve/reject/delete | Partial | Add confirmation for reject and delete actions |
| Superadmin | Account list | Ready | Preserve role-based visibility |
| Superadmin | Create admin | Ready | Preserve validation and mutation feedback |
| Superadmin | Deny or grant access | Partial | Add confirmation for account access changes |
| Superadmin | Delete credential | Partial | Add a destructive-action confirmation |
| Superadmin | Audit log | Partial | Add audit detail and the retention explanation |
| Password | Change password | Ready | Preserve secure-field and validation behavior |
| Password | Forgot/reset | Partial | Complete verification-code and new-password screens |

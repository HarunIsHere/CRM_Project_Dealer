# Admin Android Phase 6 Open Request API Gap Inspection

Mode: static source inspection only.

Result: completed

Latest commit:

e39fbad Document Admin Android customer reply verification

## API open requests handler

- Handler exists: True
- Methods seen: GET
- Reads JSON body: False
- Has write signal: False

## Web admin open request mutation handlers

- Single status handler exists: True
- Group done handler exists: True
- All done handler exists: True
- Single status has write signal: True
- Group done has write signal: True
- All done has write signal: True

## Conclusion

Admin open requests API is read-only. Web admin has mutation handlers for request done/group done/all done. Admin Android needs API mutation endpoints before open request write UI.

## Recommended next step

Add safe API endpoints for single request done and grouped request done. Do not add all-done for Android v1 until filtered/test-safe behavior is defined.

## Relevant route lines

- 8098:         <form action="/admin/customer-requests/group/done" method="post">
- 8151:   <form action="/admin/customer-requests/all/done" method="post"><button type="submit">${ui.all_done}</button></form>
- 8242:       <form action="/admin/customer-requests/${item.id}/status" method="post">
- 8466: async function handleUpdateCustomerRequestStatus(request, env, requestId) {
- 8476: async function handleMarkCustomerRequestGroupDone(request, env) {
- 8493: async function handleMarkAllDone(env) {
- 10416:       admin_open_requests: "/api/v1/admin/open-requests",
- 11405: async function handleApiAdminOpenRequests(request, env) {
- 13808:   if (url.pathname === "/api/v1/admin/open-requests") {
- 13809:     return handleApiAdminOpenRequests(request, env);
- 14094:   if (requestStatus && request.method === "POST") return handleUpdateCustomerRequestStatus(request, env, Number(requestStatus[1]));
- 14095:   if (url.pathname === "/admin/customer-requests/group/done" && request.method === "POST") return handleMarkCustomerRequestGroupDone(request, env);
- 14096:   if (url.pathname === "/admin/customer-requests/all/done" && request.method === "POST") return handleMarkAllDone(env);

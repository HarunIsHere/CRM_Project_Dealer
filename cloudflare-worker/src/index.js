const TELEGRAM_API_BASE = "https://api.telegram.org/bot";

const ADMIN_CSS = ':root {\n    --bg: #f4f6f8;\n    --panel: #ffffff;\n    --text: #1f2937;\n    --muted: #6b7280;\n    --border: #d9dee7;\n    --primary: #2563eb;\n    --primary-hover: #1d4ed8;\n    --danger: #dc2626;\n    --success: #16a34a;\n    --shadow: 0 8px 24px rgba(15, 23, 42, 0.08);\n    --radius: 14px;\n}\n\n* {\n    box-sizing: border-box;\n}\n\nbody {\n    margin: 0;\n    padding: 24px;\n    background: var(--bg);\n    color: var(--text);\n    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;\n    font-size: 15px;\n    line-height: 1.45;\n}\n\nh1 {\n    margin: 0 0 18px;\n    font-size: 28px;\n    letter-spacing: -0.03em;\n}\n\nh2 {\n    margin: 28px 0 12px;\n    font-size: 20px;\n    letter-spacing: -0.02em;\n}\n\nh3 {\n    margin: 22px 0 10px;\n    font-size: 17px;\n}\n\np {\n    margin: 10px 0;\n}\n\na {\n    color: var(--primary);\n    text-decoration: none;\n}\n\na:hover {\n    text-decoration: underline;\n}\n\nform {\n    margin: 0;\n}\n\nbody > form,\nbody > p,\nbody > table,\nbody > div,\nbody > h2 + form,\nbody > h3 + form {\n    max-width: 1200px;\n}\n\nbody > table,\n#open-requests-container,\nform:not([style*="display:inline"]) {\n    background: var(--panel);\n    border: 1px solid var(--border);\n    border-radius: var(--radius);\n    box-shadow: var(--shadow);\n    padding: 16px;\n    margin-bottom: 18px;\n}\n\ntable {\n    width: 100%;\n    border-collapse: collapse;\n    background: var(--panel);\n    border: 1px solid var(--border) !important;\n    border-radius: var(--radius);\n    overflow: hidden;\n}\n\nth,\ntd {\n    border: 1px solid var(--border) !important;\n    padding: 10px;\n    text-align: left;\n    vertical-align: top;\n}\n\nth {\n    background: #eef2f7;\n    font-weight: 700;\n    color: #111827;\n}\n\ntr:nth-child(even) td {\n    background: #fafbfc;\n}\n\ninput,\nselect,\ntextarea {\n    width: 100%;\n    max-width: 720px;\n    border: 1px solid var(--border);\n    border-radius: 10px;\n    padding: 9px 10px;\n    font: inherit;\n    background: #fff;\n    color: var(--text);\n}\n\ninput[type="checkbox"],\ninput[type="radio"] {\n    width: auto;\n    margin-right: 6px;\n}\n\ntextarea {\n    min-height: 84px;\n    resize: vertical;\n}\n\nbutton {\n    appearance: none;\n    border: 0;\n    border-radius: 10px;\n    background: var(--primary);\n    color: #fff;\n    padding: 9px 13px;\n    font: inherit;\n    font-weight: 650;\n    cursor: pointer;\n    margin: 3px 4px 3px 0;\n}\n\nbutton:hover {\n    background: var(--primary-hover);\n}\n\nbutton[type="submit"] {\n    background: var(--primary);\n}\n\nform[action*="logout"] button,\nform[action*="delete"] button {\n    background: var(--danger);\n}\n\nform[action*="logout"] button:hover,\nform[action*="delete"] button:hover {\n    background: #b91c1c;\n}\n\np[style*="color:red"],\n.error {\n    color: var(--danger) !important;\n    background: #fef2f2;\n    border: 1px solid #fecaca;\n    padding: 10px 12px;\n    border-radius: 10px;\n}\n\np[style*="color:green"],\n.success {\n    color: var(--success) !important;\n    background: #f0fdf4;\n    border: 1px solid #bbf7d0;\n    padding: 10px 12px;\n    border-radius: 10px;\n}\n\n.page-actions {\n    display: flex;\n    flex-wrap: wrap;\n    gap: 8px;\n    margin: 14px 0 22px;\n}\n\n.page-actions form {\n    background: transparent;\n    border: 0;\n    box-shadow: none;\n    padding: 0;\n    margin: 0;\n}\n\n@media (max-width: 760px) {\n    body {\n        padding: 14px;\n        font-size: 14px;\n    }\n\n    h1 {\n        font-size: 23px;\n    }\n\n    h2 {\n        font-size: 18px;\n    }\n\n    body > table,\n    #open-requests-container,\n    form:not([style*="display:inline"]) {\n        padding: 12px;\n        border-radius: 12px;\n        overflow-x: auto;\n    }\n\n    table {\n        min-width: 720px;\n        display: block;\n        overflow-x: auto;\n        white-space: nowrap;\n    }\n\n    input,\n    select,\n    textarea {\n        max-width: none;\n    }\n\n    button {\n        width: 100%;\n        margin: 4px 0;\n    }\n\n    form[style*="display:inline"] button,\n    td button {\n        width: auto;\n    }\n\n    .page-actions {\n        display: block;\n    }\n}\n\n.request-action-button {\n    width: 135px;\n    text-align: center;\n}\n\n/* Compact admin UI adjustment */\nbody {\n    font-size: 13px;\n    padding: 18px;\n}\n\nh1 {\n    font-size: 24px;\n    margin-bottom: 14px;\n}\n\nh2 {\n    font-size: 17px;\n    margin: 22px 0 10px;\n}\n\nh3 {\n    font-size: 15px;\n}\n\nbutton {\n    padding: 6px 10px;\n    font-size: 13px;\n    border-radius: 8px;\n    margin: 2px 3px 2px 0;\n}\n\ninput,\nselect,\ntextarea {\n    font-size: 13px;\n    padding: 7px 9px;\n    border-radius: 8px;\n}\n\nth,\ntd {\n    padding: 7px 8px;\n}\n\nbody > table,\n#open-requests-container,\nform:not([style*="display:inline"]) {\n    padding: 12px;\n    margin-bottom: 14px;\n}\n\n.request-action-button {\n    width: 110px;\n}\n\n@media (max-width: 760px) {\n    body {\n        font-size: 13px;\n        padding: 10px;\n    }\n\n    h1 {\n        font-size: 21px;\n    }\n\n    h2 {\n        font-size: 16px;\n    }\n\n    button {\n        font-size: 13px;\n        padding: 7px 9px;\n    }\n\n    th,\n    td {\n        padding: 6px 7px;\n    }\n}\n\nhr {\n    max-width: 1200px;\n    border: 0;\n    border-top: 1px solid var(--border);\n    margin: 14px 0 18px;\n}\n\n.admin-header {\n    max-width: 1200px;\n    display: flex;\n    align-items: center;\n    justify-content: space-between;\n    gap: 12px;\n    margin-bottom: 10px;\n}\n\n.admin-header h1 {\n    margin: 0;\n}\n\n.header-actions {\n    display: flex;\n    align-items: center;\n    gap: 8px;\n}\n\n.header-actions form {\n    background: transparent;\n    border: 0;\n    box-shadow: none;\n    padding: 0;\n    margin: 0;\n}\n\n@media (max-width: 760px) {\n    .admin-header {\n        align-items: flex-start;\n        flex-direction: column;\n    }\n\n    .header-actions {\n        width: 100%;\n        display: grid;\n        grid-template-columns: 1fr 1fr;\n    }\n\n    .header-actions a,\n    .header-actions form {\n        width: 100%;\n    }\n\n    .header-actions button {\n        width: 100%;\n    }\n}\n\n.admin-header {\n    background: transparent;\n    border: 0;\n    box-shadow: none;\n    padding: 0;\n}\n\n.header-actions {\n    display: flex;\n    gap: 8px;\n}\n\n.header-actions form {\n    background: transparent !important;\n    border: 0 !important;\n    box-shadow: none !important;\n    padding: 0 !important;\n    margin: 0 !important;\n}\n\n.header-actions a {\n    display: inline-block;\n}\n\nhr + hr {\n    margin-top: -10px;\n}\n\n@media (max-width: 760px) {\n    .admin-header {\n        flex-direction: column;\n        align-items: flex-start;\n    }\n\n    .header-actions {\n        display: grid;\n        grid-template-columns: 1fr 1fr;\n        width: 100%;\n    }\n}\n\n.all-done-header-form {\n    background: transparent !important;\n    border: 0 !important;\n    box-shadow: none !important;\n    padding: 0 !important;\n    margin: 6px 0 0 0 !important;\n}\n\n.all-done-header-form button {\n    width: 90px;\n}\n#open-requests-container table th:nth-child(9),\n#open-requests-container table td:nth-child(9) {\n    width: 125px;\n    min-width: 125px;\n    max-width: 125px;\n    padding: 7px 8px;\n}\n\n#open-requests-container table td:nth-child(9) form {\n    background: transparent !important;\n    border: 0 !important;\n    box-shadow: none !important;\n    padding: 0 !important;\n    margin: 0 0 5px 0 !important;\n}\n\n#open-requests-container table td:nth-child(9) button,\n.request-action-button {\n    width: 110px;\n    margin: 0 0 5px 0 !important;\n}\n\n.all-done-header-form {\n    background: transparent !important;\n    border: 0 !important;\n    box-shadow: none !important;\n    padding: 0 !important;\n    margin: 0 !important;\n}\n\n.all-done-header-form button {\n    width: 90px;\n}\n\n.open-requests-table-actions {\n    max-width: 1200px;\n    display: flex;\n    justify-content: flex-end;\n    margin: 0 0 8px 0;\n}\n\n.open-requests-table-actions form {\n    background: transparent !important;\n    border: 0 !important;\n    box-shadow: none !important;\n    padding: 0 !important;\n    margin: 0 !important;\n}\n\n.open-requests-table-actions button {\n    width: 90px;\n}\n\n.admin-info-text {\n    max-width: 1200px;\n    background: #eef2ff;\n    border: 1px solid #c7d2fe;\n    border-radius: 10px;\n    padding: 10px 12px;\n    color: #1e3a8a;\n    margin: 10px 0 18px;\n}\n';

const jsonResponse = (data, status = 200) => {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8"
    }
  });
};

const htmlResponse = (html, status = 200) => {
  return new Response(html, {
    status,
    headers: {
      "content-type": "text/html; charset=utf-8"
    }
  });
};

const redirectResponse = (path) => {
  return new Response(null, {
    status: 303,
    headers: {
      location: path
    }
  });
};

const escapeHtml = (value) => {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
};

async function sendTelegram(method, env, payload) {
  const response = await fetch(
    `${TELEGRAM_API_BASE}${env.TELEGRAM_BOT_TOKEN}/${method}`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify(payload)
    }
  );

  return response.json();
}

async function sendTelegramMessage(env, chatId, text, replyMarkup = null) {
  const payload = {
    chat_id: chatId,
    text
  };

  if (replyMarkup) {
    payload.reply_markup = replyMarkup;
  }

  return sendTelegram("sendMessage", env, payload);
}

async function answerCallbackQuery(env, callbackQueryId) {
  return sendTelegram("answerCallbackQuery", env, {
    callback_query_id: callbackQueryId
  });
}

function getMainKeyboard() {
  return {
    inline_keyboard: [
      [
        {
          text: "1. Products",
          callback_data: "option_products"
        }
      ],
      [
        {
          text: "2. Location",
          callback_data: "option_location"
        }
      ],
      [
        {
          text: "3. Contact admin",
          callback_data: "option_admin"
        }
      ]
    ]
  };
}

function getProductsText(products) {
  if (!products.length) {
    return "No active products are available right now.";
  }

  const lines = products.map((product) => {
    return `- ${product.name}: ${product.price}`;
  });

  return `Available products:\n${lines.join("\n")}`;
}

function getMeetingPointsText(points) {
  if (!points.length) {
    return "No active location is available right now. Please contact admin.";
  }

  if (points.length === 1) {
    const point = points[0];

    return [
      "We can meet here:",
      "",
      point.name,
      point.address || "",
      point.google_maps_link
    ].filter(Boolean).join("\n");
  }

  const lines = ["Please choose one of our active locations:", ""];

  for (const point of points) {
    const label = point.is_default ? `Preferred - ${point.name}` : point.name;
    lines.push(label);
    if (point.address) {
      lines.push(point.address);
    }
    lines.push(point.google_maps_link);
    lines.push("");
  }

  return lines.join("\n").trim();
}

function normalizeText(text) {
  return text.trim().toLowerCase();
}

function isProductsRequest(text) {
  const value = normalizeText(text);

  return [
    "1",
    "product",
    "products",
    "price",
    "prices",
    "menu",
    "list",
    "ürün",
    "urun",
    "ürünler",
    "urunler",
    "fiyat",
    "produkte",
    "preis"
  ].includes(value);
}

function isLocationRequest(text) {
  const value = normalizeText(text);

  return [
    "2",
    "location",
    "address",
    "where",
    "konum",
    "lokasyon",
    "adres",
    "standort",
    "adresse"
  ].includes(value);
}

function isAdminRequest(text) {
  const value = normalizeText(text);

  return [
    "3",
    "admin",
    "contact admin",
    "support",
    "yardım",
    "hilfe"
  ].includes(value);
}

async function upsertCustomer(env, telegramUser) {
  const telegramUserId = String(telegramUser.id);
  const username = telegramUser.username || null;
  const fullName = [telegramUser.first_name, telegramUser.last_name]
    .filter(Boolean)
    .join(" ") || null;

  const existing = await env.DB.prepare(
    "SELECT id FROM customers WHERE telegram_user_id = ?"
  ).bind(telegramUserId).first();

  if (existing) {
    await env.DB.prepare(
      `
      UPDATE customers
      SET username = ?, full_name = ?, last_seen_at = CURRENT_TIMESTAMP
      WHERE telegram_user_id = ?
      `
    ).bind(username, fullName, telegramUserId).run();

    return existing.id;
  }

  const result = await env.DB.prepare(
    `
    INSERT INTO customers (
      telegram_user_id,
      username,
      full_name,
      language,
      preferred_language
    )
    VALUES (?, ?, ?, ?, ?)
    `
  ).bind(
    telegramUserId,
    username,
    fullName,
    "en",
    "en"
  ).run();

  return result.meta.last_row_id;
}

async function saveMessage(env, customerId, direction, content, language = null) {
  await env.DB.prepare(
    `
    INSERT INTO messages (
      customer_id,
      direction,
      content,
      language
    )
    VALUES (?, ?, ?, ?)
    `
  ).bind(
    customerId,
    direction,
    content,
    language
  ).run();
}

async function logCustomerRequest(
  env,
  customerId,
  requestType,
  requestText,
  itemName = null,
  quantity = null
) {
  await env.DB.prepare(
    `
    INSERT INTO customer_requests (
      customer_id,
      request_type,
      request_text,
      item_name,
      quantity,
      status
    )
    VALUES (?, ?, ?, ?, ?, ?)
    `
  ).bind(
    customerId,
    requestType,
    requestText,
    itemName,
    quantity,
    "new"
  ).run();
}

async function getActiveProducts(env) {
  const result = await env.DB.prepare(
    `
    SELECT id, name, price
    FROM products
    WHERE is_active = 1
    ORDER BY id ASC
    `
  ).all();

  return result.results;
}

async function getActiveMeetingPoints(env) {
  const result = await env.DB.prepare(
    `
    SELECT id, name, address, google_maps_link, is_default
    FROM meeting_points
    WHERE is_active = 1
    ORDER BY is_default DESC, id ASC
    `
  ).all();

  return result.results;
}

async function getAdminData(env) {
  const customers = await env.DB.prepare(
    `
    SELECT id, telegram_user_id, username, full_name, preferred_language, last_seen_at
    FROM customers
    ORDER BY last_seen_at DESC
    LIMIT 20
    `
  ).all();

  const products = await env.DB.prepare(
    `
    SELECT id, name, price, is_active
    FROM products
    ORDER BY id ASC
    `
  ).all();

  const meetingPoints = await env.DB.prepare(
    `
    SELECT id, name, address, google_maps_link, is_default, is_active
    FROM meeting_points
    ORDER BY id ASC
    `
  ).all();

  const requests = await env.DB.prepare(
    `
    SELECT cr.id, cr.customer_id, cr.request_type, cr.request_text, cr.item_name,
           cr.quantity, cr.status, cr.created_at, c.full_name, c.username
    FROM customer_requests cr
    LEFT JOIN customers c ON c.id = cr.customer_id
    WHERE cr.status != 'done'
    ORDER BY cr.created_at DESC
    LIMIT 50
    `
  ).all();

  return {
    customers: customers.results,
    products: products.results,
    meetingPoints: meetingPoints.results,
    requests: requests.results
  };
}

async function handleHealth() {
  return jsonResponse({
    app: "CRM Delivery Worker",
    status: "ok"
  });
}

function renderAdminPage(data) {
  const productRows = data.products.map((product) => {
    return `
    <tr>
      <form action="/admin/products/${product.id}/update" method="post">
        <td>${product.id}</td>
        <td>
          <input type="text" name="name" value="${escapeHtml(product.name)}" required>
        </td>
        <td>
          <input type="number" step="0.01" name="price" value="${escapeHtml(product.price)}" required>
        </td>
        <td>
          <textarea name="aliases" rows="2" cols="40"></textarea>
        </td>
        <td>
          <input type="checkbox" name="is_active" ${product.is_active ? "checked" : ""}>
        </td>
        <td>
          <button type="submit">Save</button>
      </form>

      <form action="/admin/products/${product.id}/delete" method="post" style="display:inline;">
        <button type="submit">Delete</button>
      </form>
        </td>
    </tr>
    `;
  }).join("");

  const pointRows = data.meetingPoints.map((point) => {
    return `
    <tr>
      <form action="/admin/meeting-points/${point.id}/update" method="post">
        <td>${point.id}</td>
        <td>
          <input type="text" name="name" value="${escapeHtml(point.name)}" required>
        </td>
        <td>
          <input type="text" name="address" value="${escapeHtml(point.address)}" size="50" required>
        </td>
        <td>
          <input type="text" name="google_maps_link" value="${escapeHtml(point.google_maps_link)}" size="50" required>
          <br><br>
          <a href="${escapeHtml(point.google_maps_link)}" target="_blank">Open Map</a>
        </td>
        <td>${point.is_default ? "True" : "False"}</td>
        <td>
          <input type="checkbox" name="is_active" ${point.is_active ? "checked" : ""}>
        </td>
        <td>
          <button type="submit">Save</button>
      </form>

      ${point.is_active ? `
      <form action="/admin/meeting-points/${point.id}/default" method="post" style="display:inline;">
        <button type="submit">Set Preferred</button>
      </form>
      ` : ""}

      <form action="/admin/meeting-points/${point.id}/delete" method="post" style="display:inline;">
        <button type="submit">Delete</button>
      </form>
        </td>
    </tr>
    `;
  }).join("");

  const customerRows = data.customers.map((customer) => {
    return `
    <tr>
      <td>${customer.id}</td>
      <td>${escapeHtml(customer.full_name)}</td>
      <td>${escapeHtml(customer.username)}</td>
      <td>${escapeHtml(customer.preferred_language)}</td>
      <td>${escapeHtml(customer.last_seen_at)}</td>
      <td>
        <a href="/admin/customers/${customer.id}">View History</a>
      </td>
    </tr>
    `;
  }).join("");

  return `
<!DOCTYPE html>
<html>
<head>
  <title>CRM Delivery Admin</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link rel="stylesheet" href="/static/admin.css">
</head>
<body>

<div class="admin-header">
  <h1>CRM Delivery Admin</h1>

  <div class="header-actions">
    <form action="/admin/logout" method="post">
      <button type="submit">Logout</button>
    </form>

    <a href="/admin/change-password">
      <button type="button">Change Password</button>
    </a>
  </div>
</div>

<hr>
<hr>

<div class="page-actions">
  <a href="/admin/openrequests/">
    <button type="button">Open Requests</button>
  </a>
</div>

<hr>
<hr>

<h2>Admin Language</h2>

<form action="/admin/settings/admin-language" method="post">
  <label>View Language</label><br>
  <select name="admin_view_language">
    <option value="en" selected>English</option>
    <option value="de">German</option>
    <option value="tr">Turkish</option>
    <option value="ar">Arabic</option>
    <option value="ru">Russian</option>
  </select>

  <button type="submit">Save Language</button>
</form>

<hr>

<h2>Notification Settings</h2>

<form action="/admin/settings/admin-telegram" method="post">
  <label>Admin Telegram Chat ID</label><br>
  <input
    type="text"
    name="admin_telegram_chat_id"
    value=""
    size="30"
    required
  >
  <button type="submit">Save Notification Receiver</button>
</form>

<hr>

<h2>Working Hours</h2>

<form action="/admin/settings/working-hours" method="post">
  <label>
    <input type="checkbox" name="working_hours_enabled" value="on">
    Enable working-hours restrictions
  </label>

  <br><br>

  <label>Timezone</label><br>
  <input type="text" name="working_hours_timezone" value="Europe/Berlin" required>

  <br><br>

  <label>Start Time</label><br>
  <input type="time" name="working_hours_start" value="09:00" required>

  <br><br>

  <label>End Time</label><br>
  <input type="time" name="working_hours_end" value="22:00" required>

  <br><br>

  <label>Closed-hours message mode</label><br>

  <label>
    <input type="radio" name="working_hours_message_mode" value="auto" checked>
    Auto message from selected working hours
  </label>

  <br>

  <label>
    <input type="radio" name="working_hours_message_mode" value="custom">
    Custom free-text message
  </label>

  <br><br>

  <label>Custom Closed Message</label><br>
  <textarea name="working_hours_closed_message" rows="3" cols="80"></textarea>

  <p>
    Auto mode ignores the custom text and replies using the selected
    working hours in the customer's language plus English.
    Custom mode sends the free-text message exactly as written.
  </p>

  <br><br>

  <button type="submit">Save Working Hours</button>
</form>

<hr>

<h2>Products</h2>

<table border="1" cellpadding="10">
  <tr>
    <th>ID</th>
    <th>Name</th>
    <th>Price</th>
    <th>Aliases</th>
    <th>Active</th>
    <th>Action</th>
  </tr>
  ${productRows}
</table>

<h3>Add Product</h3>

<form action="/admin/products" method="post">
  <label>Product Name</label><br>
  <input type="text" name="name" required>

  <br><br>

  <label>Price</label><br>
  <input type="number" step="0.01" name="price" required>

  <br><br>

  <button type="submit">Create Product</button>
</form>

<hr>

<h2>Meeting Points</h2>

<table border="1" cellpadding="10">
  <tr>
    <th>ID</th>
    <th>Name</th>
    <th>Address</th>
    <th>Google Maps</th>
    <th>Preferred</th>
    <th>Active</th>
    <th>Action</th>
  </tr>
  ${pointRows}
</table>

<p class="admin-info-text">
  If only one location is active, the customer receives that location directly.
  If multiple locations are active, the customer can choose from all active locations;
  the preferred location/s is marked as preferred.
</p>

<h3>Add Meeting Point</h3>

<input type="text" id="location-search" placeholder="Search location..." size="50">

<button onclick="searchLocation()">Search</button>

<div id="search-results"></div>

<br><br>

<form action="/admin/meeting-points" method="post">
  <label>Name</label><br>
  <input type="text" id="name" name="name" required>

  <br><br>

  <label>Address</label><br>
  <input type="text" id="address" name="address" size="80" required>

  <br><br>

  <label>Google Maps Link</label><br>
  <input type="text" id="google_maps_link" name="google_maps_link" size="80" required>

  <br><br>

  <label>
    <input type="checkbox" name="is_default">
    Set as preferred
  </label>

  <br><br>

  <button type="submit">Create Meeting Point</button>
</form>

<hr>

<h2>Customers</h2>

<table border="1" cellpadding="10">
  <tr>
    <th>ID</th>
    <th>Full Name</th>
    <th>Username</th>
    <th>Language</th>
    <th>Last Seen</th>
    <th>Action</th>
  </tr>
  ${customerRows}
</table>

<script>
async function searchLocation() {
  const query = document.getElementById("location-search").value.trim();
  const resultsDiv = document.getElementById("search-results");

  resultsDiv.innerHTML = "Search location is not ported yet.";

  if (!query) {
    resultsDiv.innerHTML = "Enter a location first.";
    return;
  }
}
</script>

</body>
</html>
`;
}

async function handleAdminHome(env) {
  const data = await getAdminData(env);
  return htmlResponse(renderAdminPage(data));
}

async function handleCreateProduct(request, env) {
  const form = await request.formData();
  const name = String(form.get("name") || "").trim();
  const price = Number(form.get("price") || 0);

  if (name && price > 0) {
    await env.DB.prepare(
      `
      INSERT INTO products (name, price, is_active)
      VALUES (?, ?, 1)
      `
    ).bind(name, price).run();
  }

  return redirectResponse("/admin");
}

async function handleCreateMeetingPoint(request, env) {
  const form = await request.formData();
  const name = String(form.get("name") || "").trim();
  const address = String(form.get("address") || "").trim();
  const googleMapsLink = String(form.get("google_maps_link") || "").trim();
  const isDefault = form.get("is_default") ? 1 : 0;

  if (name && googleMapsLink) {
    await env.DB.prepare(
      `
      INSERT INTO meeting_points (
        name,
        address,
        google_maps_link,
        is_default,
        is_active
      )
      VALUES (?, ?, ?, ?, 1)
      `
    ).bind(
      name,
      address,
      googleMapsLink,
      isDefault
    ).run();
  }

  return redirectResponse("/admin");
}

async function handleUpdateProduct(request, env, productId) {
  const form = await request.formData();
  const name = String(form.get("name") || "").trim();
  const price = Number(form.get("price") || 0);
  const isActive = form.get("is_active") ? 1 : 0;

  if (name && price > 0) {
    await env.DB.prepare(
      `
      UPDATE products
      SET name = ?, price = ?, is_active = ?
      WHERE id = ?
      `
    ).bind(name, price, isActive, productId).run();

    await env.DB.prepare(
      "DELETE FROM product_aliases WHERE product_id = ?"
    ).bind(productId).run();

    const aliasesText = String(form.get("aliases") || "").trim();

    if (aliasesText) {
      const aliases = aliasesText
        .split(/\r?\n|,/)
        .map((alias) => alias.trim())
        .filter(Boolean);

      for (const alias of aliases) {
        await env.DB.prepare(
          `
          INSERT INTO product_aliases (product_id, alias)
          VALUES (?, ?)
          `
        ).bind(productId, alias).run();
      }
    }
  }

  return redirectResponse("/admin");
}

async function handleDeleteProduct(env, productId) {
  await env.DB.prepare(
    "UPDATE products SET is_active = 0 WHERE id = ?"
  ).bind(productId).run();

  return redirectResponse("/admin");
}

async function handleUpdateMeetingPoint(request, env, pointId) {
  const form = await request.formData();
  const name = String(form.get("name") || "").trim();
  const address = String(form.get("address") || "").trim();
  const googleMapsLink = String(form.get("google_maps_link") || "").trim();
  const isActive = form.get("is_active") ? 1 : 0;

  if (name && googleMapsLink) {
    await env.DB.prepare(
      `
      UPDATE meeting_points
      SET name = ?, address = ?, google_maps_link = ?, is_active = ?
      WHERE id = ?
      `
    ).bind(
      name,
      address,
      googleMapsLink,
      isActive,
      pointId
    ).run();
  }

  return redirectResponse("/admin");
}

async function handleSetPreferredMeetingPoint(env, pointId) {
  await env.DB.prepare(
    `
    UPDATE meeting_points
    SET is_default = 1, is_active = 1
    WHERE id = ?
    `
  ).bind(pointId).run();

  return redirectResponse("/admin");
}

async function handleDeleteMeetingPoint(env, pointId) {
  await env.DB.prepare(
    "UPDATE meeting_points SET is_active = 0, is_default = 0 WHERE id = ?"
  ).bind(pointId).run();

  return redirectResponse("/admin");
}

async function handleOpenRequests(env) {
  const result = await env.DB.prepare(
    `
    SELECT cr.id, cr.customer_id, cr.request_type, cr.request_text, cr.item_name,
           cr.quantity, cr.status, cr.created_at, c.full_name, c.username
    FROM customer_requests cr
    LEFT JOIN customers c ON c.id = cr.customer_id
    WHERE cr.status != 'done'
    ORDER BY cr.created_at DESC
    LIMIT 100
    `
  ).all();

  const rows = result.results.map((request) => {
    const customerName = request.full_name || request.username || request.customer_id;

    return `
    <tr>
      <td>${request.id}</td>
      <td>${escapeHtml(customerName)}</td>
      <td>${escapeHtml(request.request_type)}</td>
      <td>${escapeHtml(request.item_name)}</td>
      <td>${escapeHtml(request.quantity)}</td>
      <td>${escapeHtml(request.request_text)}</td>
      <td>${escapeHtml(request.status)}</td>
      <td>${escapeHtml(request.created_at)}</td>
    </tr>
    `;
  }).join("");

  return htmlResponse(`
<!DOCTYPE html>
<html>
<head>
  <title>Open Requests</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link rel="stylesheet" href="/static/admin.css">
</head>
<body>
  <h1>Open Requests</h1>

  <a href="/admin">
    <button type="button">Back to Admin Dashboard</button>
  </a>

  <br><br>

  <table border="1" cellpadding="10">
    <tr>
      <th>ID</th>
      <th>Customer</th>
      <th>Type</th>
      <th>Item</th>
      <th>Quantity</th>
      <th>Text</th>
      <th>Status</th>
      <th>Created</th>
    </tr>
    ${rows}
  </table>
</body>
</html>
`);
}


async function handleCustomerMessage(env, message) {
  const text = message.text || "";
  const chatId = message.chat.id;
  const telegramUser = message.from;
  const customerId = await upsertCustomer(env, telegramUser);

  await saveMessage(env, customerId, "incoming", text, "en");

  let replyText = "I did not fully understand. Please choose an option.";
  let replyMarkup = getMainKeyboard();

  if (text.trim() === "/start") {
    replyText = "CRM Delivery Bot is running. Please choose an option.";
  } else if (text.trim() === "/health") {
    replyText = "Worker bot health: OK";
    replyMarkup = null;
  } else if (isProductsRequest(text)) {
    const products = await getActiveProducts(env);
    replyText = getProductsText(products);
    replyMarkup = null;
    await logCustomerRequest(env, customerId, "product_list", text);
  } else if (isLocationRequest(text)) {
    const points = await getActiveMeetingPoints(env);
    replyText = getMeetingPointsText(points);
    replyMarkup = null;
    await logCustomerRequest(env, customerId, "location", text);
  } else if (isAdminRequest(text)) {
    replyText = "Your request was sent to admin.";
    replyMarkup = null;
    await logCustomerRequest(env, customerId, "contact_admin", text);
  }

  await sendTelegramMessage(env, chatId, replyText, replyMarkup);
  await saveMessage(env, customerId, "outgoing", replyText, "en");
}

async function handleCallbackQuery(env, callbackQuery) {
  await answerCallbackQuery(env, callbackQuery.id);

  const chatId = callbackQuery.message.chat.id;
  const telegramUser = callbackQuery.from;
  const customerId = await upsertCustomer(env, telegramUser);
  const data = callbackQuery.data;

  let replyText = "Please choose an option.";

  if (data === "option_products") {
    const products = await getActiveProducts(env);
    replyText = getProductsText(products);
    await logCustomerRequest(env, customerId, "product_list", "Customer selected products");
  } else if (data === "option_location") {
    const points = await getActiveMeetingPoints(env);
    replyText = getMeetingPointsText(points);
    await logCustomerRequest(env, customerId, "location", "Customer selected location");
  } else if (data === "option_admin") {
    replyText = "Your request was sent to admin.";
    await logCustomerRequest(env, customerId, "contact_admin", "Customer selected contact admin");
  }

  await sendTelegramMessage(env, chatId, replyText);
  await saveMessage(env, customerId, "outgoing", replyText, "en");
}

async function handleTelegramWebhook(request, env) {
  const secretHeader = request.headers.get("x-telegram-bot-api-secret-token");

  if (secretHeader !== env.TELEGRAM_WEBHOOK_SECRET) {
    return jsonResponse(
      {
        ok: false,
        error: "Unauthorized webhook"
      },
      401
    );
  }

  const update = await request.json();

  if (update.message) {
    await handleCustomerMessage(env, update.message);
  }

  if (update.callback_query) {
    await handleCallbackQuery(env, update.callback_query);
  }

  return jsonResponse({
    ok: true
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/health") {
      return handleHealth();
    }

    if (url.pathname === "/static/admin.css") {
      return new Response(ADMIN_CSS, {
        headers: {
          "content-type": "text/css; charset=utf-8"
        }
      });
    }

    if (url.pathname === "/admin" || url.pathname === "/admin/") {
      return handleAdminHome(env);
    }

    if (url.pathname === "/admin/openrequests/" || url.pathname === "/admin/openrequests") {
      return handleOpenRequests(env);
    }

    if (url.pathname === "/admin/products" && request.method === "POST") {
      return handleCreateProduct(request, env);
    }

    const productUpdateMatch = url.pathname.match(/^\/admin\/products\/(\d+)\/update$/);
    if (productUpdateMatch && request.method === "POST") {
      return handleUpdateProduct(
        request,
        env,
        Number(productUpdateMatch[1])
      );
    }

    const productDeleteMatch = url.pathname.match(/^\/admin\/products\/(\d+)\/delete$/);
    if (productDeleteMatch && request.method === "POST") {
      return handleDeleteProduct(
        env,
        Number(productDeleteMatch[1])
      );
    }

    if (url.pathname === "/admin/meeting-points" && request.method === "POST") {
      return handleCreateMeetingPoint(request, env);
    }

    const pointUpdateMatch = url.pathname.match(/^\/admin\/meeting-points\/(\d+)\/update$/);
    if (pointUpdateMatch && request.method === "POST") {
      return handleUpdateMeetingPoint(
        request,
        env,
        Number(pointUpdateMatch[1])
      );
    }

    const pointPreferredMatch = url.pathname.match(/^\/admin\/meeting-points\/(\d+)\/default$/);
    if (pointPreferredMatch && request.method === "POST") {
      return handleSetPreferredMeetingPoint(
        env,
        Number(pointPreferredMatch[1])
      );
    }

    const pointDeleteMatch = url.pathname.match(/^\/admin\/meeting-points\/(\d+)\/delete$/);
    if (pointDeleteMatch && request.method === "POST") {
      return handleDeleteMeetingPoint(
        env,
        Number(pointDeleteMatch[1])
      );
    }

    if (url.pathname === "/telegram/webhook" && request.method === "POST") {
      return handleTelegramWebhook(request, env);
    }

    return jsonResponse(
      {
        error: "Not found",
        path: url.pathname
      },
      404
    );
  }
};

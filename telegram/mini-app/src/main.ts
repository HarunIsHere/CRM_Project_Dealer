import "./styles.css";

declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        ready: () => void;
        expand: () => void;
        initData: string;
        initDataUnsafe?: {
          user?: {
            id?: number;
            first_name?: string;
            last_name?: string;
            username?: string;
            language_code?: string;
          };
          start_param?: string;
        };
        colorScheme?: "light" | "dark";
      };
    };
  }
}

const API_V1 = "https://crm.ayartuerk.me/api/v1";

const webApp = window.Telegram?.WebApp;
webApp?.ready();
webApp?.expand();

const user = webApp?.initDataUnsafe?.user;
const startParam = webApp?.initDataUnsafe?.start_param || "";

document.querySelector<HTMLDivElement>("#app")!.innerHTML = `
  <section class="page">
    <div class="card">
      <p class="eyebrow">CRM Delivery</p>
      <h1>Telegram Mini App Foundation</h1>
      <p class="muted">Shared customer shopping client for Telegram.</p>

      <div class="info">
        <strong>API</strong>
        <span>${API_V1}</span>
      </div>

      <div class="info">
        <strong>Telegram user</strong>
        <span>${user ? `${user.first_name || ""} ${user.last_name || ""}`.trim() || user.username || user.id : "Not opened inside Telegram"}</span>
      </div>

      <div class="info">
        <strong>Start parameter</strong>
        <span>${startParam || "None"}</span>
      </div>

      <div class="actions">
        <button id="healthButton">Check API health</button>
      </div>

      <pre id="result">Ready.</pre>
    </div>
  </section>
`;

document.querySelector<HTMLButtonElement>("#healthButton")!.addEventListener("click", async () => {
  const result = document.querySelector<HTMLPreElement>("#result")!;
  result.textContent = "Checking...";

  try {
    const response = await fetch(`${API_V1}/health`);
    const data = await response.json();
    result.textContent = JSON.stringify(data, null, 2);
  } catch (error) {
    result.textContent = error instanceof Error ? error.message : "Unknown error";
  }
});

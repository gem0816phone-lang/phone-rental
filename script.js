const phones = [
  {
    id: "iphone-15-pro",
    name: "iPhone 15 Pro",
    storage: "256GB",
    daily: 650,
    deposit: 6000,
    badge: "熱門",
    color: "#d8eee8",
    note: "拍照、錄影與高效能需求"
  },
  {
    id: "iphone-14",
    name: "iPhone 14",
    storage: "128GB",
    daily: 520,
    deposit: 5000,
    badge: "穩定",
    color: "#f9dfd7",
    note: "日常備機與出國使用"
  },
  {
    id: "galaxy-s24",
    name: "Galaxy S24",
    storage: "256GB",
    daily: 560,
    deposit: 5000,
    badge: "Android",
    color: "#dbe4ff",
    note: "展場測試、拍攝與通訊"
  },
  {
    id: "pixel-8",
    name: "Google Pixel 8",
    storage: "128GB",
    daily: 480,
    deposit: 4500,
    badge: "拍照",
    color: "#f6e7a8",
    note: "翻譯、拍照與旅遊備用"
  }
];

const currency = new Intl.NumberFormat("zh-TW", {
  style: "currency",
  currency: "TWD",
  maximumFractionDigits: 0
});

const config = window.PHONE_RENTAL_CONFIG || {};
const placeholderEndpoint = "PASTE_YOUR_GOOGLE_APPS_SCRIPT_WEB_APP_URL_HERE";

const form = document.querySelector("#reservationForm");
const modelSelect = form.elements.model;
const startInput = form.elements.rentalStart;
const endInput = form.elements.rentalEnd;
const estimateBox = document.querySelector("#estimateBox");
const formStatus = document.querySelector("#formStatus");
const submitButton = document.querySelector("#submitButton");
const phoneGrid = document.querySelector("#phoneGrid");

init();

function init() {
  renderPhoneOptions();
  renderPhoneCards();
  applyBusinessConfig();
  setDateLimits();

  form.addEventListener("input", updateEstimate);
  form.addEventListener("submit", handleSubmit);
  updateEstimate();
}

function renderPhoneOptions() {
  phones.forEach((phone) => {
    const option = new Option(`${phone.name} / ${phone.storage} / ${currency.format(phone.daily)} 每日`, phone.id);
    modelSelect.add(option);
  });
}

function renderPhoneCards() {
  phoneGrid.innerHTML = phones
    .map(
      (phone) => `
        <article class="phone-card">
          <div class="phone-top">
            <div>
              <h3>${phone.name}</h3>
              <p>${phone.storage}</p>
            </div>
            <span class="tag">${phone.badge}</span>
          </div>
          <div class="device-art" style="--device-color: ${phone.color}" aria-hidden="true"></div>
          <div class="phone-meta">
            <span class="price">${currency.format(phone.daily)} / 日</span>
            <span>押金 ${currency.format(phone.deposit)}</span>
            <span>${phone.note}</span>
          </div>
        </article>
      `
    )
    .join("");
}

function applyBusinessConfig() {
  const lineUrl = config.businessLineUrl || "https://line.me";
  const phoneNumber = config.businessPhone || "0900-000-000";
  const phoneHref = `tel:${phoneNumber.replace(/[^\d+]/g, "")}`;

  document.querySelectorAll("[data-line-link]").forEach((link) => {
    link.href = lineUrl;
  });

  document.querySelectorAll("[data-phone-link]").forEach((link) => {
    link.href = phoneHref;
    link.textContent = phoneNumber;
  });
}

function setDateLimits() {
  const today = toDateInputValue(new Date());
  startInput.min = today;
  endInput.min = today;
}

function updateEstimate() {
  endInput.min = startInput.value || toDateInputValue(new Date());

  const phone = getSelectedPhone();
  const days = getRentalDays();

  if (!phone || !days) {
    estimateBox.textContent = "選擇日期與機型後會顯示預估租金。";
    return;
  }

  const rentalTotal = phone.daily * days;
  estimateBox.innerHTML = `
    <strong>${phone.name}，共 ${days} 天，預估租金 ${currency.format(rentalTotal)}</strong>
    押金 ${currency.format(phone.deposit)} 另計，歸還驗機後退回。最終金額以店家確認為準。
  `;
}

function getSelectedPhone() {
  return phones.find((phone) => phone.id === modelSelect.value);
}

function getRentalDays() {
  if (!startInput.value || !endInput.value) {
    return null;
  }

  const start = parseDate(startInput.value);
  const end = parseDate(endInput.value);
  const dayMs = 24 * 60 * 60 * 1000;
  const diff = Math.round((end - start) / dayMs);

  return diff >= 0 ? diff + 1 : null;
}

async function handleSubmit(event) {
  event.preventDefault();
  clearStatus();

  const phone = getSelectedPhone();
  const days = getRentalDays();

  if (!phone || !days) {
    showStatus("error", "請確認租借日期與手機型號是否正確。");
    return;
  }

  if (!form.reportValidity()) {
    return;
  }

  const payload = new FormData(form);
  const reservationId = createReservationId();
  const rentalTotal = phone.daily * days;

  payload.set("reservationId", reservationId);
  payload.set("modelName", phone.name);
  payload.set("storage", phone.storage);
  payload.set("dailyPrice", String(phone.daily));
  payload.set("deposit", String(phone.deposit));
  payload.set("rentalDays", String(days));
  payload.set("rentalTotal", String(rentalTotal));
  payload.set("createdAt", new Date().toISOString());
  payload.set("pageUrl", window.location.href);

  if (payload.get("companyWebsite")) {
    showStatus("success", `預約已送出，預約編號 ${reservationId}。`);
    form.reset();
    setDateLimits();
    updateEstimate();
    return;
  }

  submitButton.disabled = true;
  submitButton.textContent = "送出中...";

  try {
    const endpoint = getAppsScriptUrl();

    if (!endpoint) {
      saveDemoReservation(payload);
      showStatus(
        "warning",
        `目前是測試模式，資料尚未寫入 Google Sheet。預約編號 ${reservationId} 已暫存在這台瀏覽器，請先在 config.js 貼上 Apps Script 網址。`
      );
    } else {
      await fetch(endpoint, {
        method: "POST",
        mode: "no-cors",
        body: payload
      });
      showStatus("success", `預約已送出，預約編號 ${reservationId}。我們會用 LINE 或電話確認。`);
      form.reset();
      setDateLimits();
      updateEstimate();
    }
  } catch (error) {
    showStatus("error", "送出時遇到問題，請稍後再試，或直接用 LINE 聯絡店家。");
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = "送出預約";
  }
}

function getAppsScriptUrl() {
  const endpoint = (config.appsScriptUrl || "").trim();

  if (!endpoint || endpoint === placeholderEndpoint) {
    return "";
  }

  return endpoint;
}

function saveDemoReservation(payload) {
  const reservation = Object.fromEntries(payload.entries());
  const saved = JSON.parse(localStorage.getItem("phoneRentalDemoReservations") || "[]");
  saved.push(reservation);
  localStorage.setItem("phoneRentalDemoReservations", JSON.stringify(saved.slice(-20)));
}

function showStatus(type, message) {
  formStatus.className = `form-status is-visible ${type}`;
  formStatus.textContent = message;
}

function clearStatus() {
  formStatus.className = "form-status";
  formStatus.textContent = "";
}

function parseDate(value) {
  return new Date(`${value}T00:00:00`);
}

function toDateInputValue(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function createReservationId() {
  const stamp = Date.now().toString(36).toUpperCase();
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `PR-${stamp}-${suffix}`;
}

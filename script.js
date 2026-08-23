const phone = {
  id: "vivo-x300-ultra",
  name: "vivo X300 Ultra",
  storage: "12/256GB",
  daily: 700,
  discountedDaily: 600,
  discountMinDays: 4,
  depositWithId: 5000,
  depositNoId: 30000,
  badge: "唯一機型",
  color: "#d8eee8",
  note: "12/256GB，適合旅遊、拍攝、備用機"
};

const currency = new Intl.NumberFormat("zh-TW", {
  style: "currency",
  currency: "TWD",
  maximumFractionDigits: 0
});

const weekdayFormatter = new Intl.DateTimeFormat("zh-TW", { weekday: "short" });
const monthFormatter = new Intl.DateTimeFormat("zh-TW", { year: "numeric", month: "long" });
const config = window.PHONE_RENTAL_CONFIG || {};
const placeholderEndpoint = "PASTE_YOUR_GOOGLE_APPS_SCRIPT_WEB_APP_URL_HERE";

const form = document.querySelector("#reservationForm");
const dateStep = document.querySelector("#dateStep");
const detailsStep = document.querySelector("#detailsStep");
const dateStepPill = document.querySelector("#dateStepPill");
const detailsStepPill = document.querySelector("#detailsStepPill");
const calendarGrid = document.querySelector("#calendarGrid");
const monthLabel = document.querySelector("#monthLabel");
const prevMonthButton = document.querySelector("#prevMonthButton");
const nextMonthButton = document.querySelector("#nextMonthButton");
const continueButton = document.querySelector("#continueButton");
const editDatesButton = document.querySelector("#editDatesButton");
const estimateBox = document.querySelector("#estimateBox");
const selectedDatesReview = document.querySelector("#selectedDatesReview");
const availabilityStatus = document.querySelector("#availabilityStatus");
const formStatus = document.querySelector("#formStatus");
const submitButton = document.querySelector("#submitButton");

const today = startOfDay(new Date());
let visibleMonth = new Date(today.getFullYear(), today.getMonth(), 1);
const selectedDates = new Set();
let unavailableDates = new Set(config.unavailableDates || []);

init();

function init() {
  applyBusinessConfig();
  bindEvents();
  renderCalendar();
  updateSelectionSummary();
  loadAvailability();
}

function bindEvents() {
  prevMonthButton.addEventListener("click", () => changeMonth(-1));
  nextMonthButton.addEventListener("click", () => changeMonth(1));
  continueButton.addEventListener("click", showDetailsStep);
  editDatesButton.addEventListener("click", showDateStep);
  form.addEventListener("change", updateSelectionSummary);
  form.addEventListener("submit", handleSubmit);
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

function changeMonth(delta) {
  visibleMonth = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + delta, 1);
  renderCalendar();
}

function renderCalendar() {
  const year = visibleMonth.getFullYear();
  const month = visibleMonth.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const minMonth = new Date(today.getFullYear(), today.getMonth(), 1);

  monthLabel.textContent = monthFormatter.format(visibleMonth);
  prevMonthButton.disabled = visibleMonth <= minMonth;

  const cells = [];

  for (let i = 0; i < firstDay.getDay(); i += 1) {
    cells.push('<span class="calendar-empty" aria-hidden="true"></span>');
  }

  for (let day = 1; day <= lastDay.getDate(); day += 1) {
    const date = new Date(year, month, day);
    const dateString = toDateInputValue(date);
    const isWeekend = date.getDay() === 0 || date.getDay() === 6;
    const isPast = date < today;
    const isFull = unavailableDates.has(dateString);
    const isSelected = selectedDates.has(dateString);
    const status = isPast ? "已過" : isFull ? "已滿" : "可選";
    const statusClass = isPast ? "status-past" : isSelected ? "status-selected" : isFull ? "status-full" : "status-available";
    const classes = ["calendar-day"];

    if (isWeekend) classes.push("is-weekend");
    if (isPast) classes.push("is-past");
    if (isFull) classes.push("is-full");
    if (isSelected) classes.push("is-selected");

    cells.push(`
      <button
        class="${classes.join(" ")}"
        type="button"
        data-date="${dateString}"
        ${isPast || isFull ? "disabled" : ""}
        aria-pressed="${isSelected ? "true" : "false"}"
        aria-label="${dateString} ${status}${isSelected ? "，已選" : ""}"
      >
        <span class="date-number">${day}</span>
        <span class="date-status ${statusClass}">${isSelected ? "已選" : status}</span>
      </button>
    `);
  }

  calendarGrid.innerHTML = cells.join("");
  calendarGrid.querySelectorAll(".calendar-day:not(:disabled)").forEach((button) => {
    button.addEventListener("click", () => toggleDate(button.dataset.date));
  });
}

function toggleDate(dateString) {
  if (selectedDates.has(dateString)) {
    selectedDates.delete(dateString);
  } else {
    selectedDates.add(dateString);
  }

  clearStatus();
  renderCalendar();
  updateSelectionSummary();
}

function updateSelectionSummary() {
  const dates = getSelectedDateList();
  const days = dates.length;

  form.elements.selectedDates.value = dates.join(",");
  form.elements.rentalStart.value = dates[0] || "";
  form.elements.rentalEnd.value = dates[dates.length - 1] || "";
  continueButton.disabled = days === 0;

  if (!days) {
    estimateBox.textContent = "請先在日曆上選擇要租的日期。";
    selectedDatesReview.textContent = "";
    return;
  }

  const dailyRate = getDailyRate(dates);
  const rentalTotal = days * dailyRate;
  const dateText = dates.map(formatDateLabel).join("、");
  const depositOption = form.elements.depositOption?.value || "尚未選擇押金方式";

  estimateBox.innerHTML = `
    <strong>已選 ${days} 天，預估租金 ${currency.format(rentalTotal)}</strong>
    ${dateText}<br />
    <span>${dailyRate} 元 / 日${dailyRate === phone.discountedDaily ? "，已套用連租優惠" : ""}</span>
  `;
  selectedDatesReview.innerHTML = `
    <strong>${phone.name} ${phone.storage}</strong>
    <span>租借日期：${dateText}</span>
    <span>租金：${currency.format(rentalTotal)}（${dailyRate} 元 / 日），押金方式：${depositOption}</span>
  `;
}

function showDetailsStep() {
  if (!selectedDates.size) {
    showStatus("error", "請先選擇至少一天可選日期。");
    return;
  }

  dateStep.hidden = true;
  detailsStep.hidden = false;
  dateStepPill.classList.remove("is-active");
  detailsStepPill.classList.add("is-active");
  clearStatus();
  updateSelectionSummary();
}

function showDateStep() {
  dateStep.hidden = false;
  detailsStep.hidden = true;
  dateStepPill.classList.add("is-active");
  detailsStepPill.classList.remove("is-active");
  clearStatus();
}

async function handleSubmit(event) {
  event.preventDefault();
  clearStatus();

  const dates = getSelectedDateList();

  if (!dates.length) {
    showDateStep();
    showStatus("error", "請先在日曆上選擇要租的日期。");
    return;
  }

  const conflictedDates = dates.filter((date) => unavailableDates.has(date));

  if (conflictedDates.length) {
    showDateStep();
    showStatus("error", `${conflictedDates.map(formatDateLabel).join("、")} 已滿，請重新選擇日期。`);
    return;
  }

  if (!form.reportValidity()) {
    return;
  }

  const payload = new FormData(form);
  const reservationId = createReservationId();
  const dailyRate = getDailyRate(dates);
  const rentalTotal = dates.length * dailyRate;
  const depositAmount = payload.get("depositOption") === "30000 元 (免證件)" ? phone.depositNoId : phone.depositWithId;

  payload.set("reservationId", reservationId);
  payload.set("modelName", phone.name);
  payload.set("storage", phone.storage);
  payload.set("dailyPrice", String(dailyRate));
  payload.set("deposit", String(depositAmount));
  payload.set("rentalDays", String(dates.length));
  payload.set("rentalTotal", String(rentalTotal));
  payload.set("selectedDates", dates.join(","));
  payload.set("rentalStart", dates[0]);
  payload.set("rentalEnd", dates[dates.length - 1]);
  payload.set("createdAt", new Date().toISOString());
  payload.set("pageUrl", window.location.href);

  if (payload.get("companyWebsite")) {
    completeReservation(reservationId, dates);
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
        `目前是測試模式，資料尚未寫入 Google Sheet。預約編號 ${reservationId} 已暫存在這台瀏覽器。`
      );
    } else {
      await fetch(endpoint, {
        method: "POST",
        mode: "no-cors",
        body: payload
      });
      completeReservation(reservationId, dates);
    }
  } catch (error) {
    showStatus("error", "送出時遇到問題，請稍後再試，或直接用 LINE 聯絡店家。");
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = "送出預約";
  }
}

function completeReservation(reservationId, dates) {
  dates.forEach((date) => unavailableDates.add(date));
  form.reset();
  selectedDates.clear();
  showDateStep();
  renderCalendar();
  updateSelectionSummary();
  showStatus("success", `預約已送出，預約編號 ${reservationId}。我們會用 LINE 或電話確認。`);
}

function loadAvailability() {
  const endpoint = getAppsScriptUrl();

  if (!endpoint) {
    availabilityStatus.textContent = "目前是測試模式，日曆只會使用前端設定的已滿日期。";
    return;
  }

  const requestUrl = new URL(endpoint);
  requestUrl.searchParams.set("action", "availability");
  requestUrl.searchParams.set("cachebust", String(Date.now()));

  fetch(requestUrl.toString(), {
    method: "GET",
    cache: "no-store"
  })
    .then((response) => {
      if (!response.ok) {
        throw new Error("Availability request failed");
      }

      return response.json();
    })
    .then((payload) => {
      if (!payload || !payload.ok || !Array.isArray(payload.unavailableDates)) {
        throw new Error("Invalid availability response");
      }

      unavailableDates = new Set([...(config.unavailableDates || []), ...payload.unavailableDates]);
      availabilityStatus.textContent = `同步更新時間 ${formatTime(new Date())}`;
      renderCalendar();
      updateSelectionSummary();
    })
    .catch(() => {
      availabilityStatus.textContent = "目前無法同步已滿日期，仍可先查看日曆並送出預約。";
    });
}

function getSelectedDateList() {
  return [...selectedDates].sort();
}

function getDailyRate(dates) {
  return dates.length >= phone.discountMinDays && areConsecutiveDates(dates) ? phone.discountedDaily : phone.daily;
}

function areConsecutiveDates(dates) {
  return dates.every((date, index) => {
    if (index === 0) return true;

    const previousDate = parseDate(dates[index - 1]);
    const currentDate = parseDate(date);
    const dayDifference = (currentDate - previousDate) / 86400000;

    return dayDifference === 1;
  });
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

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function toDateInputValue(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseDate(value) {
  return new Date(`${value}T00:00:00`);
}

function formatDateLabel(value) {
  const date = parseDate(value);
  return `${date.getMonth() + 1}/${date.getDate()}(${weekdayFormatter.format(date)})`;
}

function formatTime(date) {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function createReservationId() {
  const stamp = Date.now().toString(36).toUpperCase();
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `PR-${stamp}-${suffix}`;
}

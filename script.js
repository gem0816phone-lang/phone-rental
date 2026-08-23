const rentalItems = [
  {
    id: "vivo-x300-ultra",
    name: "vivo X300 Ultra",
    spec: "12/256GB",
    image: "vivo x300 ultra.jpg",
    daily: 700,
    discountedDaily: 600,
    discountMinDays: 4,
    depositWithId: 3000,
    depositNoId: 30000
  },
  {
    id: "g2-ultra-400mm",
    name: "G2 Ultra 增距鏡",
    spec: "400mm",
    image: "G2 ultra 增距鏡 400mm.jpg",
    daily: 300,
    discountedDaily: 200,
    discountMinDays: 4,
    depositWithId: 1000,
    depositNoId: 10000
  }
];

const comboPackage = {
  id: "combo-vivo-g2",
  typeLabel: "組合",
  selectedItemIds: ["vivo-x300-ultra", "g2-ultra-400mm"],
  image: "vivo x300 ultra + G2 ultra 增距鏡 400mm.jpg",
  daily: 900,
  discountedDaily: 700,
  discountMinDays: 4,
  depositWithId: 4000,
  depositNoId: 40000
};

const itemMap = new Map(rentalItems.map((item) => [item.id, item]));
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
const bookingTitle = document.querySelector("#booking-title");
const itemStep = document.querySelector("#itemStep");
const dateStep = document.querySelector("#dateStep");
const detailsStep = document.querySelector("#detailsStep");
const itemStepPill = document.querySelector("#itemStepPill");
const dateStepPill = document.querySelector("#dateStepPill");
const detailsStepPill = document.querySelector("#detailsStepPill");
const itemGrid = document.querySelector("#itemGrid");
const itemSummaryBox = document.querySelector("#itemSummaryBox");
const itemContinueButton = document.querySelector("#itemContinueButton");
const packageSummary = document.querySelector("#packageSummary");
const calendarGrid = document.querySelector("#calendarGrid");
const monthLabel = document.querySelector("#monthLabel");
const prevMonthButton = document.querySelector("#prevMonthButton");
const nextMonthButton = document.querySelector("#nextMonthButton");
const continueButton = document.querySelector("#continueButton");
const editItemsButton = document.querySelector("#editItemsButton");
const editDatesButton = document.querySelector("#editDatesButton");
const estimateBox = document.querySelector("#estimateBox");
const selectedDatesReview = document.querySelector("#selectedDatesReview");
const depositOptions = document.querySelector("#depositOptions");
const availabilityStatus = document.querySelector("#availabilityStatus");
const formStatus = document.querySelector("#formStatus");
const submitButton = document.querySelector("#submitButton");

const today = startOfDay(new Date());
const localBookedDatesByItem = {};
let itemCardResizeObserver;
let visibleMonth = new Date(today.getFullYear(), today.getMonth(), 1);
let selectedDates = new Set();
let selectedPackageId = "";
let unavailableDates = new Set(config.unavailableDates || []);
let latestAvailabilityKey = "";

init();

function init() {
  renderItemOptions();
  renderDepositOptions();
  applyBusinessConfig();
  bindEvents();
  showItemStep();
  renderCalendar();
  updateSelectionSummary();
}

function bindEvents() {
  itemGrid.addEventListener("change", (event) => {
    if (event.target.matches('input[name="packageId"]')) {
      handleItemSelectionChange(event);
    }
  });
  itemContinueButton.addEventListener("click", showDateStep);
  editItemsButton.addEventListener("click", showItemStep);
  prevMonthButton.addEventListener("click", () => changeMonth(-1));
  nextMonthButton.addEventListener("click", () => changeMonth(1));
  continueButton.addEventListener("click", showDetailsStep);
  editDatesButton.addEventListener("click", showDateStep);
  form.addEventListener("change", (event) => {
    if (!event.target.matches('input[name="packageId"]')) {
      updateSelectionSummary();
    }
  });
  form.addEventListener("submit", handleSubmit);
}

function renderItemOptions() {
  itemGrid.innerHTML = getPackageOptions().map((packageInfo) => `
    <label class="item-card" data-package-id="${packageInfo.id}">
      <input class="item-check" type="checkbox" name="packageId" value="${packageInfo.id}" />
      <img class="item-photo" src="${packageInfo.image}" alt="${packageInfo.displayName}" />
      <span class="item-content">
        <span class="item-head">
          <span class="item-title">${renderOptionTitle(packageInfo)}</span>
          <span class="option-type-pill">${packageInfo.typeLabel}</span>
        </span>
        <span class="item-details">
          <span class="item-meta rule-row rate-rule">
            <span>單日租金：${packageInfo.daily} 元 / 日</span>
            <span class="rule-separator">｜</span>
            <span>連續四日：${packageInfo.discountedDaily} 元 / 日</span>
          </span>
          <span class="item-meta rule-row deposit-rule">
            <span>證件押金：${packageInfo.depositWithId} 元 + 證件</span>
            <span class="rule-separator">｜</span>
            <span>免證押金：${packageInfo.depositNoId} 元</span>
          </span>
        </span>
      </span>
    </label>
  `).join("");
  setupItemCardRuleWrapping();
}

function getPackageOptions() {
  return [
    getComboPackageInfo(),
    ...rentalItems.map((item) => getSinglePackageInfo(item.id))
  ].filter(Boolean);
}

function getSinglePackageInfo(itemId) {
  const item = itemMap.get(itemId);

  if (!item) {
    return null;
  }

  return {
    id: `single-${item.id}`,
    typeLabel: "單租",
    selectedItemIds: [item.id],
    components: [item],
    image: item.image,
    displayName: `[單租] ${item.name} ${item.spec}`,
    specSummary: item.spec,
    daily: item.daily,
    discountedDaily: item.discountedDaily,
    discountMinDays: item.discountMinDays,
    depositWithId: item.depositWithId,
    depositNoId: item.depositNoId
  };
}

function getComboPackageInfo() {
  const components = comboPackage.selectedItemIds.map((itemId) => itemMap.get(itemId));

  if (components.some((item) => !item)) {
    return null;
  }

  return {
    ...comboPackage,
    components,
    displayName: `[組合] ${components.map((item) => item.name).join(" + ")}`,
    hideSpecsInTitle: true,
    specSummary: components.map((item) => item.spec).join(" + ")
  };
}

function renderOptionTitle(packageInfo) {
  return `
    ${packageInfo.components.map((item, index) => `
      ${index > 0 ? '<span class="plus-sign">+</span>' : ""}
      <span class="title-pair">
        <strong>${item.name}</strong>
        ${packageInfo.hideSpecsInTitle ? "" : `<span class="spec-badge">${item.spec}</span>`}
      </span>
    `).join("")}
  `;
}

function setupItemCardRuleWrapping() {
  if (itemCardResizeObserver) {
    itemCardResizeObserver.disconnect();
  }

  const cards = [...document.querySelectorAll(".item-card")];
  const updateAllCards = () => cards.forEach(updateCardRuleLayout);

  if (!window.ResizeObserver) {
    requestAnimationFrame(updateAllCards);
    window.addEventListener("resize", updateAllCards);
    return;
  }

  itemCardResizeObserver = new ResizeObserver((entries) => {
    entries.forEach((entry) => updateCardRuleLayout(entry.target));
  });

  cards.forEach((card) => {
    itemCardResizeObserver.observe(card);
    requestAnimationFrame(() => updateCardRuleLayout(card));
  });
}

function updateCardRuleLayout(card) {
  card.classList.remove("is-compact-rules");

  const rows = [...card.querySelectorAll(".rule-row")];
  const needsCompact = rows.some((row) => {
    const rowContentWidth = [...row.children].reduce((total, child) => total + child.scrollWidth, 0);

    return rowContentWidth > row.clientWidth + 1;
  });

  if (needsCompact) {
    card.classList.add("is-compact-rules");
  }
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

function handleItemSelectionChange(event) {
  const clickedPackageId = event.target.value;
  const isChecking = event.target.checked;
  const previousPackageId = selectedPackageId;

  event.target.blur();

  if (!isChecking && previousPackageId === clickedPackageId) {
    selectedPackageId = "";
  } else if (clickedPackageId === comboPackage.id) {
    selectedPackageId = comboPackage.id;
  } else if (
    previousPackageId &&
    previousPackageId !== comboPackage.id &&
    previousPackageId !== clickedPackageId
  ) {
    selectedPackageId = comboPackage.id;
  } else {
    selectedPackageId = clickedPackageId;
  }

  selectedDates = new Set();
  clearStatus();
  updateItemSelection();
  renderDepositOptions();
  renderCalendar();
  updateSelectionSummary();
  loadAvailability();
}

function updateItemSelection() {
  const selectedItemIds = getSelectedItemIds();
  const packageInfo = getPackageInfo();

  syncPackageInputs();

  document.querySelectorAll(".item-card").forEach((card) => {
    card.classList.toggle("is-selected", card.dataset.packageId === selectedPackageId);
  });

  form.elements.selectedItems.value = selectedItemIds.join(",");
  form.elements.model.value = packageInfo?.id || "";
  form.elements.rentalPackage.value = packageInfo?.displayName || "";
  itemContinueButton.disabled = selectedItemIds.length === 0;

  if (!packageInfo) {
    itemSummaryBox.textContent = "請先選擇要租的物品，可多選。";
    packageSummary.innerHTML = "";
    availabilityStatus.textContent = "請先選擇物品。";
    return;
  }

  itemSummaryBox.innerHTML = `
    <strong>${packageInfo.displayName}</strong>
    <span>${formatRateRule(packageInfo)}</span>
    <span>${formatDepositRule(packageInfo)}</span>
  `;
  packageSummary.innerHTML = renderPackageSummary(packageInfo);
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
  const packageInfo = getPackageInfo();
  const canSelectDates = Boolean(packageInfo);

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
    const isFull = canSelectDates && unavailableDates.has(dateString);
    const isSelected = selectedDates.has(dateString);
    const status = !canSelectDates ? "先選" : isPast ? "已過" : isFull ? "已滿" : "可選";
    const statusClass = !canSelectDates
      ? "status-past"
      : isPast
        ? "status-past"
        : isSelected
          ? "status-selected"
          : isFull
            ? "status-full"
            : "status-available";
    const classes = ["calendar-day"];

    if (isWeekend) classes.push("is-weekend");
    if (isPast || !canSelectDates) classes.push("is-past");
    if (isFull) classes.push("is-full");
    if (isSelected) classes.push("is-selected");

    cells.push(`
      <button
        class="${classes.join(" ")}"
        type="button"
        data-date="${dateString}"
        ${!canSelectDates || isPast || isFull ? "disabled" : ""}
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
  const packageInfo = getPackageInfo();
  const dates = getSelectedDateList();
  const days = dates.length;

  updateItemSelection();
  form.elements.selectedDates.value = dates.join(",");
  form.elements.rentalStart.value = dates[0] || "";
  form.elements.rentalEnd.value = dates[dates.length - 1] || "";
  continueButton.disabled = !packageInfo || days === 0;

  if (!packageInfo) {
    estimateBox.textContent = "請先選擇要租的物品。";
    selectedDatesReview.textContent = "";
    return;
  }

  if (!days) {
    estimateBox.innerHTML = `
      <strong>${packageInfo.displayName}</strong>
      請先在日曆上選擇要租的日期。
    `;
    selectedDatesReview.textContent = "";
    return;
  }

  const dailyRate = getDailyRate(dates, packageInfo);
  const rentalTotal = days * dailyRate;
  const dateText = dates.map(formatDateLabel).join("、");
  const depositOption = form.elements.depositOption?.value || "尚未選擇押金方式";

  estimateBox.innerHTML = `
    <strong>已選 ${days} 天，預估租金 ${currency.format(rentalTotal)}</strong>
    <span>${packageInfo.displayName}</span>
    <span>${dateText}</span>
    <span>${dailyRate} 元 / 日${dailyRate === packageInfo.discountedDaily ? "，已套用連租優惠" : ""}</span>
  `;
  selectedDatesReview.innerHTML = `
    <strong>${packageInfo.displayName}</strong>
    <span>租借日期：${dateText}</span>
    <span>租金：${currency.format(rentalTotal)}（${dailyRate} 元 / 日），押金方式：${depositOption}</span>
  `;
}

function showItemStep() {
  itemStep.hidden = false;
  dateStep.hidden = true;
  detailsStep.hidden = true;
  setActiveStep("item");
  clearStatus();
  updateItemSelection();
  updateSelectionSummary();
}

function showDateStep() {
  const packageInfo = getPackageInfo();

  if (!packageInfo) {
    showItemStep();
    showStatus("error", "請先選擇要租的物品。");
    return;
  }

  itemStep.hidden = true;
  dateStep.hidden = false;
  detailsStep.hidden = true;
  setActiveStep("date");
  clearStatus();
  renderDepositOptions();
  renderCalendar();
  updateSelectionSummary();
  loadAvailability();
}

function showDetailsStep() {
  const packageInfo = getPackageInfo();

  if (!packageInfo) {
    showItemStep();
    showStatus("error", "請先選擇要租的物品。");
    return;
  }

  if (!selectedDates.size) {
    showStatus("error", "請先選擇至少一天可選日期。");
    return;
  }

  itemStep.hidden = true;
  dateStep.hidden = true;
  detailsStep.hidden = false;
  setActiveStep("details");
  clearStatus();
  renderDepositOptions();
  updateSelectionSummary();
}

async function handleSubmit(event) {
  event.preventDefault();
  clearStatus();

  const packageInfo = getPackageInfo();
  const selectedItemIds = getSelectedItemIds();
  const dates = getSelectedDateList();

  if (!packageInfo) {
    showItemStep();
    showStatus("error", "請先選擇要租的物品。");
    return;
  }

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
  const dailyRate = getDailyRate(dates, packageInfo);
  const rentalTotal = dates.length * dailyRate;
  const depositAmount = payload.get("depositOption") === getDepositNoIdLabel(packageInfo)
    ? packageInfo.depositNoId
    : packageInfo.depositWithId;

  payload.set("reservationId", reservationId);
  payload.set("selectedItems", selectedItemIds.join(","));
  payload.set("itemNames", packageInfo.displayName);
  payload.set("model", packageInfo.id);
  payload.set("modelName", packageInfo.displayName);
  payload.set("storage", packageInfo.specSummary);
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
    completeReservation(reservationId, dates, selectedItemIds);
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
      completeReservation(reservationId, dates, selectedItemIds);
    }
  } catch (error) {
    showStatus("error", "送出時遇到問題，請稍後再試，或直接用 LINE 聯絡店家。");
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = "送出預約";
  }
}

function completeReservation(reservationId, dates, itemIds) {
  itemIds.forEach((itemId) => {
    if (!localBookedDatesByItem[itemId]) {
      localBookedDatesByItem[itemId] = new Set();
    }

    dates.forEach((date) => localBookedDatesByItem[itemId].add(date));
  });

  form.reset();
  selectedDates = new Set();
  selectedPackageId = "";
  unavailableDates = new Set(config.unavailableDates || []);
  renderDepositOptions();
  showItemStep();
  renderCalendar();
  updateSelectionSummary();
  showStatus("success", `預約已送出，預約編號 ${reservationId}。我們會用 LINE 或電話確認。`);
}

function loadAvailability() {
  const packageInfo = getPackageInfo();

  if (!packageInfo) {
    unavailableDates = new Set(config.unavailableDates || []);
    availabilityStatus.textContent = "請先選擇物品。";
    renderCalendar();
    return;
  }

  const requestKey = packageInfo.selectedItemIds.join("|");
  latestAvailabilityKey = requestKey;
  unavailableDates = getLocalUnavailableDates(packageInfo.selectedItemIds);
  renderCalendar();

  const endpoint = getAppsScriptUrl();

  if (!endpoint) {
    availabilityStatus.textContent = "目前是測試模式，日曆只會使用前端設定的已滿日期。";
    return;
  }

  const requestUrl = new URL(endpoint);
  requestUrl.searchParams.set("action", "availability");
  requestUrl.searchParams.set("selectedItems", packageInfo.selectedItemIds.join(","));
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
      if (requestKey !== latestAvailabilityKey) {
        return;
      }

      if (!payload || !payload.ok || !Array.isArray(payload.unavailableDates)) {
        throw new Error("Invalid availability response");
      }

      unavailableDates = new Set([
        ...getLocalUnavailableDates(packageInfo.selectedItemIds),
        ...payload.unavailableDates
      ]);
      availabilityStatus.textContent = `同步更新時間 ${formatTime(new Date())}`;
      renderCalendar();
      updateSelectionSummary();
    })
    .catch(() => {
      if (requestKey === latestAvailabilityKey) {
        availabilityStatus.textContent = "目前無法同步已滿日期，仍可先查看日曆並送出預約。";
      }
    });
}

function renderDepositOptions() {
  const packageInfo = getPackageInfo();

  if (!packageInfo) {
    depositOptions.innerHTML = `
      <legend>押金方式</legend>
      <p class="deposit-hint">請先選擇租借物品。</p>
    `;
    return;
  }

  const withIdLabel = getDepositWithIdLabel(packageInfo);
  const noIdLabel = getDepositNoIdLabel(packageInfo);

  depositOptions.innerHTML = `
    <legend>押金方式</legend>
    <label>
      <input type="radio" name="depositOption" value="${withIdLabel}" required />
      <span>${withIdLabel}</span>
    </label>
    <label>
      <input type="radio" name="depositOption" value="${noIdLabel}" required />
      <span>${noIdLabel}</span>
    </label>
  `;
}

function setActiveStep(step) {
  itemStepPill.classList.toggle("is-active", step === "item");
  dateStepPill.classList.toggle("is-active", step === "date");
  detailsStepPill.classList.toggle("is-active", step === "details");

  if (step === "item") bookingTitle.textContent = "先選租借物品";
  if (step === "date") bookingTitle.textContent = "選擇租借日期";
  if (step === "details") bookingTitle.textContent = "填寫預約資料";
}

function getSelectedItemIds() {
  return getPackageInfo()?.selectedItemIds.slice() || [];
}

function getPackageInfo(packageId = selectedPackageId) {
  if (!packageId) {
    return null;
  }

  if (packageId === comboPackage.id) {
    return getComboPackageInfo();
  }

  if (packageId.startsWith("single-")) {
    return getSinglePackageInfo(packageId.replace("single-", ""));
  }

  return null;
}

function syncPackageInputs() {
  form.querySelectorAll('input[name="packageId"]').forEach((input) => {
    input.checked = input.value === selectedPackageId;
  });
}

function renderPackageSummary(packageInfo) {
  const images = `<img class="summary-photo" src="${packageInfo.image}" alt="${packageInfo.displayName}" />`;
  const componentNames = packageInfo.components.map((item) => `
    <span class="component-name">
      ${item.name}
      <span class="spec-badge">${item.spec}</span>
    </span>
  `).join("");

  return `
    <div class="summary-photos">${images}</div>
    <div>
      <div class="package-title">
        <span class="option-type-pill summary-type">${packageInfo.typeLabel}</span>
        ${componentNames}
      </div>
      <p>${formatRateRule(packageInfo)}</p>
      <p>${formatDepositRule(packageInfo)}</p>
    </div>
  `;
}

function getLocalUnavailableDates(itemIds) {
  const dates = new Set(config.unavailableDates || []);

  itemIds.forEach((itemId) => {
    const localDates = localBookedDatesByItem[itemId];

    if (localDates) {
      localDates.forEach((date) => dates.add(date));
    }
  });

  return dates;
}

function getSelectedDateList() {
  return [...selectedDates].sort();
}

function getDailyRate(dates, packageInfo) {
  return dates.length >= packageInfo.discountMinDays && areConsecutiveDates(dates)
    ? packageInfo.discountedDaily
    : packageInfo.daily;
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

function formatRateRule(packageInfo) {
  return `單日租金：${packageInfo.daily} 元 / 日 ｜ 連續四日：${packageInfo.discountedDaily} 元 / 日`;
}

function formatDepositRule(packageInfo) {
  return `證件押金：${packageInfo.depositWithId} 元 + 證件 ｜ 免證押金：${packageInfo.depositNoId} 元`;
}

function getDepositWithIdLabel(packageInfo) {
  return `${packageInfo.depositWithId} 元 + 證件`;
}

function getDepositNoIdLabel(packageInfo) {
  return `${packageInfo.depositNoId} 元 (免證件)`;
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

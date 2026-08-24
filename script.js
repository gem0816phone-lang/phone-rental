const rentalItems = [
  {
    id: "vivo-x300-ultra",
    name: "vivo X300 Ultra",
    spec: "12/256GB",
    image: "vivo x300 ultra.jpg",
    daily: 700,
    discountedDaily: 600,
    discountMinDays: 3,
    depositWithId: 4000,
    depositNoId: 30000
  },
  {
    id: "g2-ultra-400mm",
    name: "G2 Ultra 增距鏡",
    spec: "400mm",
    image: "G2 ultra 增距鏡 400mm.jpg",
    daily: 300,
    discountedDaily: 250,
    discountMinDays: 3,
    depositWithId: 1000,
    depositNoId: 10000
  },
  {
    id: "ray-ban-meta",
    name: "Ray-Ban Meta 智慧眼鏡",
    spec: "方框M",
    image: "Ray-Ban Meta 智慧眼鏡.jpg",
    imageLabel: "Ray-Ban Meta 智慧眼鏡",
    daily: 200,
    discountedDaily: 150,
    discountMinDays: 3,
    addOnDaily: 100,
    depositWithId: 1000,
    depositNoId: 10000,
    canCoexist: true
  }
];

const comboPackage = {
  id: "combo-vivo-g2",
  typeLabel: "組合",
  selectedItemIds: ["vivo-x300-ultra", "g2-ultra-400mm"],
  image: "vivo x300 ultra + G2 ultra 增距鏡 400mm.jpg",
  daily: 900,
  discountedDaily: 750,
  discountMinDays: 3,
  depositWithId: 5000,
  depositNoId: 40000
};

const pickupLocationOptions = [
  { label: "大直捷運站", fee: 0, feeLabel: "+ 0 元" },
  { label: "台北小巨蛋", fee: 100, feeLabel: "+ 100 元", optionLabel: "台北小巨蛋 ｜ 未滿 3 日 + 100 元 ｜ 連續 3 日 + 0 元" },
  { label: "台北大巨蛋", fee: 150, feeLabel: "+ 150 元", optionLabel: "台北大巨蛋 ｜ 未滿 3 日 + 150 元 ｜ 連續 3 日 + 0 元" }
];

const dropoffLocationOptions = [
  { label: "大直捷運站", fee: 0, feeLabel: "+ 0 元" },
  { label: "台北小巨蛋", fee: 100, feeLabel: "+ 100 元", optionLabel: "台北小巨蛋 ｜ 未滿 3 日 + 100 元 ｜ 連續 3 日 + 0 元" },
  { label: "台北大巨蛋", fee: 150, feeLabel: "+ 150 元", optionLabel: "台北大巨蛋 ｜ 未滿 3 日 + 150 元 ｜ 連續 3 日 + 0 元" }
];
const locationFeeWaiverMinDays = 3;
const locationPlaceholderOption = { label: "請選擇地點", fee: 0, feeLabel: "+ 0 元" };

const itemMap = new Map(rentalItems.map((item) => [item.id, item]));
const addOnItemIds = new Set(rentalItems.filter((item) => item.canCoexist).map((item) => item.id));
const weekdayFormatter = new Intl.DateTimeFormat("zh-TW", { weekday: "short" });
const monthFormatter = new Intl.DateTimeFormat("zh-TW", { year: "numeric", month: "long" });
const config = window.PHONE_RENTAL_CONFIG || {};
const placeholderEndpoint = "PASTE_YOUR_GOOGLE_APPS_SCRIPT_WEB_APP_URL_HERE";
const bookingTitleHtml = '預約表單 ｜ <span class="booking-title-note">聯絡並交付訂金後才會鎖定檔期</span>';
const availabilityFetchTimeoutMs = 12000;

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
const estimateBox = document.querySelector("#estimateBox");
const selectedDatesReview = document.querySelector("#selectedDatesReview");
const pickupLocationSelect = document.querySelector("#pickupLocation");
const dropoffLocationSelect = document.querySelector("#dropoffLocation");
const depositOptions = document.querySelector("#depositOptions");
const depositNotice = document.querySelector("#depositNotice");
const bookedDialog = document.querySelector("#bookedDialog");
const bookedDialogTitle = document.querySelector("#bookedDialogTitle");
const bookedDialogBody = document.querySelector("#bookedDialogBody");
const bookedDialogClose = document.querySelector("#bookedDialogClose");
const successDialog = document.querySelector("#successDialog");
const successDialogBody = document.querySelector("#successDialogBody");
const successDialogConfirm = document.querySelector("#successDialogConfirm");
const availabilityStatus = document.querySelector("#availabilityStatus");
const formStatus = document.querySelector("#formStatus");
const submitButton = document.querySelector("#submitButton");

const today = startOfDay(new Date());
const localBookedDatesByItem = {};
let visibleMonth = new Date(today.getFullYear(), today.getMonth(), 1);
let selectedDates = new Set();
let selectedPackageId = "";
let selectedAddOnPackageIds = new Set();
let unavailableDates = new Set(config.unavailableDates || []);
let unavailableItemsByDate = {};
let pendingReservationsByDate = {};
let latestAvailabilityKey = "";
let availabilityReadyKey = "";
let availabilitySyncingKey = "";
let availabilityRequestId = 0;
let availabilityAbortController = null;

init();

function init() {
  renderItemOptions();
  renderLocationOptions();
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
  itemStepPill.addEventListener("click", showItemStep);
  dateStepPill.addEventListener("click", showDateStep);
  detailsStepPill.addEventListener("click", showDetailsStep);
  prevMonthButton.addEventListener("click", () => changeMonth(-1));
  nextMonthButton.addEventListener("click", () => changeMonth(1));
  continueButton.addEventListener("click", showDetailsStep);
  bookedDialogClose.addEventListener("click", () => bookedDialog.close());
  bookedDialog.addEventListener("click", (event) => {
    if (event.target === bookedDialog) {
      bookedDialog.close();
    }
  });
  successDialogConfirm.addEventListener("click", () => {
    successDialog.close();
    resetReservationFlow();
  });
  successDialog.addEventListener("cancel", (event) => {
    event.preventDefault();
  });
  form.elements.phone.addEventListener("input", () => {
    form.elements.phone.setCustomValidity("");
  });
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
      <span class="item-type-cell">
        <span class="option-type-pill${packageInfo.isAddOnOffer ? " is-offer" : ""}">${packageInfo.typeLabel}</span>
      </span>
      ${renderPackageMedia(packageInfo, "item-photo")}
      <span class="item-head">
        <span class="item-title">${renderOptionTitle(packageInfo)}</span>
      </span>
      <span class="item-details">
        ${renderFeeLines(packageInfo)}
      </span>
    </label>
  `).join("");
}

function getPackageOptions() {
  return [
    getComboPackageInfo(),
    ...rentalItems.map((item) => getSinglePackageInfo(item.id, {
      asAddOnOffer: shouldUseAddOnOffer(item.id)
    }))
  ].filter(Boolean);
}

function getSinglePackageInfo(itemId, options = {}) {
  const item = itemMap.get(itemId);

  if (!item) {
    return null;
  }

  const asAddOnOffer = Boolean(options.asAddOnOffer && item.canCoexist && item.addOnDaily);
  const typeLabel = asAddOnOffer ? "優惠" : "單租";
  const daily = asAddOnOffer ? item.addOnDaily : item.daily;
  const discountedDaily = asAddOnOffer ? item.addOnDaily : item.discountedDaily;

  return {
    id: `single-${item.id}`,
    typeLabel,
    canCoexist: Boolean(item.canCoexist),
    isAddOnOffer: asAddOnOffer,
    selectedItemIds: [item.id],
    components: [item],
    image: item.image,
    imageLabel: item.imageLabel,
    displayName: `[${typeLabel}] ${formatItemNameWithSpec(item)}`,
    specSummary: item.spec,
    daily,
    discountedDaily,
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
  return renderTitleComponents(packageInfo);
}

function renderTitleComponents(packageInfo) {
  return `
    ${packageInfo.components.map((item, index) => `
      ${index > 0 ? '<span class="plus-sign">+</span>' : ""}
      <span class="title-pair">
        <strong>${item.name}</strong>
        ${packageInfo.hideSpecsInTitle || !item.spec ? "" : `<span class="spec-badge">${item.spec}</span>`}
      </span>
    `).join("")}
  `;
}

function formatItemNameWithSpec(item) {
  return `${item.name}${item.spec ? ` ${item.spec}` : ""}`;
}

function renderPackageMedia(packageInfo, className) {
  if (packageInfo.image) {
    return `<img class="${className}" src="${packageInfo.image}" alt="${packageInfo.displayName}" />`;
  }

  return `
    <span class="${className} item-photo-placeholder" aria-hidden="true">
      <span>${packageInfo.imageLabel || packageInfo.components[0]?.name || "租借品項"}</span>
    </span>
  `;
}

function renderFeeLines(packageInfo) {
  if (packageInfo.isAddOnOffer) {
    return `
      <span class="item-meta fee-line offer-fee">加租優惠：${packageInfo.daily} 元 / 日</span>
      <span class="item-meta fee-line deposit-start">證件押金：${packageInfo.depositWithId} 元 + 證件正本</span>
      <span class="item-meta fee-line">免證押金：${packageInfo.depositNoId} 元</span>
    `;
  }

  return `
    <span class="item-meta fee-line">單日租金：${packageInfo.daily} 元 / 日</span>
    <span class="item-meta fee-line">連租三天：${packageInfo.discountedDaily} 元 / 日</span>
    <span class="item-meta fee-line deposit-start">證件押金：${packageInfo.depositWithId} 元 + 證件正本</span>
    <span class="item-meta fee-line">免證押金：${packageInfo.depositNoId} 元</span>
  `;
}

function renderLocationOptions() {
  const selectedPickup = pickupLocationSelect.value;
  const selectedDropoff = dropoffLocationSelect.value;
  const dates = getSelectedDateList();

  pickupLocationSelect.innerHTML = renderLocationOptionList(pickupLocationOptions, dates);
  dropoffLocationSelect.innerHTML = renderLocationOptionList(dropoffLocationOptions, dates);
  pickupLocationSelect.value = selectedPickup;
  dropoffLocationSelect.value = selectedDropoff;
}

function renderLocationOptionList(options, dates) {
  const placeholder = '<option value="" disabled>請選擇地點</option>';
  const optionItems = options.map((option) => {
    const effectiveOption = getEffectiveLocationOption(option, dates);
    const label = option.optionLabel || `${option.label} ｜ ${effectiveOption.feeLabel}`;

    return `
    <option value="${option.label}">${label}</option>
  `;
  }).join("");

  return `${placeholder}${optionItems}`;
}

function getEffectiveLocationOption(option, dates) {
  const isWaived = dates.length >= locationFeeWaiverMinDays && option.fee > 0;

  return {
    ...option,
    fee: isWaived ? 0 : option.fee,
    feeLabel: isWaived ? "+ 0 元" : option.feeLabel
  };
}

function renderSelectionSummary(packageInfo) {
  const packages = packageInfo.packages || [packageInfo];
  const headings = packages.map(renderSummaryHeading).join("");
  const detailItems = getSummaryDetailItems(packages);
  const details = detailItems.map((item, index) => `
    <span>${index + 1}. ${item.name}${renderSummaryDetailSpec(item)}</span>
  `).join("");

  return `
    <div class="summary-headings">${headings}</div>
    <div class="summary-details">${details}</div>
  `;
}

function renderSummaryDetailSpec(item) {
  if (!item.spec) {
    return "";
  }

  return ` <span class="spec-badge summary-detail-spec">${item.spec}</span>`;
}

function renderSummaryHeading(packageInfo) {
  const componentNames = packageInfo.components.map((item, index) => `
    ${index > 0 ? '<span class="plus-sign">+</span>' : ""}
    <span>${item.name}</span>
  `).join("");

  return `
    <strong class="summary-heading">
      <span>[${packageInfo.typeLabel}]</span>
      ${componentNames}
    </strong>
  `;
}

function getSummaryDetailItems(packages) {
  const details = [];

  packages.forEach((packageInfo) => {
    if (packageInfo.id === comboPackage.id) {
      details.push(
        { name: "vivo X300 Ultra", spec: "12/256GB" },
        { name: "G2 Ultra 增距鏡", spec: "400mm" },
        { name: "專用攝影手機殼" },
        { name: "迷你手機支架1.3M(收縮後僅14CM)" }
      );
      return;
    }

    packageInfo.components.forEach((item) => {
      details.push({ name: item.name, spec: item.spec });
    });
  });

  return details;
}

function renderDateEstimate(packageInfo, dates) {
  if (!dates.length) {
    return `
      ${renderTotalHeading(0, [], false, "estimate-heading")}
      <div class="estimate-details">
        <span>請選擇租借日期</span>
      </div>
    `;
  }

  const breakdown = getRentalBreakdown(packageInfo, dates);

  return `
    ${renderTotalHeading(breakdown.total, dates, breakdown.hasDiscount, "estimate-heading")}
    <div class="estimate-details">
      ${breakdown.lines.map((line) => `
        <div class="estimate-package">
          <strong>${line.title}</strong>
          <span>${formatAmount(line.dailyRate)} 元 / 日 ｜ 共 ${formatAmount(line.total)} 元</span>
        </div>
      `).join("")}
    </div>
  `;
}

function getRentalBreakdown(packageInfo, dates, options = {}) {
  const packages = packageInfo.packages || [packageInfo];
  const lines = packages.map((selectedPackage) => {
    const dailyRate = getDailyRate(dates, selectedPackage);

    return {
      title: formatPackageHeading(selectedPackage),
      dailyRate,
      total: dailyRate * dates.length,
      hasDiscount: hasRentalDiscount(dates, selectedPackage)
    };
  });
  const locationFee = options.includeLocationFees ? getTotalLocationFee(dates) : 0;

  return {
    lines,
    itemTotal: lines.reduce((total, line) => total + line.total, 0),
    locationFee,
    total: lines.reduce((total, line) => total + line.total, 0) + locationFee,
    hasDiscount: lines.some((line) => line.hasDiscount)
  };
}

function renderTotalHeading(total, dates, hasDiscount, className) {
  const days = dates.length;
  const periodText = days ? ` <span class="summary-separator">｜</span> ${formatCompactRentalPeriod(dates)}` : "";
  const discountText = hasDiscount
    ? ' <span class="summary-separator">｜</span> <span class="discount-label">已套用連租優惠</span>'
    : "";

  return `
    <div class="${className}">
      <strong class="summary-total">總租金 ${formatAmount(total)} 元</strong>
      <span class="summary-days">已選 ${days} 日${periodText}${discountText}</span>
    </div>
  `;
}

function formatPackageHeading(packageInfo) {
  return `[${packageInfo.typeLabel}] ${packageInfo.components.map((item) => item.name).join(" + ")}`;
}

function formatAmount(value) {
  return String(value);
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function renderDetailsReview(packageInfo, dates) {
  const packages = packageInfo.packages || [packageInfo];
  const breakdown = getRentalBreakdown(packageInfo, dates, { includeLocationFees: true });
  const detailItems = getSummaryDetailItems(packages);
  const locations = getSelectedLocations(dates);

  return `
    ${renderTotalHeading(breakdown.total, dates, breakdown.hasDiscount, "review-heading")}
    <div class="review-schedule">
      <span>取機時間：${formatPickupDateTime(dates)}</span>
      <span>取機地點：${locations.pickup.label} ｜ ${locations.pickup.feeLabel}</span>
      <span>還機時間：${formatReturnDateTime(dates)}</span>
      <span>還機地點：${locations.dropoff.label} ｜ ${locations.dropoff.feeLabel}</span>
    </div>
    <div class="review-packages">
      ${breakdown.lines.map((line) => `
        <div class="review-package">
          <strong>${line.title}</strong>
          <span>${formatAmount(line.dailyRate)} 元 / 日 <strong class="inline-divider">｜</strong> 共 ${formatAmount(line.total)} 元</span>
        </div>
      `).join("")}
    </div>
    <div class="review-details">
      ${detailItems.map((item, index) => `
        <span>${index + 1}. ${item.name}${renderSummaryDetailSpec(item)}</span>
      `).join("")}
    </div>
  `;
}

function formatRentalPeriod(dates) {
  const start = formatShortDate(dates[0]);
  const end = formatShortDate(dates[dates.length - 1]);

  return start === end ? start : `${start} - ${end}`;
}

function formatCompactRentalPeriod(dates) {
  const start = formatShortDate(dates[0]);
  const end = formatShortDate(dates[dates.length - 1]);

  return start === end ? start : `${start}-${end}`;
}

function formatPickupDateTime(dates) {
  return `${formatShortDate(dates[0])} 中午12點後`;
}

function formatReturnDateTime(dates) {
  return `${formatShortDate(getReturnDateValue(dates[dates.length - 1]))} 中午12點前`;
}

function getReturnDateValue(lastRentalDate) {
  const returnDate = parseDate(lastRentalDate);
  returnDate.setDate(returnDate.getDate() + 1);

  return toDateInputValue(returnDate);
}

function formatShortDate(value) {
  const date = parseDate(value);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${month}/${day}`;
}

function getSelectedLocations(dates = getSelectedDateList()) {
  return {
    pickup: getEffectiveLocationOption(getLocationOption(pickupLocationOptions, pickupLocationSelect.value), dates),
    dropoff: getEffectiveLocationOption(getLocationOption(dropoffLocationOptions, dropoffLocationSelect.value), dates)
  };
}

function getLocationOption(options, value) {
  return options.find((option) => option.label === value) || locationPlaceholderOption;
}

function getTotalLocationFee(dates = getSelectedDateList()) {
  const locations = getSelectedLocations(dates);
  return locations.pickup.fee + locations.dropoff.fee;
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

  if (isAddOnPackageId(clickedPackageId)) {
    if (isChecking) {
      selectedAddOnPackageIds.add(clickedPackageId);
    } else {
      selectedAddOnPackageIds.delete(clickedPackageId);
    }
  } else if (!isChecking && previousPackageId === clickedPackageId) {
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
  clearAvailabilityState();
  clearStatus();
  updateItemSelection();
  renderDepositOptions();
  renderCalendar();
  updateSelectionSummary();
}

function updateItemSelection() {
  renderItemOptions();

  const selectedItemIds = getSelectedItemIds();
  const packageInfo = getPackageInfo();
  const selectedPackageIds = getSelectedPackageIds();

  syncPackageInputs();

  document.querySelectorAll(".item-card").forEach((card) => {
    card.classList.toggle("is-selected", selectedPackageIds.has(card.dataset.packageId));
  });

  form.elements.selectedItems.value = selectedItemIds.join(",");
  form.elements.model.value = packageInfo?.id || "";
  form.elements.rentalPackage.value = packageInfo?.displayName || "";
  itemContinueButton.disabled = selectedItemIds.length === 0;

  if (!packageInfo) {
    itemSummaryBox.hidden = true;
    itemSummaryBox.innerHTML = "";
    packageSummary.innerHTML = "";
    availabilityStatus.textContent = "請先選擇物品。";
    updateStepNavigation();
    return;
  }

  itemSummaryBox.hidden = false;
  itemSummaryBox.innerHTML = renderSelectionSummary(packageInfo);

  packageSummary.innerHTML = renderSelectionSummary(packageInfo);
  updateStepNavigation();
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
  const hasPackage = Boolean(packageInfo);
  const isAvailabilityReady = isAvailabilityReadyForPackage(packageInfo);
  const isAvailabilitySyncing = isAvailabilitySyncingForPackage(packageInfo);
  const canSelectDates = hasPackage && isAvailabilityReady && !isAvailabilitySyncing;

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
    const isPending = canSelectDates && !isFull && hasPendingReservations(dateString);
    const isSelected = selectedDates.has(dateString);
    const status = !hasPackage
      ? "先選"
      : !isAvailabilityReady || isAvailabilitySyncing
        ? "同步中"
        : isPast
          ? "已過"
          : isFull
            ? "已滿"
            : isPending
              ? "待定"
            : "可選";
    const statusClass = !hasPackage
      ? "status-past"
      : !isAvailabilityReady || isAvailabilitySyncing
        ? "status-syncing"
        : isPast
          ? "status-past"
          : isFull
            ? "status-full"
            : isPending
              ? "status-pending"
            : "status-available";
    const classes = ["calendar-day"];

    if (isWeekend) classes.push("is-weekend");
    if (isPast || !hasPackage) classes.push("is-past");
    if (hasPackage && (!isAvailabilityReady || isAvailabilitySyncing)) classes.push("is-syncing");
    if (isFull) classes.push("is-full");
    if (isPending) classes.push("is-pending");
    if (isSelected) classes.push("is-selected");

    cells.push(`
      <button
        class="${classes.join(" ")}"
        type="button"
        data-date="${dateString}"
        data-full="${isFull ? "true" : "false"}"
        data-pending="${isPending ? "true" : "false"}"
        ${!canSelectDates || isPast ? "disabled" : ""}
        aria-pressed="${isSelected ? "true" : "false"}"
        aria-label="${dateString} ${status}${isSelected ? "，已選" : ""}${isFull ? "，點擊查看已租物品" : ""}${isPending ? "，點擊查看排隊順位" : ""}"
      >
        <span class="date-number">${day}</span>
        <span class="date-status ${statusClass}">${status}</span>
      </button>
    `);
  }

  calendarGrid.innerHTML = cells.join("");
  calendarGrid.querySelectorAll(".calendar-day:not(:disabled)").forEach((button) => {
    button.addEventListener("click", () => handleCalendarDayClick(button));
  });
}

function handleCalendarDayClick(button) {
  const packageInfo = getPackageInfo();

  if (!isAvailabilityReadyForPackage(packageInfo)) {
    showStatus("warning", "正在同步可租狀態，請稍候再選日期。");
    return;
  }

  if (button.dataset.full === "true") {
    showBookedDateDialog(button.dataset.date);
    return;
  }

  if (button.dataset.pending === "true") {
    showPendingDateDialog(button.dataset.date);
  }

  toggleDate(button.dataset.date);
}

function showBookedDateDialog(dateString) {
  const dateLabel = formatDateLabel(dateString);
  const labels = getUnavailableItemLabels(dateString);

  if (!bookedDialog.showModal) {
    window.alert(`${dateLabel} 已滿\n已被租走：\n${labels.join("\n")}`);
    return;
  }

  bookedDialogTitle.textContent = `${dateLabel} 已滿`;
  bookedDialogBody.innerHTML = `
    <p>已被租走：</p>
    <ul>
      ${labels.map((label) => `<li>${escapeHtml(label)}</li>`).join("")}
    </ul>
  `;
  bookedDialog.showModal();
}

function showPendingDateDialog(dateString) {
  const dateLabel = formatDateLabel(dateString);
  const reservations = getPendingReservations(dateString);
  const rank = reservations.length + 1;
  const lines = reservations.map((reservation, index) => `
    <p>${index + 1}.${escapeHtml(reservation.createdAtLabel || "稍早")} 有人已先預約 目前待確認</p>
  `).join("");

  if (!bookedDialog.showModal) {
    window.alert(`目前您是第${rank}順位 可先排隊預約\n${reservations.map((reservation, index) => `${index + 1}.${reservation.createdAtLabel || "稍早"} 有人已先預約 目前待確認`).join("\n")}\n若未即時聯絡並於12小時內繳交訂金\n檔期將自動釋出給下一順位的客人`);
    return;
  }

  bookedDialogTitle.textContent = `${dateLabel} 待定`;
  bookedDialogBody.innerHTML = `
    <p><strong>目前您是第${rank}順位 可先排隊預約</strong></p>
    <div class="pending-list">
      ${lines || "<p>目前尚無待確認預約。</p>"}
    </div>
    <p>若未即時聯絡並於12小時內繳交訂金<br />檔期將自動釋出給下一順位的客人</p>
  `;
  bookedDialog.showModal();
}

function getUnavailableItemLabels(dateString) {
  const labels = unavailableItemsByDate[dateString] || [];

  if (labels.length) {
    return labels;
  }

  return ["店家已設定此日期不可租"];
}

function hasPendingReservations(dateString) {
  return getPendingReservations(dateString).length > 0;
}

function getPendingReservations(dateString) {
  return pendingReservationsByDate[dateString] || [];
}

function toggleDate(dateString) {
  const nextDates = new Set(selectedDates);

  if (nextDates.has(dateString)) {
    nextDates.delete(dateString);
  } else {
    nextDates.add(dateString);
  }

  const nextDateList = [...nextDates].sort();

  if (nextDateList.length > 1 && !areConsecutiveDates(nextDateList)) {
    showStatus("error", "租借日期需要連續，不能跳日選擇。");
    return;
  }

  selectedDates = nextDates;
  clearStatus();
  renderCalendar();
  updateSelectionSummary();
}

function updateSelectionSummary() {
  const packageInfo = getPackageInfo();
  const dates = getSelectedDateList();
  const days = dates.length;

  updateItemSelection();
  renderLocationOptions();
  form.elements.selectedDates.value = dates.join(",");
  form.elements.rentalStart.value = dates[0] || "";
  form.elements.rentalEnd.value = dates[dates.length - 1] || "";
  continueButton.disabled = !packageInfo || days === 0 || !isAvailabilityReadyForPackage(packageInfo);
  updateStepNavigation();

  if (!packageInfo) {
    estimateBox.textContent = "請先選擇要租的物品。";
    selectedDatesReview.textContent = "";
    renderDepositNotice();
    return;
  }

  if (!days) {
    estimateBox.innerHTML = renderDateEstimate(packageInfo, dates);
    selectedDatesReview.textContent = "";
    renderDepositNotice();
    return;
  }

  estimateBox.innerHTML = renderDateEstimate(packageInfo, dates);
  selectedDatesReview.innerHTML = renderDetailsReview(packageInfo, dates);
  renderDepositNotice();
}

function showItemStep() {
  itemStep.hidden = false;
  dateStep.hidden = true;
  detailsStep.hidden = true;
  setActiveStep("item");
  clearStatus();
  updateItemSelection();
  updateSelectionSummary();
  scrollToPageTop();
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
  scrollToPageTop();
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

  if (!isAvailabilityReadyForPackage(packageInfo)) {
    showDateStep();
    showStatus("warning", "請等待可租狀態同步完成後再填寫資料。");
    return;
  }

  itemStep.hidden = true;
  dateStep.hidden = true;
  detailsStep.hidden = false;
  setActiveStep("details");
  clearStatus();
  renderDepositOptions();
  updateSelectionSummary();
  scrollToPageTop();
}

function scrollToPageTop() {
  requestAnimationFrame(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
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

  if (!isAvailabilityReadyForPackage(packageInfo)) {
    showDateStep();
    showStatus("warning", "請等待可租狀態同步完成後再送出預約。");
    return;
  }

  const conflictedDates = dates.filter((date) => unavailableDates.has(date));

  if (conflictedDates.length) {
    showDateStep();
    showStatus("error", `${conflictedDates.map(formatDateLabel).join("、")} 已滿，請重新選擇日期。`);
    return;
  }

  const phone = form.elements.phone.value.trim();
  form.elements.phone.value = phone;
  form.elements.phone.setCustomValidity(
    isValidTaiwanMobile(phone) ? "" : "電話需為 09 開頭加 8 個數字，例如 0912345678。"
  );

  if (!form.reportValidity()) {
    return;
  }

  const payload = new FormData(form);
  const reservationId = createReservationId(phone);
  const breakdown = getRentalBreakdown(packageInfo, dates, { includeLocationFees: true });
  const dailyRate = breakdown.lines.reduce((total, line) => total + line.dailyRate, 0);
  const locations = getSelectedLocations(dates);
  const locationFee = getTotalLocationFee(dates);
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
  payload.set("rentalTotal", String(breakdown.total));
  payload.set("selectedDates", dates.join(","));
  payload.set("rentalStart", dates[0]);
  payload.set("rentalEnd", dates[dates.length - 1]);
  payload.set("pickupLocation", locations.pickup.label);
  payload.set("pickupFee", String(locations.pickup.fee));
  payload.set("pickupFeeLabel", locations.pickup.feeLabel);
  payload.set("dropoffLocation", locations.dropoff.label);
  payload.set("dropoffFee", String(locations.dropoff.fee));
  payload.set("dropoffFeeLabel", locations.dropoff.feeLabel);
  payload.set("locationFee", String(locationFee));
  payload.set("threadAccount", payload.get("lineId") || "");
  payload.set("createdAt", new Date().toISOString());
  payload.set("pageUrl", window.location.href);

  if (payload.get("companyWebsite")) {
    completeReservation(reservationId);
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
      completeReservation(reservationId);
    }
  } catch (error) {
    showStatus("error", "送出時遇到問題，請稍後再試，或直接用 thread 聯絡店家。");
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = "送出預約";
  }
}

function completeReservation(reservationId) {
  showSuccessDialog(reservationId);
}

function showSuccessDialog(reservationId) {
  successDialogBody.innerHTML = `
    <p><strong>預約已送出，預約編號 ${escapeHtml(reservationId)}。</strong></p>
    <p>請至 thread 聯繫 <a class="thread-inline-link" href="https://www.threads.com/@gem0816phone" target="_blank" rel="noopener"><strong>@gem0816phone</strong></a></p>
    <p>私訊告知『已填寫預約表單』</p>
    <p>聯絡並交付訂金後才會鎖定檔期</p>
  `;

  if (typeof successDialog.showModal === "function") {
    successDialog.showModal();
    return;
  }

  alert(`預約已送出，預約編號 ${reservationId}。\n請至 thread 聯繫 @gem0816phone\n私訊告知『已填寫預約表單』\n聯絡並交付訂金後才會鎖定檔期`);
  resetReservationFlow();
}

function resetReservationFlow() {
  form.reset();
  selectedDates = new Set();
  selectedPackageId = "";
  selectedAddOnPackageIds = new Set();
  clearAvailabilityState();
  renderDepositOptions();
  showItemStep();
  renderCalendar();
  updateSelectionSummary();
}

function loadAvailability() {
  const packageInfo = getPackageInfo();
  const requestId = availabilityRequestId + 1;
  availabilityRequestId = requestId;

  if (availabilityAbortController) {
    availabilityAbortController.abort();
    availabilityAbortController = null;
  }

  if (!packageInfo) {
    latestAvailabilityKey = "";
    availabilityReadyKey = "";
    availabilitySyncingKey = "";
    unavailableDates = new Set(config.unavailableDates || []);
    unavailableItemsByDate = {};
    pendingReservationsByDate = {};
    availabilityStatus.textContent = "請先選擇物品。";
    renderCalendar();
    return;
  }

  const requestKey = packageInfo.selectedItemIds.join("|");
  latestAvailabilityKey = requestKey;
  availabilityReadyKey = "";
  availabilitySyncingKey = requestKey;
  unavailableDates = getLocalUnavailableDates(packageInfo.selectedItemIds);
  unavailableItemsByDate = getLocalUnavailableItemsByDate(packageInfo.selectedItemIds);
  pendingReservationsByDate = {};
  availabilityStatus.textContent = "正在同步可選日期...";
  renderCalendar();
  updateSelectionSummary();

  const endpoint = getAppsScriptUrl();

  if (!endpoint) {
    availabilityReadyKey = requestKey;
    availabilitySyncingKey = "";
    availabilityStatus.textContent = "目前是測試模式，日曆只會使用前端設定的已滿日期。";
    renderCalendar();
    updateSelectionSummary();
    return;
  }

  const requestUrl = new URL(endpoint);
  requestUrl.searchParams.set("action", "availability");
  requestUrl.searchParams.set("selectedItems", packageInfo.selectedItemIds.join(","));
  requestUrl.searchParams.set("cachebust", String(Date.now()));

  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => {
    controller.abort();
  }, availabilityFetchTimeoutMs);
  availabilityAbortController = controller;

  fetch(requestUrl.toString(), {
    method: "GET",
    cache: "no-store",
    signal: controller.signal
  })
    .then((response) => {
      if (!response.ok) {
        throw new Error("Availability request failed");
      }

      return response.json();
    })
    .then((payload) => {
      if (requestId !== availabilityRequestId || requestKey !== latestAvailabilityKey) {
        return;
      }

      if (!payload || !payload.ok || !Array.isArray(payload.unavailableDates)) {
        throw new Error("Invalid availability response");
      }

      unavailableDates = new Set([
        ...getLocalUnavailableDates(packageInfo.selectedItemIds),
        ...payload.unavailableDates
      ]);
      unavailableItemsByDate = mergeUnavailableItemMaps(
        getLocalUnavailableItemsByDate(packageInfo.selectedItemIds),
        payload.unavailableItemsByDate || {}
      );
      pendingReservationsByDate = payload.pendingReservationsByDate || {};
      availabilitySyncingKey = "";
      availabilityReadyKey = requestKey;
      availabilityStatus.textContent = `同步更新時間 ${formatTime(new Date())}`;
      renderCalendar();
      updateSelectionSummary();
    })
    .catch((error) => {
      if (requestId === availabilityRequestId && requestKey === latestAvailabilityKey) {
        availabilitySyncingKey = "";
        availabilityReadyKey = "";
        selectedDates = new Set();
        availabilityStatus.textContent = error.name === "AbortError"
          ? "同步逾時，請點 2 選日期重新同步。"
          : "目前無法同步可租狀態，請稍後再試。";
        renderCalendar();
        updateSelectionSummary();
      }
    })
    .finally(() => {
      window.clearTimeout(timeoutId);

      if (requestId === availabilityRequestId) {
        availabilityAbortController = null;
      }
    });
}

function clearAvailabilityState() {
  availabilityRequestId += 1;

  if (availabilityAbortController) {
    availabilityAbortController.abort();
    availabilityAbortController = null;
  }

  latestAvailabilityKey = "";
  availabilityReadyKey = "";
  availabilitySyncingKey = "";
  unavailableDates = new Set(config.unavailableDates || []);
  unavailableItemsByDate = {};
  pendingReservationsByDate = {};
}

function renderDepositOptions() {
  const packageInfo = getPackageInfo();

  if (!packageInfo) {
    depositOptions.innerHTML = `
      <legend>押金方式</legend>
      <p class="deposit-hint">請先選擇租借物品。</p>
    `;
    renderDepositNotice();
    return;
  }

  const withIdLabel = getDepositWithIdLabel(packageInfo);
  const noIdLabel = getDepositNoIdLabel(packageInfo);

  depositOptions.innerHTML = `
    <legend>押金方式</legend>
    <div class="deposit-choice-row">
      <label>
        <input type="radio" name="depositOption" value="${withIdLabel}" required />
        <span>${withIdLabel}</span>
      </label>
      <label>
        <input type="radio" name="depositOption" value="${noIdLabel}" required />
        <span>${noIdLabel}</span>
      </label>
    </div>
  `;
  renderDepositNotice();
}

function renderDepositNotice() {
  const packageInfo = getPackageInfo();
  const selectedDeposit = form.elements.depositOption?.value || "";

  if (!packageInfo || !selectedDeposit) {
    depositNotice.hidden = true;
    depositNotice.innerHTML = "";
    return;
  }

  const isNoIdDeposit = selectedDeposit === getDepositNoIdLabel(packageInfo);
  const reservationDepositLine = isNoIdDeposit
    ? "需先支付訂金 1000 元 才可保留預定"
    : "需先支付訂金 500 元 + 手持證件自拍(可上浮水印) 才可保留預定";

  depositNotice.hidden = false;
  depositNotice.innerHTML = `
    <p>送出預約後請至 thread 聯繫 <a href="https://www.threads.com/@gem0816phone" target="_blank" rel="noopener">@gem0816phone</a></p>
    <p>${reservationDepositLine}</p>
    <p>訂金支付後若取消預約將保留至下次租借使用</p>
    <p>剩餘款項及押金將於面交時付清</p>
  `;
}

function setActiveStep(step) {
  itemStepPill.classList.toggle("is-active", step === "item");
  dateStepPill.classList.toggle("is-active", step === "date");
  detailsStepPill.classList.toggle("is-active", step === "details");
  setStepCurrent(itemStepPill, step === "item");
  setStepCurrent(dateStepPill, step === "date");
  setStepCurrent(detailsStepPill, step === "details");

  bookingTitle.innerHTML = bookingTitleHtml;

  updateStepNavigation();
}

function setStepCurrent(stepButton, isCurrent) {
  if (isCurrent) {
    stepButton.setAttribute("aria-current", "step");
    return;
  }

  stepButton.removeAttribute("aria-current");
}

function updateStepNavigation() {
  const packageInfo = getPackageInfo();
  const hasPackage = Boolean(packageInfo);
  const hasDates = selectedDates.size > 0;
  const availabilityReady = isAvailabilityReadyForPackage(packageInfo);

  itemStepPill.disabled = false;
  dateStepPill.disabled = !hasPackage;
  detailsStepPill.disabled = !hasPackage || !hasDates || !availabilityReady;
}

function getAvailabilityKey(packageInfo) {
  return packageInfo?.selectedItemIds.join("|") || "";
}

function isAvailabilityReadyForPackage(packageInfo) {
  const key = getAvailabilityKey(packageInfo);
  return Boolean(key && availabilityReadyKey === key);
}

function isAvailabilitySyncingForPackage(packageInfo) {
  const key = getAvailabilityKey(packageInfo);
  return Boolean(key && availabilitySyncingKey === key);
}

function getSelectedItemIds() {
  return getPackageInfo()?.selectedItemIds.slice() || [];
}

function getSelectedPackageIds() {
  return new Set([
    ...(selectedPackageId ? [selectedPackageId] : []),
    ...selectedAddOnPackageIds
  ]);
}

function getSelectedPackages() {
  return [...getSelectedPackageIds()]
    .map((packageId) => getPackageInfoById(packageId, {
      asAddOnOffer: shouldUseSelectedAddOnOffer(packageId)
    }))
    .filter(Boolean);
}

function getPackageInfo(packageId = "") {
  if (packageId) {
    return getPackageInfoById(packageId);
  }

  const packages = getSelectedPackages();

  if (packages.length === 0) {
    return null;
  }

  if (packages.length === 1) {
    return packages[0];
  }

  return combinePackageInfo(packages);
}

function getPackageInfoById(packageId, options = {}) {
  if (!packageId) {
    return null;
  }

  if (packageId === comboPackage.id) {
    return getComboPackageInfo();
  }

  if (packageId.startsWith("single-")) {
    return getSinglePackageInfo(packageId.replace("single-", ""), options);
  }

  return null;
}

function combinePackageInfo(packages) {
  const selectedItemIds = [...new Set(packages.flatMap((packageInfo) => packageInfo.selectedItemIds))];
  const components = selectedItemIds.map((itemId) => itemMap.get(itemId)).filter(Boolean);
  const discountMinDays = packages
    .filter((packageInfo) => !packageInfo.isAddOnOffer)
    .map((packageInfo) => packageInfo.discountMinDays);

  return {
    id: packages.map((packageInfo) => packageInfo.id).join("__"),
    typeLabel: "多選",
    selectedItemIds,
    components,
    packages,
    displayName: packages.map((packageInfo) => packageInfo.displayName).join(" + "),
    specSummary: components.map((item) => item.spec).join(" + "),
    daily: sumPackageField(packages, "daily"),
    discountedDaily: sumPackageField(packages, "discountedDaily"),
    discountMinDays: Math.max(...(discountMinDays.length ? discountMinDays : packages.map((packageInfo) => packageInfo.discountMinDays))),
    depositWithId: sumPackageField(packages, "depositWithId"),
    depositNoId: sumPackageField(packages, "depositNoId")
  };
}

function sumPackageField(packages, fieldName) {
  return packages.reduce((total, packageInfo) => total + packageInfo[fieldName], 0);
}

function isAddOnPackageId(packageId) {
  return packageId.startsWith("single-") && addOnItemIds.has(packageId.replace("single-", ""));
}

function shouldUseAddOnOffer(itemId) {
  return addOnItemIds.has(itemId) && Boolean(selectedPackageId);
}

function shouldUseSelectedAddOnOffer(packageId) {
  return isAddOnPackageId(packageId) && Boolean(selectedPackageId);
}

function syncPackageInputs() {
  form.querySelectorAll('input[name="packageId"]').forEach((input) => {
    input.checked = input.value === selectedPackageId || selectedAddOnPackageIds.has(input.value);
  });
}

function renderPackageSummary(packageInfo) {
  const summaryPackages = packageInfo.packages || [packageInfo];
  const images = summaryPackages
    .map((selectedPackage) => renderPackageMedia(selectedPackage, "summary-photo"))
    .join("");
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
        <span class="option-type-pill summary-type${packageInfo.isAddOnOffer ? " is-offer" : ""}">${packageInfo.typeLabel}</span>
        ${componentNames}
      </div>
      <div class="summary-fees">
        ${renderFeeLines(packageInfo)}
      </div>
    </div>
  `;
}

function getLocalUnavailableDates(itemIds) {
  const dates = new Set(config.unavailableDates || []);

  (itemIds || []).forEach((itemId) => {
    const localDates = localBookedDatesByItem[itemId];

    if (localDates) {
      localDates.forEach((date) => dates.add(date));
    }
  });

  return dates;
}

function getLocalUnavailableItemsByDate(itemIds) {
  const targetItemIds = new Set(itemIds || []);
  const itemsByDate = {};

  Object.entries(localBookedDatesByItem).forEach(([itemId, dates]) => {
    if (!targetItemIds.has(itemId)) {
      return;
    }

    dates.forEach((date) => {
      if (!itemsByDate[date]) {
        itemsByDate[date] = [];
      }

      itemsByDate[date].push(getItemLabel(itemId));
    });
  });

  return itemsByDate;
}

function mergeUnavailableItemMaps(...maps) {
  const merged = {};

  maps.forEach((map) => {
    Object.entries(map || {}).forEach(([date, labels]) => {
      const nextLabels = Array.isArray(labels) ? labels : [labels];

      if (!merged[date]) {
        merged[date] = [];
      }

      nextLabels.forEach((label) => {
        if (label && !merged[date].includes(label)) {
          merged[date].push(label);
        }
      });
    });
  });

  return merged;
}

function getItemLabel(itemId) {
  const item = itemMap.get(itemId);

  if (!item) {
    return "已預約品項";
  }

  return `${item.name}${item.spec ? ` ${item.spec}` : ""}`;
}

function getSelectedDateList() {
  return [...selectedDates].sort();
}

function getDailyRate(dates, packageInfo) {
  if (packageInfo.isAddOnOffer) {
    return packageInfo.daily;
  }

  return dates.length >= packageInfo.discountMinDays && areConsecutiveDates(dates)
    ? packageInfo.discountedDaily
    : packageInfo.daily;
}

function hasRentalDiscount(dates, packageInfo) {
  if (packageInfo.isAddOnOffer) {
    return false;
  }

  return dates.length >= packageInfo.discountMinDays && areConsecutiveDates(dates);
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

function getDepositWithIdLabel(packageInfo) {
  return `${packageInfo.depositWithId} 元 + 證件正本`;
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

function isValidTaiwanMobile(phone) {
  return /^09\d{8}$/.test(phone);
}

function createReservationId(phone) {
  return `G${phone.slice(-5)}`;
}

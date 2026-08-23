const SHEET_NAME = "預約資料";
const SPREADSHEET_NAME = "手機租借預約資料";
const ITEM_PHONE = "vivo-x300-ultra";
const ITEM_LENS = "g2-ultra-400mm";
const ITEM_RAYBAN = "ray-ban-meta";
const KNOWN_ITEM_IDS = [ITEM_PHONE, ITEM_LENS, ITEM_RAYBAN];
const ITEM_LABELS = {
  [ITEM_PHONE]: "vivo X300 Ultra 12/256GB",
  [ITEM_LENS]: "G2 Ultra 增距鏡 400mm",
  [ITEM_RAYBAN]: "Ray-Ban Meta 智慧眼鏡 方框M"
};
const LOCATION_FEE_WAIVER_MIN_DAYS = 3;
const STATUS_OPTIONS = ["新預約", "已確認", "已取消"];

const HEADERS = [
  "建立時間",
  "狀態",
  "預約編號",
  "姓名",
  "電話",
  "thread 帳號",
  "租借物品",
  "租借開始日期",
  "租借結束日期",
  "租借天數",
  "租借日期",
  "每日租金",
  "預估租金",
  "押金方式",
  "押金",
  "取機地點",
  "取機加價",
  "還機地點",
  "還機加價",
  "地點加價",
  "物品 ID",
  "容量",
  "手機型號",
  "來源網址",
  "備註"
];

const HIDDEN_HEADERS = [
  "物品 ID",
  "容量",
  "手機型號",
  "來源網址",
  "備註"
];

function doGet(e) {
  const params = (e && e.parameter) || {};
  const spreadsheet = getReservationSpreadsheet_();

  if (params.action === "availability") {
    const requestedItemIds = getRequestedItemIds_(params);
    const unavailableItemsByDate = getBookedItemsByDate_(requestedItemIds);

    return output_(
      {
        ok: true,
        unavailableDates: Object.keys(unavailableItemsByDate).sort(),
        unavailableItemsByDate,
        requestedItems: requestedItemIds,
        generatedAt: new Date().toISOString()
      },
      params.callback
    );
  }

  return output_(
    {
      ok: true,
      service: "phone-rental-reservation",
      message: "Google Apps Script is ready.",
      spreadsheetUrl: spreadsheet.getUrl()
    },
    params.callback
  );
}

function doPost(e) {
  const lock = LockService.getScriptLock();

  if (!lock.tryLock(5000)) {
    return json_({ ok: false, error: "系統忙碌中，請稍後再試。" });
  }

  try {
    const data = e.parameter || {};

    if (data.companyWebsite) {
      return json_({ ok: true, skipped: true });
    }

    const requestedDates = getRequestedDates_(data);
    const requestedItemIds = getRequestedItemIds_(data);
    validate_(data, requestedDates, requestedItemIds);

    const bookedDates = getBookedDateSet_(requestedItemIds);
    const conflicts = requestedDates.filter((date) => bookedDates[date]);

    if (conflicts.length) {
      throw new Error(`日期已滿：${conflicts.join(", ")}`);
    }

    const sheet = getReservationSheet_();
    const headers = ensureHeaders_(sheet);
    const rowData = {
      "建立時間": new Date(),
      "狀態": "新預約",
      "預約編號": text_(data.reservationId),
      "姓名": text_(data.customerName),
      "電話": text_(data.phone),
      "thread 帳號": text_(data.threadAccount || data.lineId),
      "租借物品": text_(data.itemNames || data.rentalPackage || data.modelName),
      "租借開始日期": requestedDates[0],
      "租借結束日期": requestedDates[requestedDates.length - 1],
      "租借天數": requestedDates.length,
      "租借日期": requestedDates.join(", "),
      "每日租金": number_(data.dailyPrice),
      "預估租金": number_(data.rentalTotal),
      "押金方式": text_(data.depositOption),
      "押金": number_(data.deposit),
      "取機地點": text_(data.pickupLocation),
      "取機加價": text_(data.pickupFeeLabel || data.pickupFee),
      "還機地點": text_(data.dropoffLocation),
      "還機加價": text_(data.dropoffFeeLabel || data.dropoffFee),
      "地點加價": number_(data.locationFee),
      "物品 ID": requestedItemIds.join(", "),
      "容量": text_(data.storage),
      "手機型號": text_(data.modelName || data.model),
      "來源網址": text_(data.pageUrl),
      "備註": text_(data.notes)
    };

    sheet.appendRow(headers.map((header) => valueOrBlank_(rowData, header)));
    formatReservationSheet_(sheet, headers);

    return json_({ ok: true, reservationId: data.reservationId });
  } catch (error) {
    return json_({ ok: false, error: error.message });
  } finally {
    lock.releaseLock();
  }
}

function getReservationSheet_() {
  const spreadsheet = getReservationSpreadsheet_();
  let sheet = spreadsheet.getSheetByName(SHEET_NAME);

  if (!sheet) {
    sheet = spreadsheet.insertSheet(SHEET_NAME);
  }

  ensureHeaders_(sheet);
  return sheet;
}

function ensureHeaders_(sheet) {
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS);
    formatReservationSheet_(sheet, HEADERS);
    return HEADERS.slice();
  }

  const lastColumn = Math.max(sheet.getLastColumn(), 1);
  const headers = sheet.getRange(1, 1, 1, lastColumn).getDisplayValues()[0].map(canonicalHeader_);
  const nextHeaders = buildOrderedHeaders_(headers);

  if (!sameHeaders_(headers, nextHeaders)) {
    rebuildSheet_(sheet, headers, nextHeaders);
  }

  formatReservationSheet_(sheet, nextHeaders);
  return nextHeaders;
}

function buildOrderedHeaders_(currentHeaders) {
  const seen = {};
  const extras = [];

  HEADERS.forEach((header) => {
    seen[header] = true;
  });

  currentHeaders.forEach((header) => {
    if (header && !seen[header]) {
      seen[header] = true;
      extras.push(header);
    }
  });

  return HEADERS.concat(extras);
}

function sameHeaders_(currentHeaders, nextHeaders) {
  if (currentHeaders.length !== nextHeaders.length) {
    return false;
  }

  return currentHeaders.every((header, index) => header === nextHeaders[index]);
}

function rebuildSheet_(sheet, currentHeaders, nextHeaders) {
  const lastRow = sheet.getLastRow();
  const lastColumn = Math.max(sheet.getLastColumn(), 1);
  const values = sheet.getRange(1, 1, lastRow, lastColumn).getDisplayValues();
  const nextValues = [nextHeaders];

  values.slice(1).forEach((row) => {
    const rowData = {};

    currentHeaders.forEach((header, index) => {
      if (!header) {
        return;
      }

      const value = row[index];

      if (rowData[header] === undefined || rowData[header] === "") {
        rowData[header] = value;
      }
    });

    repairReservationRow_(rowData);
    nextValues.push(nextHeaders.map((header) => valueOrBlank_(rowData, header)));
  });

  sheet.clearContents();
  sheet.getRange(1, 1, nextValues.length, nextHeaders.length).setValues(nextValues);
}

function repairReservationRow_(rowData) {
  const rentalDays = getRentalDaysFromRowData_(rowData);
  const pickupFee = getLocationFeeInfo_(rowData["取機地點"], rentalDays);
  const dropoffFee = getLocationFeeInfo_(rowData["還機地點"], rentalDays);

  if (isBlankOrSheetError_(rowData["取機加價"])) {
    rowData["取機加價"] = pickupFee.label;
  }

  if (isBlankOrSheetError_(rowData["還機加價"])) {
    rowData["還機加價"] = dropoffFee.label;
  }

  if (isBlankOrSheetError_(rowData["地點加價"])) {
    rowData["地點加價"] = pickupFee.amount + dropoffFee.amount;
  }

  if (!rowData["狀態"]) {
    rowData["狀態"] = "新預約";
  }
}

function getRentalDaysFromRowData_(rowData) {
  const days = number_(rowData["租借天數"]);

  if (days) {
    return days;
  }

  return normalizeDateList_(text_(rowData["租借日期"]).split(/[,，\s]+/)).length;
}

function getLocationFeeInfo_(location, rentalDays) {
  const locationText = text_(location);
  const isWaived = rentalDays >= LOCATION_FEE_WAIVER_MIN_DAYS;
  let amount = 0;

  if (/小巨蛋/.test(locationText)) {
    amount = isWaived ? 0 : 100;
  }

  if (/大巨蛋/.test(locationText)) {
    amount = isWaived ? 0 : 150;
  }

  return {
    amount,
    label: `+ ${amount} 元`
  };
}

function isBlankOrSheetError_(value) {
  return !text_(value) || /^#(ERROR|VALUE|REF|NAME|N\/A|DIV\/0)!?$/i.test(text_(value));
}

function formatReservationSheet_(sheet, headers) {
  const lastRow = Math.max(sheet.getLastRow(), 1);
  const lastColumn = headers.length;

  sheet.setFrozenRows(1);
  sheet.setFrozenColumns(3);
  sheet.getRange(1, 1, 1, lastColumn)
    .setBackground("#0f766e")
    .setFontColor("#ffffff")
    .setFontWeight("bold")
    .setHorizontalAlignment("center");
  sheet.getRange(1, 1, lastRow, lastColumn)
    .setVerticalAlignment("middle")
    .setWrap(true);

  applyColumnFormats_(sheet, headers);
  applyStatusValidation_(sheet, headers);
  applyColumnWidths_(sheet, headers);
  applyHiddenColumns_(sheet, headers);
}

function applyColumnFormats_(sheet, headers) {
  const maxRows = Math.max(sheet.getMaxRows() - 1, 1);
  const dateHeaders = ["建立時間", "租借開始日期", "租借結束日期"];
  const textHeaders = ["預約編號", "電話", "thread 帳號", "取機加價", "還機加價", "押金方式", "租借日期", "物品 ID"];

  dateHeaders.forEach((header) => {
    const column = getHeaderColumn_(headers, header);

    if (column) {
      sheet.getRange(2, column, maxRows, 1).setNumberFormat("yyyy-mm-dd hh:mm");
    }
  });

  textHeaders.forEach((header) => {
    const column = getHeaderColumn_(headers, header);

    if (column) {
      sheet.getRange(2, column, maxRows, 1).setNumberFormat("@");
    }
  });
}

function applyStatusValidation_(sheet, headers) {
  const statusColumn = getHeaderColumn_(headers, "狀態");

  if (!statusColumn) {
    return;
  }

  const range = sheet.getRange(2, statusColumn, Math.max(sheet.getMaxRows() - 1, 1), 1);
  const validation = SpreadsheetApp.newDataValidation()
    .requireValueInList(STATUS_OPTIONS, true)
    .setAllowInvalid(false)
    .build();

  range.setDataValidation(validation);
  sheet.setConditionalFormatRules([
    SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo("新預約")
      .setBackground("#fff7ed")
      .setFontColor("#9a3412")
      .setRanges([range])
      .build(),
    SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo("已確認")
      .setBackground("#dcfce7")
      .setFontColor("#166534")
      .setRanges([range])
      .build(),
    SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo("已取消")
      .setBackground("#fee2e2")
      .setFontColor("#991b1b")
      .setRanges([range])
      .build()
  ]);
}

function applyColumnWidths_(sheet, headers) {
  const widths = {
    "建立時間": 145,
    "狀態": 90,
    "預約編號": 150,
    "姓名": 90,
    "電話": 120,
    "thread 帳號": 130,
    "租借物品": 320,
    "租借開始日期": 115,
    "租借結束日期": 115,
    "租借天數": 80,
    "租借日期": 260,
    "每日租金": 90,
    "預估租金": 95,
    "押金方式": 170,
    "押金": 90,
    "取機地點": 120,
    "取機加價": 90,
    "還機地點": 120,
    "還機加價": 90,
    "地點加價": 90
  };

  headers.forEach((header, index) => {
    sheet.setColumnWidth(index + 1, widths[header] || 120);
  });
}

function applyHiddenColumns_(sheet, headers) {
  sheet.showColumns(1, headers.length);

  HIDDEN_HEADERS.forEach((header) => {
    const column = getHeaderColumn_(headers, header);

    if (column) {
      sheet.hideColumns(column);
    }
  });
}

function getHeaderColumn_(headers, header) {
  const index = headers.indexOf(header);
  return index === -1 ? 0 : index + 1;
}

function getReservationSpreadsheet_() {
  const properties = PropertiesService.getScriptProperties();
  const spreadsheetId = properties.getProperty("SPREADSHEET_ID");

  if (spreadsheetId) {
    return SpreadsheetApp.openById(spreadsheetId);
  }

  const spreadsheet = SpreadsheetApp.create(SPREADSHEET_NAME);
  properties.setProperty("SPREADSHEET_ID", spreadsheet.getId());
  return spreadsheet;
}

function getBookedDates_(targetItemIds) {
  const bookedDateSet = getBookedDateSet_(targetItemIds);
  return Object.keys(bookedDateSet).sort();
}

function getBookedItemsByDate_(targetItemIds) {
  const bookedItemsByDate = {};
  const sheet = getReservationSheet_();

  if (sheet.getLastRow() < 2) {
    return bookedItemsByDate;
  }

  const values = sheet.getDataRange().getValues();
  const headers = values[0].map(canonicalHeader_);
  const indexes = buildHeaderIndex_(headers);
  const requestedItemSet = toSet_(targetItemIds || []);
  const shouldFilterByItem = Object.keys(requestedItemSet).length > 0;

  values.slice(1).forEach((row) => {
    const status = getCell_(row, indexes, "狀態");
    const reservationId = getCell_(row, indexes, "預約編號");

    if (reservationId.indexOf("TEST-") === 0 || isCanceled_(status)) {
      return;
    }

    const rowItemIds = getItemIdsFromRow_(row, indexes);
    const overlapItemIds = shouldFilterByItem
      ? rowItemIds.filter((itemId) => requestedItemSet[itemId])
      : rowItemIds;

    if (!overlapItemIds.length) {
      return;
    }

    getDatesFromRow_(row, indexes).forEach((date) => {
      overlapItemIds.forEach((itemId) => {
        addBookedItemLabel_(bookedItemsByDate, date, getItemLabel_(itemId));
      });
    });
  });

  return bookedItemsByDate;
}

function addBookedItemLabel_(bookedItemsByDate, date, label) {
  if (!bookedItemsByDate[date]) {
    bookedItemsByDate[date] = [];
  }

  if (label && !bookedItemsByDate[date].includes(label)) {
    bookedItemsByDate[date].push(label);
  }
}

function getBookedDateSet_(targetItemIds) {
  const bookedDates = {};
  const sheet = getReservationSheet_();

  if (sheet.getLastRow() < 2) {
    return bookedDates;
  }

  const values = sheet.getDataRange().getValues();
  const headers = values[0].map(canonicalHeader_);
  const indexes = buildHeaderIndex_(headers);
  const requestedItemSet = toSet_(targetItemIds || []);
  const shouldFilterByItem = Object.keys(requestedItemSet).length > 0;

  values.slice(1).forEach((row) => {
    const status = getCell_(row, indexes, "狀態");
    const reservationId = getCell_(row, indexes, "預約編號");

    if (reservationId.indexOf("TEST-") === 0 || isCanceled_(status)) {
      return;
    }

    const rowItemIds = getItemIdsFromRow_(row, indexes);

    if (shouldFilterByItem && !hasItemOverlap_(rowItemIds, requestedItemSet)) {
      return;
    }

    getDatesFromRow_(row, indexes).forEach((date) => {
      bookedDates[date] = true;
    });
  });

  return bookedDates;
}

function getItemIdsFromRow_(row, indexes) {
  const explicitIds = normalizeItemIds_(getCell_(row, indexes, "物品 ID"));

  if (explicitIds.length) {
    return explicitIds;
  }

  const itemText = [
    getCell_(row, indexes, "租借物品"),
    getCell_(row, indexes, "手機型號"),
    getCell_(row, indexes, "容量")
  ].join(" ").toLowerCase();
  const inferred = {};

  if (/g2|增距|400mm/.test(itemText)) {
    inferred[ITEM_LENS] = true;
  }

  if (/vivo|x300/.test(itemText)) {
    inferred[ITEM_PHONE] = true;
  }

  if (/ray.?ban|meta|智慧眼鏡|方框/i.test(itemText)) {
    inferred[ITEM_RAYBAN] = true;
  }

  if (!Object.keys(inferred).length && getCell_(row, indexes, "手機型號")) {
    inferred[ITEM_PHONE] = true;
  }

  return Object.keys(inferred);
}

function getDatesFromRow_(row, indexes) {
  const selectedDates = getCell_(row, indexes, "租借日期");

  if (selectedDates) {
    return normalizeDateList_(selectedDates.split(/[,，\s]+/));
  }

  const start = normalizeDateValue_(getCell_(row, indexes, "租借開始日期"));
  const end = normalizeDateValue_(getCell_(row, indexes, "租借結束日期"));

  if (!start || !end) {
    return [];
  }

  return expandDateRange_(start, end);
}

function getRequestedDates_(data) {
  const selectedDates = normalizeDateList_(text_(data.selectedDates).split(/[,，\s]+/));

  if (selectedDates.length) {
    return selectedDates;
  }

  return expandDateRange_(text_(data.rentalStart), text_(data.rentalEnd));
}

function getRequestedItemIds_(data) {
  const rawValue = text_(data.selectedItems || data.items || data.itemIds || data.model || data.modelName);
  return normalizeItemIds_(rawValue);
}

function normalizeItemIds_(value) {
  const itemSet = {};

  text_(value).split(/[,，\s]+/).forEach((itemId) => {
    if (itemId === "single-vivo-x300-ultra" || itemId === ITEM_PHONE) {
      itemSet[ITEM_PHONE] = true;
    }

    if (itemId === "single-g2-ultra-400mm" || itemId === ITEM_LENS) {
      itemSet[ITEM_LENS] = true;
    }

    if (itemId === "single-ray-ban-meta" || itemId === ITEM_RAYBAN) {
      itemSet[ITEM_RAYBAN] = true;
    }

    if (itemId === "combo-vivo-g2") {
      itemSet[ITEM_PHONE] = true;
      itemSet[ITEM_LENS] = true;
    }
  });

  return KNOWN_ITEM_IDS.filter((itemId) => itemSet[itemId]);
}

function validate_(data, requestedDates, requestedItemIds) {
  const requiredFields = [
    { label: "預約編號", value: data.reservationId },
    { label: "姓名", value: data.customerName },
    { label: "電話", value: data.phone },
    { label: "thread 帳號", value: data.threadAccount || data.lineId }
  ];

  requiredFields.forEach((field) => {
    if (!text_(field.value)) {
      throw new Error(`缺少必要欄位：${field.label}`);
    }
  });

  if (!requestedItemIds.length) {
    throw new Error("請至少選擇一項租借物品。");
  }

  if (!requestedDates.length) {
    throw new Error("請至少選擇一天租借日期。");
  }

  requestedDates.forEach((date) => {
    if (!isValidDateString_(date)) {
      throw new Error(`日期格式不正確：${date}`);
    }
  });
}

function expandDateRange_(startValue, endValue) {
  const start = normalizeDateValue_(startValue);
  const end = normalizeDateValue_(endValue);

  if (!isValidDateString_(start) || !isValidDateString_(end)) {
    return [];
  }

  const startDate = new Date(`${start}T00:00:00`);
  const endDate = new Date(`${end}T00:00:00`);

  if (endDate < startDate) {
    return [];
  }

  const dates = [];
  const cursor = new Date(startDate);

  while (cursor <= endDate && dates.length < 370) {
    dates.push(formatDate_(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }

  return dates;
}

function normalizeDateList_(dates) {
  const dateSet = {};

  dates.forEach((date) => {
    const normalized = normalizeDateValue_(date);

    if (isValidDateString_(normalized)) {
      dateSet[normalized] = true;
    }
  });

  return Object.keys(dateSet).sort();
}

function normalizeDateValue_(value) {
  if (value instanceof Date) {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), "yyyy-MM-dd");
  }

  return text_(value).slice(0, 10);
}

function isValidDateString_(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value || "");
}

function formatDate_(date) {
  return Utilities.formatDate(date, Session.getScriptTimeZone(), "yyyy-MM-dd");
}

function buildHeaderIndex_(headers) {
  const indexes = {};

  headers.forEach((header, index) => {
    if (indexes[header] === undefined) {
      indexes[header] = index;
    }
  });

  return indexes;
}

function getCell_(row, indexes, header) {
  const index = indexes[header];
  return index === undefined ? "" : text_(row[index]);
}

function hasItemOverlap_(rowItemIds, requestedItemSet) {
  return rowItemIds.some((itemId) => requestedItemSet[itemId]);
}

function toSet_(values) {
  const set = {};

  values.forEach((value) => {
    set[value] = true;
  });

  return set;
}

function getItemLabel_(itemId) {
  return ITEM_LABELS[itemId] || "已預約品項";
}

function isCanceled_(status) {
  return /取消|已取消|cancel/i.test(text_(status));
}

function canonicalHeader_(value) {
  const header = String(value || "").trim();
  const aliases = {
    "LINE": "thread 帳號",
    "LINE ID": "thread 帳號",
    "Line ID": "thread 帳號",
    "lineId": "thread 帳號",
    "LINEID": "thread 帳號",
    "Thread": "thread 帳號",
    "Threads": "thread 帳號",
    "thread": "thread 帳號",
    "電話號碼": "電話",
    "客人姓名": "姓名",
    "租金": "每日租金",
    "租金/日": "每日租金",
    "每日租金/日": "每日租金",
    "總租金": "預估租金",
    "預估總租金": "預估租金",
    "取機費用": "取機加價",
    "還機費用": "還機加價",
    "取件地點": "取機地點",
    "還件地點": "還機地點"
  };

  return aliases[header] || header;
}

function valueOrBlank_(rowData, header) {
  if (!Object.prototype.hasOwnProperty.call(rowData, header)) {
    return "";
  }

  const value = rowData[header];
  return typeof value === "string" ? text_(value) : value;
}

function text_(value) {
  const stringValue = value === null || value === undefined ? "" : String(value).trim();

  if (/^[=+\-@]/.test(stringValue)) {
    return `'${stringValue}`;
  }

  return stringValue;
}

function number_(value) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : "";
}

function output_(payload, callback) {
  const callbackName = text_(callback);

  if (/^[A-Za-z_$][\w.$]*$/.test(callbackName)) {
    return javascript_(`${callbackName}(${JSON.stringify(payload)});`);
  }

  return json_(payload);
}

function json_(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(ContentService.MimeType.JSON);
}

function javascript_(source) {
  return ContentService.createTextOutput(source).setMimeType(ContentService.MimeType.JAVASCRIPT);
}

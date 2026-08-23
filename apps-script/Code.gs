const SHEET_NAME = "預約資料";
const SPREADSHEET_NAME = "手機租借預約資料";
const ITEM_PHONE = "vivo-x300-ultra";
const ITEM_LENS = "g2-ultra-400mm";
const ITEM_RAYBAN = "ray-ban-meta";
const KNOWN_ITEM_IDS = [ITEM_PHONE, ITEM_LENS, ITEM_RAYBAN];

const HEADERS = [
  "建立時間",
  "預約編號",
  "租借開始日期",
  "租借結束日期",
  "租借天數",
  "手機型號",
  "容量",
  "租借物品",
  "物品 ID",
  "每日租金",
  "預估租金",
  "押金",
  "姓名",
  "thread 帳號",
  "電話",
  "取機地點",
  "取機加價",
  "還機地點",
  "還機加價",
  "地點加價",
  "備註",
  "來源網址",
  "狀態",
  "租借日期",
  "押金方式"
];

function doGet(e) {
  const params = (e && e.parameter) || {};
  const spreadsheet = getReservationSpreadsheet_();

  if (params.action === "availability") {
    const requestedItemIds = getRequestedItemIds_(params);

    return output_(
      {
        ok: true,
        unavailableDates: getBookedDates_(requestedItemIds),
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
      "預約編號": text_(data.reservationId),
      "租借開始日期": requestedDates[0],
      "租借結束日期": requestedDates[requestedDates.length - 1],
      "租借天數": requestedDates.length,
      "手機型號": text_(data.modelName || data.model),
      "容量": text_(data.storage),
      "租借物品": text_(data.itemNames || data.rentalPackage || data.modelName),
      "物品 ID": requestedItemIds.join(", "),
      "每日租金": number_(data.dailyPrice),
      "預估租金": number_(data.rentalTotal),
      "押金": number_(data.deposit),
      "姓名": text_(data.customerName),
      "thread 帳號": text_(data.threadAccount || data.lineId),
      "電話": text_(data.phone),
      "取機地點": text_(data.pickupLocation),
      "取機加價": text_(data.pickupFeeLabel || data.pickupFee),
      "還機地點": text_(data.dropoffLocation),
      "還機加價": text_(data.dropoffFeeLabel || data.dropoffFee),
      "地點加價": number_(data.locationFee),
      "備註": text_(data.notes),
      "來源網址": text_(data.pageUrl),
      "狀態": "新預約",
      "租借日期": requestedDates.join(", "),
      "押金方式": text_(data.depositOption)
    };

    sheet.appendRow(headers.map((header) => rowData[header] || ""));

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
    sheet.setFrozenRows(1);
    return HEADERS.slice();
  }

  const lastColumn = Math.max(sheet.getLastColumn(), 1);
  const headers = sheet.getRange(1, 1, 1, lastColumn).getValues()[0].map(text_);

  HEADERS.forEach((header) => {
    if (!headers.includes(header)) {
      headers.push(header);
      sheet.getRange(1, headers.length).setValue(header);
    }
  });

  sheet.setFrozenRows(1);
  return headers;
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

function getBookedDateSet_(targetItemIds) {
  const sheet = getReservationSheet_();

  if (sheet.getLastRow() < 2) {
    return {};
  }

  const values = sheet.getDataRange().getValues();
  const headers = values[0].map(text_);
  const indexes = buildHeaderIndex_(headers);
  const requestedItemSet = toSet_(targetItemIds || []);
  const shouldFilterByItem = Object.keys(requestedItemSet).length > 0;
  const bookedDates = {};

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
  const requiredFields = ["reservationId", "customerName", "lineId", "phone"];

  requiredFields.forEach((field) => {
    if (!text_(data[field])) {
      throw new Error(`缺少必要欄位：${field}`);
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
    indexes[header] = index;
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

function isCanceled_(status) {
  return /取消|已取消|cancel/i.test(text_(status));
}

function text_(value) {
  return String(value || "").trim();
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

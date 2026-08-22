const SHEET_NAME = "預約資料";
const SPREADSHEET_NAME = "手機租借預約資料";

const HEADERS = [
  "建立時間",
  "預約編號",
  "租借開始日期",
  "租借結束日期",
  "租借天數",
  "手機型號",
  "容量",
  "每日租金",
  "預估租金",
  "押金",
  "姓名",
  "LINE ID",
  "電話",
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
    return output_(
      {
        ok: true,
        unavailableDates: getBookedDates_(),
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
    validate_(data, requestedDates);

    const bookedDates = getBookedDateSet_();
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
      "每日租金": number_(data.dailyPrice),
      "預估租金": number_(data.rentalTotal),
      "押金": number_(data.deposit),
      "姓名": text_(data.customerName),
      "LINE ID": text_(data.lineId),
      "電話": text_(data.phone),
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

function getBookedDates_() {
  const bookedDateSet = getBookedDateSet_();
  return Object.keys(bookedDateSet).sort();
}

function getBookedDateSet_() {
  const sheet = getReservationSheet_();

  if (sheet.getLastRow() < 2) {
    return {};
  }

  const values = sheet.getDataRange().getValues();
  const headers = values[0].map(text_);
  const indexes = buildHeaderIndex_(headers);
  const bookedDates = {};

  values.slice(1).forEach((row) => {
    const status = getCell_(row, indexes, "狀態");
    const reservationId = getCell_(row, indexes, "預約編號");

    if (reservationId.indexOf("TEST-") === 0 || isCanceled_(status)) {
      return;
    }

    getDatesFromRow_(row, indexes).forEach((date) => {
      bookedDates[date] = true;
    });
  });

  return bookedDates;
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

function validate_(data, requestedDates) {
  const requiredFields = ["reservationId", "model", "customerName", "lineId", "phone"];

  requiredFields.forEach((field) => {
    if (!text_(data[field])) {
      throw new Error(`缺少必要欄位：${field}`);
    }
  });

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
  return index === undefined ? "" : row[index];
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

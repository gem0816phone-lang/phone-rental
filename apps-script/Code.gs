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
  "狀態"
];

function doGet() {
  const spreadsheet = getReservationSpreadsheet_();

  return json_({
    ok: true,
    service: "phone-rental-reservation",
    message: "Google Apps Script is ready.",
    spreadsheetUrl: spreadsheet.getUrl()
  });
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

    validate_(data);

    const sheet = getReservationSheet_();
    sheet.appendRow([
      new Date(),
      text_(data.reservationId),
      text_(data.rentalStart),
      text_(data.rentalEnd),
      number_(data.rentalDays),
      text_(data.modelName || data.model),
      text_(data.storage),
      number_(data.dailyPrice),
      number_(data.rentalTotal),
      number_(data.deposit),
      text_(data.customerName),
      text_(data.lineId),
      text_(data.phone),
      text_(data.notes),
      text_(data.pageUrl),
      "新預約"
    ]);

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

  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS);
    sheet.setFrozenRows(1);
  }

  return sheet;
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

function validate_(data) {
  const requiredFields = [
    "reservationId",
    "rentalStart",
    "rentalEnd",
    "model",
    "customerName",
    "lineId",
    "phone"
  ];

  requiredFields.forEach((field) => {
    if (!text_(data[field])) {
      throw new Error(`缺少必要欄位：${field}`);
    }
  });

  if (!/^\d{4}-\d{2}-\d{2}$/.test(data.rentalStart) || !/^\d{4}-\d{2}-\d{2}$/.test(data.rentalEnd)) {
    throw new Error("日期格式不正確。");
  }

  if (new Date(data.rentalEnd) < new Date(data.rentalStart)) {
    throw new Error("租借結束日期不可早於開始日期。");
  }
}

function text_(value) {
  return String(value || "").trim();
}

function number_(value) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : "";
}

function json_(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(ContentService.MimeType.JSON);
}

const SHEET_NAME = "預約資料";
const SPREADSHEET_NAME = "手機租借預約資料";
const FALLBACK_SPREADSHEET_ID = "1B_5iMvLi1d7rehoQUNY8skj6X4D1ZRhct7v54ejnNvM";
const WEB_APP_URL = "https://script.google.com/macros/s/AKfycby8Wiakvm3uRG045HPYtyOd-BlqDd5f7X_TFDLpOUIWgJkb9VEdo63yJqN6MHe3Rb3TzQ/exec";
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
const AVAILABILITY_CACHE_SECONDS = 15;
const STATUS_OPTIONS = ["待定", "已確認", "已取消", "新預約"];
const TELEGRAM_BOT_TOKEN_PROPERTY = "TELEGRAM_BOT_TOKEN";
const TELEGRAM_CHAT_ID_PROPERTY = "TELEGRAM_CHAT_ID";
const TELEGRAM_SEPARATOR = "-------------------------------------------------";
const CONTRACT_SHEET_NAME = "合約明細";
const CONTRACT_MANAGER_SHEET_NAME = "合約操作";
const CONTRACT_FOLDER_NAME = "手機租借合約書";
const CONTRACT_FOLDER_ID_PROPERTY = "CONTRACT_FOLDER_ID";
const CONTRACT_LESSOR_NAME_PROPERTY = "CONTRACT_LESSOR_NAME";
const CONTRACT_LESSOR_PHONE_PROPERTY = "CONTRACT_LESSOR_PHONE";
const CONTRACT_MANAGER_ACTION_KEY_PROPERTY = "CONTRACT_MANAGER_ACTION_KEY";
const CONTRACT_PAGE_WIDTH = 595.28;
const CONTRACT_PAGE_HEIGHT = 841.89;
const CONTRACT_TABLE_WIDTH = 520;
const CONTRACT_LABEL_COLUMN_WIDTH = 170;
const CONTRACT_VALUE_COLUMN_WIDTH = CONTRACT_TABLE_WIDTH - CONTRACT_LABEL_COLUMN_WIDTH;
const CONTRACT_ITEM_NUMBER_WIDTH = 38;
const CONTRACT_ITEM_TEXT_WIDTH = (CONTRACT_TABLE_WIDTH - CONTRACT_ITEM_NUMBER_WIDTH * 2) / 2;
const CONTRACT_INFO_LABEL_WIDTH = 92;
const CONTRACT_INFO_VALUE_WIDTH = 168;
const CONTRACT_BODY_FONT_SIZE = 8;
const CONTRACT_TABLE_FONT_SIZE = 8;
const CONTRACT_SECTION_FONT_SIZE = 10;
const TELEGRAM_ITEM_CONFIGS = {
  [ITEM_PHONE]: {
    title: "[單租] vivo X300 Ultra",
    detail: "vivo X300 Ultra 12/256GB",
    daily: 700,
    discountedDaily: 600,
    discountMinDays: 3
  },
  [ITEM_LENS]: {
    title: "[單租] G2 Ultra 增距鏡",
    detail: "G2 Ultra 增距鏡 400mm",
    daily: 300,
    discountedDaily: 250,
    discountMinDays: 3
  },
  [ITEM_RAYBAN]: {
    title: "[單租] Ray-Ban Meta 智慧眼鏡",
    offerTitle: "[優惠] Ray-Ban Meta 智慧眼鏡",
    detail: "Ray-Ban Meta 智慧眼鏡",
    daily: 200,
    discountedDaily: 150,
    addOnDaily: 100,
    discountMinDays: 3
  }
};
const TELEGRAM_COMBO_CONFIG = {
  title: "[組合] vivo X300 Ultra + G2 Ultra 增距鏡",
  daily: 900,
  discountedDaily: 750,
  discountMinDays: 3,
  details: [
    "vivo X300 Ultra 12/256GB",
    "G2 Ultra 增距鏡 400mm",
    "專用攝影手機殼",
    "迷你手機支架1.3M(收縮後僅14CM)"
  ]
};

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

const CONTRACT_HEADERS = [
  "預約編號",
  "合約狀態",
  "出租人姓名",
  "出租人電話",
  "承租人姓名",
  "承租人電話",
  "租借開始時間",
  "租借結束時間",
  "取機地點",
  "還機地點",
  "租借設備清單",
  "預估租金",
  "押金",
  "押金方式",
  "已付訂金",
  "剩餘款項",
  "合約文件",
  "合約PDF",
  "合約產生時間",
  "簽名連結",
  "簽名狀態",
  "簽名檔案",
  "簽名時間",
  "簽名金鑰"
];

const CONTRACT_MANAGER_ACTIONS = {
  7: "prepare",
  8: "generate",
  9: "confirm",
  10: "cancel"
};

function onOpen() {
  addPhoneRentalMenu_();
}

function onSpreadsheetOpen_() {
  addPhoneRentalMenu_();
}

function installPhoneRentalManager() {
  const spreadsheet = SpreadsheetApp.openById(FALLBACK_SPREADSHEET_ID);
  getContractManagerSheet_();
  getContractSheet_();

  const triggerMessage = installPhoneRentalManagerTriggers_(spreadsheet);

  return `已建立合約管理表，${triggerMessage}：${spreadsheet.getUrl()}`;
}

function installPhoneRentalManagerTriggers_(spreadsheet) {
  try {
    ScriptApp.getProjectTriggers().forEach((trigger) => {
      if (trigger.getHandlerFunction() === "onSpreadsheetOpen_" || trigger.getHandlerFunction() === "onContractManagerEdit_") {
        ScriptApp.deleteTrigger(trigger);
      }
    });
  } catch (error) {
    Logger.log(`Unable to clear existing phone rental triggers: ${error.message}`);
  }

  ScriptApp.newTrigger("onSpreadsheetOpen_")
    .forSpreadsheet(spreadsheet)
    .onOpen()
    .create();

  ScriptApp.newTrigger("onContractManagerEdit_")
    .forSpreadsheet(spreadsheet)
    .onEdit()
    .create();

  return "已安裝管理選單與勾選操作";
}

function onContractManagerEdit_(e) {
  if (!e || !e.range || text_(e.value).toUpperCase() !== "TRUE") {
    return;
  }

  const range = e.range;
  const sheet = range.getSheet();

  if (sheet.getName() !== CONTRACT_MANAGER_SHEET_NAME || range.getColumn() !== 2) {
    return;
  }

  const action = CONTRACT_MANAGER_ACTIONS[range.getRow()];

  if (!action) {
    return;
  }

  try {
    range.setValue(false);

    let message = "";

    if (action === "prepare") {
      message = prepareContractDetailFromManager_();
    }

    if (action === "generate") {
      message = generateContractFromManager_();
    }

    if (action === "confirm") {
      message = updateReservationStatusFromManager_("已確認");
    }

    if (action === "cancel") {
      message = updateReservationStatusFromManager_("已取消");
    }

    writeContractManagerStatus_(message);
  } catch (error) {
    range.setValue(false);
    writeContractManagerStatus_(`錯誤：${error.message}`);
    throw error;
  }
}

function addPhoneRentalMenu_() {
  try {
    SpreadsheetApp.getUi()
    .createMenu("手機租借管理")
    .addItem("整理預約表", "repairReservationSheet")
    .addSeparator()
    .addItem("建立/更新合約明細", "prepareContractDetail")
    .addItem("產生合約書", "generateContractFromSelectedRow")
    .addSeparator()
    .addItem("標記已確認", "markSelectedReservationConfirmed")
    .addItem("標記已取消", "markSelectedReservationCanceled")
    .addToUi();
  } catch (error) {
    Logger.log(`Unable to add phone rental menu: ${error.message}`);
  }
}

function doGet(e) {
  const params = (e && e.parameter) || {};

  if (params.action === "contractManager") {
    return handleContractManagerWebAction_(params);
  }

  if (params.action === "sign") {
    return handleSignaturePage_(params);
  }

  if (params.action === "availability") {
    const requestedItemIds = getRequestedItemIds_(params);
    const availability = getCachedAvailabilityByDate_(requestedItemIds);

    return output_(
      {
        ok: true,
        unavailableDates: Object.keys(availability.bookedItemsByDate).sort(),
        unavailableItemsByDate: availability.bookedItemsByDate,
        pendingDates: Object.keys(availability.pendingReservationsByDate).sort(),
        pendingReservationsByDate: availability.pendingReservationsByDate,
        requestedItems: requestedItemIds,
        generatedAt: new Date().toISOString()
      },
      params.callback
    );
  }

  const spreadsheet = getReservationSpreadsheet_();

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
      "狀態": "待定",
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

    appendReservationRow_(sheet, headers, rowData);
    formatReservationSheet_(sheet, headers);
    clearAvailabilityCache_();
    notifyTelegramReservation_(rowData, requestedDates);

    return json_({ ok: true, reservationId: data.reservationId });
  } catch (error) {
    return json_({ ok: false, error: error.message });
  } finally {
    lock.releaseLock();
  }
}

function getReservationSheet_(options) {
  const skipFormat = Boolean(options && options.skipFormat);
  const spreadsheet = getReservationSpreadsheet_();
  let sheet = spreadsheet.getSheetByName(SHEET_NAME);

  if (!sheet) {
    sheet = spreadsheet.insertSheet(SHEET_NAME);
  }

  if (skipFormat) {
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(HEADERS);
    }

    return sheet;
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
    rowData["狀態"] = "待定";
  }
}

function appendReservationRow_(sheet, headers, rowData) {
  const nextRow = Math.max(sheet.getLastRow() + 1, 2);

  if (nextRow > sheet.getMaxRows()) {
    sheet.insertRowsAfter(sheet.getMaxRows(), nextRow - sheet.getMaxRows());
  }

  applyRowFormats_(sheet, headers, nextRow);
  sheet.getRange(nextRow, 1, 1, headers.length).setValues([
    headers.map((header) => valueOrBlank_(rowData, header))
  ]);
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
  repairPhoneColumn_(sheet, headers);
  repairGeneratedFeeColumns_(sheet, headers);
  applyStatusValidation_(sheet, headers);
  applyColumnWidths_(sheet, headers);
  applyHiddenColumns_(sheet, headers);
}

function applyColumnFormats_(sheet, headers) {
  const maxRows = Math.max(sheet.getMaxRows() - 1, 1);
  const dateHeaders = getDateFormatHeaders_();
  const textHeaders = getTextFormatHeaders_();

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

function applyRowFormats_(sheet, headers, row) {
  getDateFormatHeaders_().forEach((header) => {
    const column = getHeaderColumn_(headers, header);

    if (column) {
      sheet.getRange(row, column).setNumberFormat("yyyy-mm-dd hh:mm");
    }
  });

  getTextFormatHeaders_().forEach((header) => {
    const column = getHeaderColumn_(headers, header);

    if (column) {
      sheet.getRange(row, column).setNumberFormat("@");
    }
  });
}

function repairPhoneColumn_(sheet, headers) {
  const dataRows = sheet.getLastRow() - 1;

  if (dataRows < 1) {
    return;
  }

  getPhoneTextHeaders_().forEach((header) => {
    const phoneColumn = getHeaderColumn_(headers, header);

    if (!phoneColumn) {
      return;
    }

    const range = sheet.getRange(2, phoneColumn, dataRows, 1);
    const values = range.getDisplayValues();
    let hasChanges = false;
    const nextValues = values.map(([value]) => {
      const normalized = normalizePhoneForSheet_(value);

      if (normalized !== value) {
        hasChanges = true;
      }

      return [normalized];
    });

    range.setNumberFormat("@");

    if (hasChanges) {
      range.setValues(nextValues);
    }
  });
}

function normalizePhoneForSheet_(value) {
  const visibleValue = plainText_(value).replace(/^'/, "");
  const digits = visibleValue.replace(/\D/g, "");

  if (/^09\d{8}$/.test(digits)) {
    return digits;
  }

  if (/^9\d{8}$/.test(digits)) {
    return `0${digits}`;
  }

  return visibleValue;
}

function repairGeneratedFeeColumns_(sheet, headers) {
  const dataRows = sheet.getLastRow() - 1;

  if (dataRows < 1) {
    return;
  }

  ["取機加價", "還機加價"].forEach((header) => {
    const column = getHeaderColumn_(headers, header);

    if (!column) {
      return;
    }

    const range = sheet.getRange(2, column, dataRows, 1);
    const values = range.getDisplayValues();
    let hasChanges = false;
    const nextValues = values.map(([value]) => {
      const cleaned = formatTelegramText_(value);

      if (cleaned !== value) {
        hasChanges = true;
      }

      return [cleaned];
    });

    range.setNumberFormat("@");

    if (hasChanges) {
      range.setValues(nextValues);
    }
  });
}

function getDateFormatHeaders_() {
  return ["建立時間", "租借開始日期", "租借結束日期"];
}

function getTextFormatHeaders_() {
  return ["預約編號", "電話", "出租人電話", "承租人電話", "thread 帳號", "取機加價", "還機加價", "押金方式", "租借日期", "物品 ID"];
}

function getPhoneTextHeaders_() {
  return ["電話", "出租人電話", "承租人電話"];
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
      .whenTextEqualTo("待定")
      .setBackground("#fef3c7")
      .setFontColor("#92400e")
      .setRanges([range])
      .build(),
    SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo("新預約")
      .setBackground("#fef3c7")
      .setFontColor("#92400e")
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
  const spreadsheetId = properties.getProperty("SPREADSHEET_ID") || FALLBACK_SPREADSHEET_ID;

  if (spreadsheetId) {
    try {
      const spreadsheet = SpreadsheetApp.openById(spreadsheetId);
      properties.setProperty("SPREADSHEET_ID", spreadsheet.getId());
      return spreadsheet;
    } catch (error) {
      if (spreadsheetId !== FALLBACK_SPREADSHEET_ID && FALLBACK_SPREADSHEET_ID) {
        const spreadsheet = SpreadsheetApp.openById(FALLBACK_SPREADSHEET_ID);
        properties.setProperty("SPREADSHEET_ID", spreadsheet.getId());
        return spreadsheet;
      }

      properties.deleteProperty("SPREADSHEET_ID");
    }
  }

  const spreadsheet = SpreadsheetApp.create(SPREADSHEET_NAME);
  properties.setProperty("SPREADSHEET_ID", spreadsheet.getId());
  return spreadsheet;
}

function notifyTelegramReservation_(rowData, requestedDates) {
  const telegramConfig = getTelegramConfig_();

  if (!telegramConfig.botToken || !telegramConfig.chatIds.length) {
    return;
  }

  const message = buildTelegramReservationMessage_(rowData, requestedDates);

  telegramConfig.chatIds.forEach((chatId) => {
    try {
      sendTelegramMessage_(telegramConfig.botToken, chatId, message);
    } catch (error) {
      console.error(`Telegram notification failed for chat ${chatId}: ${error.message}`);
    }
  });
}

function getTelegramConfig_() {
  const properties = PropertiesService.getScriptProperties();
  const botToken = plainText_(properties.getProperty(TELEGRAM_BOT_TOKEN_PROPERTY));
  const chatIds = plainText_(properties.getProperty(TELEGRAM_CHAT_ID_PROPERTY))
    .split(/[,，\s]+/)
    .filter(Boolean);

  return { botToken, chatIds };
}

function buildTelegramReservationMessage_(rowData, requestedDates) {
  const itemIds = normalizeItemIds_(rowData["物品 ID"]);
  const rentalLines = getTelegramRentalLines_(itemIds, requestedDates);
  const details = getTelegramDetailItems_(itemIds);
  const hasDiscount = rentalLines.some((line) => line.hasDiscount);
  const period = formatTelegramCompactPeriod_(requestedDates);
  const discountLabel = hasDiscount ? " ｜ 已套用連租優惠" : "";
  const lines = [
    `收到新預約 ${formatTelegramCreatedAt_(rowData["建立時間"])}`,
    TELEGRAM_SEPARATOR,
    `姓名：${rowData["姓名"]}`,
    `電話：${rowData["電話"]}`,
    `thread帳號：${rowData["thread 帳號"]}`,
    TELEGRAM_SEPARATOR,
    `總租金 ${formatTelegramAmount_(rowData["預估租金"])} 元`,
    `已選 ${requestedDates.length} 日 ｜ ${period}${discountLabel}`,
    TELEGRAM_SEPARATOR,
    `取機時間：${formatTelegramPickupDateTime_(requestedDates)}`,
    `取機地點：${formatTelegramText_(rowData["取機地點"])} ｜ ${formatTelegramFeeLabel_(rowData["取機加價"])}`,
    `還機時間：${formatTelegramReturnDateTime_(requestedDates)}`,
    `還機地點：${formatTelegramText_(rowData["還機地點"])} ｜ ${formatTelegramFeeLabel_(rowData["還機加價"])}`,
    TELEGRAM_SEPARATOR,
    formatTelegramRentalLines_(rentalLines),
    TELEGRAM_SEPARATOR,
    formatTelegramDetailLines_(details)
  ];

  return lines.join("\n");
}

function getTelegramRentalLines_(itemIds, dates) {
  const itemSet = toSet_(itemIds || []);
  const lines = [];
  const hasCombo = itemSet[ITEM_PHONE] && itemSet[ITEM_LENS];
  const hasBaseItem = itemSet[ITEM_PHONE] || itemSet[ITEM_LENS];

  if (hasCombo) {
    lines.push(buildTelegramRentalLine_(TELEGRAM_COMBO_CONFIG, dates));
  } else {
    [ITEM_PHONE, ITEM_LENS].forEach((itemId) => {
      if (itemSet[itemId]) {
        lines.push(buildTelegramRentalLine_(TELEGRAM_ITEM_CONFIGS[itemId], dates));
      }
    });
  }

  if (itemSet[ITEM_RAYBAN]) {
    const raybanConfig = TELEGRAM_ITEM_CONFIGS[ITEM_RAYBAN];
    lines.push(buildTelegramRentalLine_(
      {
        title: hasBaseItem ? raybanConfig.offerTitle : raybanConfig.title,
        daily: hasBaseItem ? raybanConfig.addOnDaily : raybanConfig.daily,
        discountedDaily: hasBaseItem ? raybanConfig.addOnDaily : raybanConfig.discountedDaily,
        discountMinDays: raybanConfig.discountMinDays,
        isAddOnOffer: hasBaseItem
      },
      dates
    ));
  }

  return lines;
}

function buildTelegramRentalLine_(config, dates) {
  const hasDiscount = hasTelegramRentalDiscount_(dates, config);
  const dailyRate = hasDiscount ? config.discountedDaily : config.daily;

  return {
    title: config.title,
    dailyRate,
    total: dailyRate * dates.length,
    hasDiscount
  };
}

function hasTelegramRentalDiscount_(dates, config) {
  if (config.isAddOnOffer) {
    return false;
  }

  return dates.length >= config.discountMinDays && areConsecutiveDates_(dates);
}

function formatTelegramRentalLines_(rentalLines) {
  return rentalLines.map((line) => [
    line.title,
    `${formatTelegramAmount_(line.dailyRate)} 元 / 日 ｜ 共 ${formatTelegramAmount_(line.total)} 元`
  ].join("\n")).join("\n");
}

function getTelegramDetailItems_(itemIds) {
  const itemSet = toSet_(itemIds || []);
  const details = [];

  if (itemSet[ITEM_PHONE] && itemSet[ITEM_LENS]) {
    TELEGRAM_COMBO_CONFIG.details.forEach((detail) => details.push(detail));
  } else {
    [ITEM_PHONE, ITEM_LENS].forEach((itemId) => {
      if (itemSet[itemId]) {
        details.push(TELEGRAM_ITEM_CONFIGS[itemId].detail);
      }
    });
  }

  if (itemSet[ITEM_RAYBAN]) {
    details.push(TELEGRAM_ITEM_CONFIGS[ITEM_RAYBAN].detail);
  }

  return details;
}

function formatTelegramDetailLines_(details) {
  return details.map((detail, index) => `${index + 1}. ${detail}`).join("\n");
}

function formatTelegramCreatedAt_(value) {
  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy/MM/dd HH:mm");
  }

  return Utilities.formatDate(date, Session.getScriptTimeZone(), "yyyy/MM/dd HH:mm");
}

function formatTelegramCompactPeriod_(dates) {
  if (!dates || !dates.length) {
    return "";
  }

  return `${formatMonthDay_(dates[0])}-${formatMonthDay_(dates[dates.length - 1])}`;
}

function formatTelegramPickupDateTime_(dates) {
  return dates && dates.length ? `${formatMonthDay_(dates[0])} 中午12點後` : "";
}

function formatTelegramReturnDateTime_(dates) {
  if (!dates || !dates.length) {
    return "";
  }

  return `${formatMonthDay_(addDaysToDateString_(dates[dates.length - 1], 1))} 中午12點前`;
}

function areConsecutiveDates_(dates) {
  return dates.every((date, index) => {
    if (index === 0) {
      return true;
    }

    const previousDate = new Date(`${dates[index - 1]}T00:00:00`);
    const currentDate = new Date(`${date}T00:00:00`);
    return (currentDate - previousDate) / 86400000 === 1;
  });
}

function addDaysToDateString_(value, days) {
  const normalized = normalizeDateValue_(value);
  const date = new Date(`${normalized}T00:00:00`);
  date.setDate(date.getDate() + days);
  return formatDate_(date);
}

function formatMonthDay_(value) {
  return normalizeDateValue_(value).slice(5).replace("-", "/");
}

function formatTelegramAmount_(value) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? String(Math.round(numberValue)) : plainText_(value);
}

function formatTelegramFeeLabel_(value) {
  const cleanValue = formatTelegramText_(value);
  const amountMatch = cleanValue.match(/-?\d+/);

  if (!amountMatch) {
    return cleanValue;
  }

  return `+ ${Math.max(Number(amountMatch[0]), 0)} 元`;
}

function formatTelegramText_(value) {
  return plainText_(value).replace(/^'(?=[=+\-@])/, "");
}

function sendTelegramMessage_(botToken, chatId, message) {
  const response = UrlFetchApp.fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify({
      chat_id: chatId,
      text: message,
      disable_web_page_preview: true
    }),
    muteHttpExceptions: true
  });
  const responseCode = response.getResponseCode();

  if (responseCode < 200 || responseCode >= 300) {
    throw new Error(`Telegram API returned ${responseCode}: ${response.getContentText()}`);
  }
}

function testTelegramNotification() {
  const telegramConfig = getTelegramConfig_();

  if (!telegramConfig.botToken || !telegramConfig.chatIds.length) {
    throw new Error(`請先在指令碼屬性設定 ${TELEGRAM_BOT_TOKEN_PROPERTY} 與 ${TELEGRAM_CHAT_ID_PROPERTY}。`);
  }

  telegramConfig.chatIds.forEach((chatId) => {
    sendTelegramMessage_(telegramConfig.botToken, chatId, "手機租借預約 Telegram 通知測試成功。");
  });
}

function logTelegramUpdates() {
  const telegramConfig = getTelegramConfig_();

  if (!telegramConfig.botToken) {
    throw new Error(`請先在指令碼屬性設定 ${TELEGRAM_BOT_TOKEN_PROPERTY}。`);
  }

  const response = UrlFetchApp.fetch(`https://api.telegram.org/bot${telegramConfig.botToken}/getUpdates`, {
    muteHttpExceptions: true
  });

  Logger.log(response.getContentText());
}

function repairReservationSheet() {
  const sheet = getReservationSheet_();
  const headers = ensureHeaders_(sheet);
  formatReservationSheet_(sheet, headers);
  return "ok";
}

function prepareContractDetail() {
  try {
    const context = getSelectedReservationContext_();
    const contractSheet = getContractSheet_();
    const contractHeaders = ensureContractHeaders_(contractSheet);
    const detail = buildContractDetailFromReservation_(context.rowData);
    const row = upsertContractDetail_(contractSheet, contractHeaders, detail);

    contractSheet.activate();
    contractSheet.setActiveRange(contractSheet.getRange(row, 1, 1, contractHeaders.length));
    showAlert_(`已建立/更新合約明細。\n請確認「合約明細」第 ${row} 列後，再按「產生合約書」。`);
  } catch (error) {
    showAlert_(error.message);
    throw error;
  }
}

function generateContractFromSelectedRow() {
  try {
    const context = getSelectedContractContext_();
    validateContractDetail_(context.rowData);
    const result = createContractFiles_(context.rowData);
    const signatureUrl = writeContractResult_(context.sheet, context.headers, context.row, result);
    showAlert_(`合約書已產生。\n\nGoogle 文件：${result.documentUrl}\nPDF：${result.pdfUrl}\n簽名連結：${signatureUrl}`);
  } catch (error) {
    showAlert_(error.message);
    throw error;
  }
}

function markSelectedReservationConfirmed() {
  updateSelectedReservationStatus_("已確認");
}

function markSelectedReservationCanceled() {
  updateSelectedReservationStatus_("已取消");
}

function setupContractManager() {
  const spreadsheet = getReservationSpreadsheet_();
  getContractManagerSheet_();
  getContractSheet_();
  getContractFolder_();
  const triggerMessage = installPhoneRentalManagerTriggers_(spreadsheet);
  showAlert_(`已建立「合約操作」與「合約明細」工作表，${triggerMessage}，也已確認合約資料夾權限。\n\n之後請在「合約操作」填預約編號，再勾選 B7-B10 執行。`);
}

function authorizePhoneRentalPermissions() {
  const spreadsheet = getReservationSpreadsheet_();
  const folder = getContractFolder_();
  const testDocument = DocumentApp.create("手機租借授權測試文件");
  const testDocumentId = testDocument.getId();
  testDocument.getBody().appendParagraph("這份文件只是用來完成 Google 文件授權，會自動移到垃圾桶。");
  testDocument.saveAndClose();
  DriveApp.getFileById(testDocumentId).setTrashed(true);

  showAlert_(`授權確認完成。\n\n試算表：${spreadsheet.getName()}\n合約資料夾：${folder.getName()}\nGoogle 文件權限：已確認`);
}

function prepareContractDetailFromManager() {
  try {
    const message = prepareContractDetailFromManager_();
    showAlert_(message);
  } catch (error) {
    showAlert_(error.message);
    throw error;
  }
}

function generateContractFromManager() {
  try {
    const message = generateContractFromManager_();
    showAlert_(message);
  } catch (error) {
    showAlert_(error.message);
    throw error;
  }
}

function markManagerReservationConfirmed() {
  try {
    const message = updateReservationStatusFromManager_("已確認");
    showAlert_(message);
  } catch (error) {
    showAlert_(error.message);
    throw error;
  }
}

function markManagerReservationCanceled() {
  try {
    const message = updateReservationStatusFromManager_("已取消");
    showAlert_(message);
  } catch (error) {
    showAlert_(error.message);
    throw error;
  }
}

function handleContractManagerWebAction_(params) {
  try {
    validateContractManagerActionKey_(params.key);

    const managerAction = text_(params.managerAction);
    let message = "";

    if (managerAction === "prepare") {
      message = prepareContractDetailFromManager_();
    } else if (managerAction === "generate") {
      message = generateContractFromManager_();
    } else if (managerAction === "confirm") {
      message = updateReservationStatusFromManager_("已確認");
    } else if (managerAction === "cancel") {
      message = updateReservationStatusFromManager_("已取消");
    } else {
      throw new Error("未知的合約操作。");
    }

    writeContractManagerStatus_(message);
    return html_("合約操作完成", message);
  } catch (error) {
    const message = `錯誤：${error.message}`;
    writeContractManagerStatus_(message);
    return html_("合約操作失敗", message);
  }
}

function handleSignaturePage_(params) {
  try {
    const template = HtmlService.createTemplateFromFile("Signature");
    template.bootstrapJson = JSON.stringify(getSignaturePageData_(params.id, params.token)).replace(/</g, "\\u003c");
    return template.evaluate()
      .setTitle("線上簽名")
      .addMetaTag("viewport", "width=device-width, initial-scale=1");
  } catch (error) {
    return html_("簽名連結無效", error.message);
  }
}

function getSignaturePageData_(reservationId, signatureToken) {
  const context = getSignatureContractContext_(reservationId, signatureToken);
  const rowData = context.rowData;

  return {
    reservationId: plainText_(rowData["預約編號"]),
    customerName: plainText_(rowData["承租人姓名"]),
    period: `${plainText_(rowData["租借開始時間"])} 至 ${plainText_(rowData["租借結束時間"])}`,
    contractPdfUrl: plainText_(rowData["合約PDF"]),
    signatureStatus: plainText_(rowData["簽名狀態"]) || "待簽署",
    signedAt: plainText_(rowData["簽名時間"]),
    token: text_(signatureToken)
  };
}

function submitSignature(payload) {
  const lock = LockService.getScriptLock();

  if (!lock.tryLock(5000)) {
    return { ok: false, error: "系統忙碌中，請稍後再試。" };
  }

  try {
    const data = payload || {};
    const context = getSignatureContractContext_(data.reservationId, data.token);
    const signatureDataUrl = plainText_(data.signatureDataUrl);
    const signatureMatch = signatureDataUrl.match(/^data:image\/png;base64,([A-Za-z0-9+/=]+)$/);

    if (!signatureMatch) {
      throw new Error("簽名資料格式不正確，請重新簽名後送出。");
    }

    if (signatureMatch[1].length < 1200) {
      throw new Error("簽名太短或沒有簽到，請重新簽名。");
    }

    const signedAt = new Date();
    const reservationId = plainText_(context.rowData["預約編號"]);
    const customerName = plainText_(context.rowData["承租人姓名"]) || "承租人";
    const timestamp = Utilities.formatDate(signedAt, Session.getScriptTimeZone(), "yyyyMMdd-HHmmss");
    const filename = sanitizeFilename_(`${reservationId} ${customerName} 線上簽名 ${timestamp}.png`);
    const blob = Utilities.newBlob(Utilities.base64Decode(signatureMatch[1]), "image/png", filename);
    const signatureFile = getContractFolder_().createFile(blob);

    writeSignatureResult_(context.sheet, context.headers, context.row, signatureFile.getUrl(), signedAt);

    return {
      ok: true,
      message: "簽名已送出，請回到對話視窗通知店家。",
      signedAt: Utilities.formatDate(signedAt, Session.getScriptTimeZone(), "yyyy/MM/dd HH:mm"),
      fileUrl: signatureFile.getUrl()
    };
  } catch (error) {
    return { ok: false, error: error.message };
  } finally {
    lock.releaseLock();
  }
}

function getSignatureContractContext_(reservationId, signatureToken) {
  const targetId = text_(reservationId);
  const targetToken = text_(signatureToken);

  if (!targetId || !targetToken) {
    throw new Error("簽名連結缺少必要資訊，請向店家索取新的簽名連結。");
  }

  const sheet = getContractSheet_();
  const headers = ensureContractHeaders_(sheet);
  const row = findRowByHeaderValue_(sheet, headers, "預約編號", targetId);

  if (!row) {
    throw new Error("找不到這筆合約資料，請確認是否已產生合約。");
  }

  const context = getRowContext_(sheet, row);
  const storedToken = text_(context.rowData["簽名金鑰"]);

  if (!storedToken || storedToken !== targetToken) {
    throw new Error("簽名連結已失效，請向店家索取新的簽名連結。");
  }

  return context;
}

function updateSelectedReservationStatus_(status) {
  try {
    const context = getSelectedReservationContextFromAnySheet_();
    const statusColumn = getHeaderColumn_(context.headers, "狀態");

    if (!statusColumn) {
      throw new Error("找不到「狀態」欄位。");
    }

    context.sheet.getRange(context.row, statusColumn).setValue(status);
    clearAvailabilityCache_();
    showAlert_(`預約 ${context.rowData["預約編號"] || ""} 已標記為「${status}」。`);
  } catch (error) {
    showAlert_(error.message);
    throw error;
  }
}

function prepareContractDetailFromManager_() {
  const manager = getContractManagerData_();
  const reservationContext = getReservationContextById_(manager.reservationId);
  const contractSheet = getContractSheet_();
  const contractHeaders = ensureContractHeaders_(contractSheet);
  const detail = buildContractDetailFromReservation_(reservationContext.rowData);

  if (manager.lessorName) {
    detail["出租人姓名"] = manager.lessorName;
  }

  if (manager.lessorPhone) {
    detail["出租人電話"] = manager.lessorPhone;
  }

  const row = upsertContractDetail_(contractSheet, contractHeaders, detail);
  contractSheet.activate();
  contractSheet.setActiveRange(contractSheet.getRange(row, 1, 1, contractHeaders.length));
  return `已建立/更新合約明細：${manager.reservationId}。請到「合約明細」第 ${row} 列確認細項。`;
}

function generateContractFromManager_() {
  const manager = getContractManagerData_();
  const contractSheet = getContractSheet_();
  const contractHeaders = ensureContractHeaders_(contractSheet);
  const contractRow = findRowByHeaderValue_(contractSheet, contractHeaders, "預約編號", manager.reservationId);

  if (!contractRow) {
    throw new Error("尚未建立合約明細，請先勾選「建立/更新合約明細」。");
  }

  const context = getRowContext_(contractSheet, contractRow);
  validateContractDetail_(context.rowData);
  const result = createContractFiles_(context.rowData);
  const signatureUrl = writeContractResult_(contractSheet, contractHeaders, contractRow, result);
  return `合約書已產生：${manager.reservationId}。PDF 與簽名連結已寫入「合約明細」。\n簽名連結：${signatureUrl}`;
}

function updateReservationStatusFromManager_(status) {
  const manager = getContractManagerData_();
  const context = getReservationContextById_(manager.reservationId);
  const statusColumn = getHeaderColumn_(context.headers, "狀態");

  if (!statusColumn) {
    throw new Error("找不到「狀態」欄位。");
  }

  context.sheet.getRange(context.row, statusColumn).setValue(status);
  clearAvailabilityCache_();
  return `預約 ${manager.reservationId} 已標記為「${status}」。`;
}

function getSelectedReservationContext_() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();

  if (!spreadsheet) {
    throw new Error("請先在試算表中選擇一筆預約資料。");
  }

  const sheet = spreadsheet.getActiveSheet();

  if (!sheet || sheet.getName() !== SHEET_NAME) {
    throw new Error(`請先到「${SHEET_NAME}」工作表選擇要處理的預約列。`);
  }

  return getSelectedRowContext_(sheet);
}

function getSelectedReservationContextFromAnySheet_() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();

  if (!spreadsheet) {
    throw new Error("請先在試算表中選擇一筆資料。");
  }

  const activeSheet = spreadsheet.getActiveSheet();

  if (activeSheet.getName() === SHEET_NAME) {
    return getSelectedRowContext_(activeSheet);
  }

  if (activeSheet.getName() === CONTRACT_SHEET_NAME) {
    const contractContext = getSelectedRowContext_(activeSheet);
    const reservationId = contractContext.rowData["預約編號"];
    return getReservationContextById_(reservationId);
  }

  throw new Error(`請先到「${SHEET_NAME}」或「${CONTRACT_SHEET_NAME}」工作表選擇一列。`);
}

function getSelectedContractContext_() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();

  if (!spreadsheet) {
    throw new Error("請先在試算表中選擇一筆合約明細。");
  }

  const activeSheet = spreadsheet.getActiveSheet();

  if (activeSheet.getName() === CONTRACT_SHEET_NAME) {
    ensureContractHeaders_(activeSheet);
    return getSelectedRowContext_(activeSheet);
  }

  if (activeSheet.getName() === SHEET_NAME) {
    const reservationContext = getSelectedRowContext_(activeSheet);
    const contractSheet = getContractSheet_();
    const contractHeaders = ensureContractHeaders_(contractSheet);
    const contractRow = findRowByHeaderValue_(contractSheet, contractHeaders, "預約編號", reservationContext.rowData["預約編號"]);

    if (!contractRow) {
      const detail = buildContractDetailFromReservation_(reservationContext.rowData);
      const row = upsertContractDetail_(contractSheet, contractHeaders, detail);
      contractSheet.activate();
      contractSheet.setActiveRange(contractSheet.getRange(row, 1, 1, contractHeaders.length));
      throw new Error(`已先建立「合約明細」第 ${row} 列。請確認細項後，再按一次「產生合約書」。`);
    }

    return getRowContext_(contractSheet, contractRow);
  }

  throw new Error(`請先到「${SHEET_NAME}」或「${CONTRACT_SHEET_NAME}」工作表選擇一列。`);
}

function getSelectedRowContext_(sheet) {
  const range = sheet.getActiveRange();

  if (!range || range.getRow() < 2) {
    throw new Error("請選擇資料列，不要選標題列。");
  }

  return getRowContext_(sheet, range.getRow());
}

function getRowContext_(sheet, row) {
  const headers = getSheetHeaders_(sheet);
  const values = sheet.getRange(row, 1, 1, headers.length).getDisplayValues()[0];
  const rowData = {};

  headers.forEach((header, index) => {
    if (header) {
      rowData[header] = values[index];
    }
  });

  return { sheet, headers, row, rowData };
}

function getReservationContextById_(reservationId) {
  const sheet = getReservationSheet_();
  const headers = ensureHeaders_(sheet);
  const row = findRowByHeaderValue_(sheet, headers, "預約編號", reservationId);

  if (!row) {
    throw new Error(`找不到預約編號：${reservationId}`);
  }

  return getRowContext_(sheet, row);
}

function getSheetHeaders_(sheet) {
  return sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), 1)).getDisplayValues()[0].map(canonicalHeader_);
}

function getContractSheet_() {
  const spreadsheet = getReservationSpreadsheet_();
  let sheet = spreadsheet.getSheetByName(CONTRACT_SHEET_NAME);

  if (!sheet) {
    sheet = spreadsheet.insertSheet(CONTRACT_SHEET_NAME);
  }

  ensureContractHeaders_(sheet);
  return sheet;
}

function getContractManagerSheet_() {
  const spreadsheet = getReservationSpreadsheet_();
  let sheet = spreadsheet.getSheetByName(CONTRACT_MANAGER_SHEET_NAME);

  if (!sheet) {
    sheet = spreadsheet.insertSheet(CONTRACT_MANAGER_SHEET_NAME);
  }

  formatContractManagerSheet_(sheet);
  return sheet;
}

function formatContractManagerSheet_(sheet) {
  ensureSheetSize_(sheet, 11, 3);

  const existingValues = sheet.getLastRow() >= 5
    ? sheet.getRange("B2:B5").getDisplayValues().map((row) => row[0])
    : ["", "", "", ""];
  existingValues[2] = normalizePhoneForSheet_(existingValues[2]);

  sheet.getRange(1, 1, sheet.getMaxRows(), sheet.getMaxColumns()).clearDataValidations();
  sheet.clear();
  sheet.setFrozenRows(1);
  sheet.setColumnWidth(1, 180);
  sheet.setColumnWidth(2, 220);
  sheet.setColumnWidth(3, 420);
  sheet.getRange("B2:B4").setNumberFormat("@");

  sheet.getRange("A1:C1").merge()
    .setValue("合約操作")
    .setBackground("#7c3aed")
    .setFontColor("#ffffff")
    .setFontWeight("bold")
    .setHorizontalAlignment("center");

  const rows = [
    ["預約編號", existingValues[0], "先填要處理的預約編號，例如 G45678"],
    ["出租人姓名", existingValues[1], "可先留空；建立合約明細後也能再補"],
    ["出租人電話", existingValues[2], "可先留空；建立合約明細後也能再補"],
    ["執行結果", existingValues[3], "這裡會顯示最後一次操作結果"],
    ["", "", ""],
    ["建立/更新合約明細", "", "先把預約資料帶到「合約明細」給你確認"],
    ["產生合約書", "", "確認「合約明細」後再點，會建立 Google 文件與 PDF"],
    ["標記已確認", "", "收到訂金、確定出租後再點，日期才會正式鎖住"],
    ["標記已取消", "", "取消預約時使用"],
  ];

  sheet.getRange(2, 1, rows.length, 3).setValues(rows);
  sheet.getRange("A2:A11")
    .setBackground("#f5f3ff")
    .setFontWeight("bold");
  sheet.getRange("C2:C11")
    .setFontColor("#64748b")
    .setFontSize(10);
  sheet.getRange("A1:C11")
    .setVerticalAlignment("middle")
    .setWrap(true);
  sheet.getRange("B7:B10").clearDataValidations();
  sheet.getRange("B7:B10")
    .clearContent()
    .insertCheckboxes()
    .setValue(false);
  sheet.getRange("B7:B10")
    .setBackground("#eff6ff")
    .setFontColor("#1d4ed8")
    .setFontWeight("bold")
    .setHorizontalAlignment("center");
  sheet.getRange("B2:B5").setBackground("#ffffff");
  sheet.getRange("B5").setBackground("#ecfeff").setWrap(true);
}

function makeContractManagerActionFormula_(action, label, key) {
  const url = `${WEB_APP_URL}?action=contractManager&managerAction=${encodeURIComponent(action)}&key=${encodeURIComponent(key)}`;
  return `=HYPERLINK("${url}","${label}")`;
}

function getContractManagerData_() {
  const sheet = getContractManagerSheet_();
  const reservationId = text_(sheet.getRange("B2").getDisplayValue());

  if (!reservationId) {
    throw new Error("請先在「合約操作」B2 填入預約編號。");
  }

  return {
    sheet,
    reservationId,
    lessorName: text_(sheet.getRange("B3").getDisplayValue()),
    lessorPhone: text_(sheet.getRange("B4").getDisplayValue())
  };
}

function writeContractManagerStatus_(message) {
  const sheet = getContractManagerSheet_();
  sheet.getRange("B5").setValue(`${Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "MM/dd HH:mm")} ${message}`);
}

function getContractManagerActionKey_() {
  const properties = PropertiesService.getScriptProperties();
  let key = properties.getProperty(CONTRACT_MANAGER_ACTION_KEY_PROPERTY);

  if (!key) {
    key = Utilities.getUuid().replace(/-/g, "");
    properties.setProperty(CONTRACT_MANAGER_ACTION_KEY_PROPERTY, key);
  }

  return key;
}

function validateContractManagerActionKey_(key) {
  if (text_(key) !== getContractManagerActionKey_()) {
    throw new Error("合約操作金鑰不正確，請重新執行 setupContractManager 更新操作連結。");
  }
}

function ensureContractHeaders_(sheet) {
  ensureSheetSize_(sheet, 1, CONTRACT_HEADERS.length);

  if (sheet.getLastRow() === 0) {
    sheet.appendRow(CONTRACT_HEADERS);
    formatContractSheet_(sheet, CONTRACT_HEADERS);
    return CONTRACT_HEADERS.slice();
  }

  const currentHeaders = getSheetHeaders_(sheet);
  const missingHeaders = CONTRACT_HEADERS.filter((header) => currentHeaders.indexOf(header) === -1);
  const headers = currentHeaders.concat(missingHeaders);

  if (missingHeaders.length) {
    ensureSheetSize_(sheet, 1, headers.length);
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  }

  formatContractSheet_(sheet, headers);
  return headers;
}

function formatContractSheet_(sheet, headers) {
  const lastRow = Math.max(sheet.getLastRow(), 1);
  const lastColumn = headers.length;

  ensureSheetSize_(sheet, lastRow, lastColumn);
  sheet.setFrozenRows(1);
  sheet.setFrozenColumns(1);
  sheet.getRange(1, 1, 1, lastColumn)
    .setBackground("#1d4ed8")
    .setFontColor("#ffffff")
    .setFontWeight("bold")
    .setHorizontalAlignment("center");
  sheet.getRange(1, 1, lastRow, lastColumn)
    .setVerticalAlignment("middle")
    .setWrap(true);

  const widths = {
    "預約編號": 120,
    "合約狀態": 90,
    "出租人姓名": 120,
    "出租人電話": 120,
    "承租人姓名": 120,
    "承租人電話": 120,
    "租借開始時間": 180,
    "租借結束時間": 180,
    "取機地點": 130,
    "還機地點": 130,
    "租借設備清單": 360,
    "預估租金": 95,
    "押金": 95,
    "押金方式": 170,
    "已付訂金": 95,
    "剩餘款項": 95,
    "合約文件": 260,
    "合約PDF": 260,
    "合約產生時間": 150,
    "簽名連結": 260,
    "簽名狀態": 90,
    "簽名檔案": 260,
    "簽名時間": 150,
    "簽名金鑰": 220
  };

  headers.forEach((header, index) => {
    sheet.setColumnWidth(index + 1, widths[header] || 120);
  });

  const statusColumn = getHeaderColumn_(headers, "合約狀態");

  if (statusColumn) {
    const range = sheet.getRange(2, statusColumn, Math.max(sheet.getMaxRows() - 1, 1), 1);
    const validation = SpreadsheetApp.newDataValidation()
      .requireValueInList(["草稿", "已產生", "已簽署", "取消"], true)
      .setAllowInvalid(false)
      .build();
    range.setDataValidation(validation);
  }

  ["預估租金", "總租金", "押金", "已付訂金", "剩餘款項"].forEach((header) => {
    const column = getHeaderColumn_(headers, header);

    if (column) {
      sheet.getRange(2, column, Math.max(sheet.getMaxRows() - 1, 1), 1).setNumberFormat("#,##0");
    }
  });

  getPhoneTextHeaders_().forEach((header) => {
    const column = getHeaderColumn_(headers, header);

    if (column) {
      sheet.getRange(2, column, Math.max(sheet.getMaxRows() - 1, 1), 1).setNumberFormat("@");
    }
  });
  repairPhoneColumn_(sheet, headers);

  ["合約產生時間", "簽名時間"].forEach((header) => {
    const column = getHeaderColumn_(headers, header);

    if (column) {
      sheet.getRange(2, column, Math.max(sheet.getMaxRows() - 1, 1), 1).setNumberFormat("yyyy-mm-dd hh:mm");
    }
  });
}

function buildContractDetailFromReservation_(reservationData) {
  const dates = getDatesFromRowData_(reservationData);
  const itemIds = normalizeItemIds_(reservationData["物品 ID"]);
  const totalRent = number_(reservationData["預估租金"]) + number_(reservationData["地點加價"]);
  const deposit = number_(reservationData["押金"]);
  const paidDeposit = getDefaultPaidDeposit_(reservationData);

  return {
    "預約編號": reservationData["預約編號"],
    "合約狀態": "草稿",
    "出租人姓名": plainText_(PropertiesService.getScriptProperties().getProperty(CONTRACT_LESSOR_NAME_PROPERTY)),
    "出租人電話": plainText_(PropertiesService.getScriptProperties().getProperty(CONTRACT_LESSOR_PHONE_PROPERTY)),
    "承租人姓名": reservationData["姓名"],
    "承租人電話": reservationData["電話"],
    "租借開始時間": dates.length ? formatContractDateTime_(dates[0]) : "",
    "租借結束時間": dates.length ? formatContractDateTime_(addDaysToDateString_(dates[dates.length - 1], 1)) : "",
    "取機地點": reservationData["取機地點"],
    "還機地點": reservationData["還機地點"],
    "租借設備清單": getContractEquipmentLines_(itemIds).join("\n"),
    "預估租金": totalRent || "",
    "總租金": totalRent || "",
    "押金": deposit || "",
    "押金方式": reservationData["押金方式"],
    "已付訂金": paidDeposit || "",
    "剩餘款項": totalRent || deposit || paidDeposit ? Math.max(totalRent + deposit - paidDeposit, 0) : "",
    "合約文件": "",
    "合約PDF": "",
    "合約產生時間": ""
  };
}

function getDatesFromRowData_(rowData) {
  const selectedDates = text_(rowData["租借日期"]);

  if (selectedDates) {
    return normalizeDateList_(selectedDates.split(/[,，\s]+/));
  }

  return expandDateRange_(rowData["租借開始日期"], rowData["租借結束日期"]);
}

function getDefaultPaidDeposit_(rowData) {
  return /免證|不用證|不押證/i.test(text_(rowData["押金方式"])) ? 1000 : 500;
}

function getContractEquipmentLines_(itemIds) {
  const itemSet = toSet_(itemIds || []);
  const lines = [];

  if (itemSet[ITEM_PHONE] && itemSet[ITEM_LENS]) {
    TELEGRAM_COMBO_CONFIG.details.forEach((detail) => lines.push(detail));
  } else {
    if (itemSet[ITEM_PHONE]) {
      lines.push(ITEM_LABELS[ITEM_PHONE]);
    }

    if (itemSet[ITEM_LENS]) {
      lines.push(ITEM_LABELS[ITEM_LENS]);
    }
  }

  if (itemSet[ITEM_RAYBAN]) {
    lines.push(ITEM_LABELS[ITEM_RAYBAN]);
  }

  return lines;
}

function upsertContractDetail_(sheet, headers, detail) {
  const reservationId = detail["預約編號"];

  if (!reservationId) {
    throw new Error("這筆預約沒有預約編號，無法建立合約明細。");
  }

  let row = findRowByHeaderValue_(sheet, headers, "預約編號", reservationId);
  const isNew = !row;

  if (!row) {
    row = Math.max(sheet.getLastRow() + 1, 2);
  }

  if (row > sheet.getMaxRows()) {
    sheet.insertRowsAfter(sheet.getMaxRows(), row - sheet.getMaxRows());
  }

  ensureSheetSize_(sheet, row, headers.length);
  const currentValues = isNew
    ? CONTRACT_HEADERS.map(() => "")
    : sheet.getRange(row, 1, 1, headers.length).getDisplayValues()[0];
  const nextValues = headers.map((header, index) => {
    const currentValue = currentValues[index];

    if (!isNew && shouldRefreshContractDetailValue_(header, currentValue, detail[header])) {
      return valueOrBlank_(detail, header);
    }

    if (!isNew && text_(currentValue)) {
      return currentValue;
    }

    return valueOrBlank_(detail, header);
  });

  sheet.getRange(row, 1, 1, headers.length).setValues([nextValues]);
  formatContractSheet_(sheet, headers);
  return row;
}

function ensureSheetSize_(sheet, minRows, minColumns) {
  if (sheet.getMaxRows() < minRows) {
    sheet.insertRowsAfter(sheet.getMaxRows(), minRows - sheet.getMaxRows());
  }

  if (sheet.getMaxColumns() < minColumns) {
    sheet.insertColumnsAfter(sheet.getMaxColumns(), minColumns - sheet.getMaxColumns());
  }
}

function shouldRefreshContractDetailValue_(header, currentValue, nextValue) {
  const autoRefreshHeaders = ["預估租金", "總租金", "押金", "已付訂金", "剩餘款項"];

  if (autoRefreshHeaders.indexOf(header) === -1) {
    return false;
  }

  const nextNumber = number_(nextValue);

  if (nextNumber === "") {
    return false;
  }

  const currentText = text_(currentValue);
  const currentNumber = number_(currentValue);

  return !currentText || currentNumber === 0 || isBlankOrSheetError_(currentText);
}

function findRowByHeaderValue_(sheet, headers, header, value) {
  const column = getHeaderColumn_(headers, header);
  const targetValue = text_(value);
  const dataRows = sheet.getLastRow() - 1;

  if (!column || !targetValue || dataRows < 1) {
    return 0;
  }

  const values = sheet.getRange(2, column, dataRows, 1).getDisplayValues();

  for (let index = 0; index < values.length; index += 1) {
    if (text_(values[index][0]) === targetValue) {
      return index + 2;
    }
  }

  return 0;
}

function validateContractDetail_(rowData) {
  const requiredHeaders = [
    "出租人姓名",
    "出租人電話",
    "承租人姓名",
    "承租人電話",
    "租借開始時間",
    "租借結束時間",
    "取機地點",
    "還機地點",
    "租借設備清單",
    "預估租金",
    "押金",
    "已付訂金",
    "剩餘款項"
  ];
  const missing = requiredHeaders.filter((header) => !text_(rowData[header]));

  if (missing.length) {
    throw new Error(`合約明細尚未填完整：${missing.join("、")}`);
  }
}

function createContractFiles_(rowData) {
  const reservationId = text_(rowData["預約編號"]) || Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyyMMddHHmm");
  const fileBaseName = sanitizeFilename_(`${reservationId} 設備租借合約書`);
  const folder = getContractFolder_();
  const document = DocumentApp.create(fileBaseName);
  const documentId = document.getId();
  const body = document.getBody();

  configureContractBody_(body);

  appendContractTitle_(body);
  appendContractSection_(body, "一、基本資料");
  appendContractInfoTable_(body, rowData);
  appendContractSection_(body, "二、租借設備清單");
  appendContractEquipmentTable_(body, rowData);
  appendContractSection_(body, "三、費用清單");
  appendContractFeeTable_(body, rowData);
  appendContractSection_(body, "四、訂金須知");
  appendContractBullets_(body, [
    "若距離預定時間14天以上取消預約，訂金全額退還。",
    "若距離預定時間14天之內取消預約，訂金不退還，並保留下次租借使用，如有特殊情況請私訊討論。",
    "若距離預定時間14天以上，因其他顧客造成設備損壞導致無法租借，將原價退還訂金並取消預約。",
    "若距離預定時間14天之內，因其他顧客造成設備損壞導致無法租借，將賠償雙倍訂金並取消預約。"
  ]);
  appendContractSection_(body, "五、使用規範");
  appendContractBullets_(body, [
    "請愛護設備，禁止改機、禁止拆機、禁止刷機，除了相機功能外，請勿擅自更改系統設置。",
    "所有照片影片請自行備份，並刪除後歸還，若有登入任何帳號，歸還前請自行登出。",
    "歸還時電量請維持在30%以上。"
  ]);
  appendContractSection_(body, "六、設備損壞及遺失");
  appendContractBullets_(body, [
    "面交時會確認設備皆為正常狀態，並拍照留存紀錄。",
    "設備非相機功能若有受損，將視情況扣除押金。",
    "設備相機功能若有受損，需照原購買價格買斷。",
    "若設備遺失需賠償原購買價格，若押金不足以賠償，仍需補足差額。",
    "若設備損壞或遺失造成後續客人無法租借，需賠償後續14天之內已預約客人的訂金。"
  ]);
  appendContractSection_(body, "七、逾期歸還");
  appendContractBullets_(body, [
    "超時每一小時扣除押金100元，若有狀況請提前告知協商。",
    "若超時造成後續客人無法租借，需賠償後續客人租用的總租金。",
    "若超時一天以上且無法聯繫，將採取法律行動，產生的費用由承租方承擔。"
  ]);
  appendContractDepositSection_(body, rowData);
  appendContractSection_(body, "九、簽名確認");
  appendContractSignatureTable_(body, rowData);
  appendContractFinalConfirmation_(body);

  document.saveAndClose();

  const documentFile = DriveApp.getFileById(documentId);
  moveFileToFolder_(documentFile, folder);
  const pdfFile = folder.createFile(documentFile.getAs(MimeType.PDF).setName(`${fileBaseName}.pdf`));

  return {
    documentUrl: documentFile.getUrl(),
    pdfUrl: pdfFile.getUrl(),
    generatedAt: new Date()
  };
}

function configureContractBody_(body) {
  body.setPageWidth(CONTRACT_PAGE_WIDTH);
  body.setPageHeight(CONTRACT_PAGE_HEIGHT);
  body.setMarginTop(24);
  body.setMarginBottom(24);
  body.setMarginLeft(36);
  body.setMarginRight(36);
  body.setAttributes({
    [DocumentApp.Attribute.FONT_FAMILY]: "Microsoft JhengHei",
    [DocumentApp.Attribute.FONT_SIZE]: CONTRACT_BODY_FONT_SIZE,
    [DocumentApp.Attribute.FOREGROUND_COLOR]: "#1f2937"
  });
}

function appendContractTitle_(body) {
  const title = body.appendParagraph("設備租借合約書");
  title.setHeading(DocumentApp.ParagraphHeading.TITLE)
    .setAlignment(DocumentApp.HorizontalAlignment.CENTER);
  title.setSpacingBefore(0).setSpacingAfter(0).setLineSpacing(1);
  title.editAsText().setForegroundColor("#111827").setFontSize(16).setBold(true);

  const subtitle = body.appendParagraph("@gem0816phone 設備出租");
  subtitle.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
  subtitle.setSpacingBefore(0).setSpacingAfter(4).setLineSpacing(1);
  subtitle.editAsText().setForegroundColor("#5a6778").setFontSize(8);
}

function appendContractSection_(body, title) {
  const paragraph = body.appendParagraph(title)
    .setHeading(DocumentApp.ParagraphHeading.HEADING2);
  paragraph.setSpacingBefore(3).setSpacingAfter(1).setLineSpacing(1);
  paragraph.editAsText().setForegroundColor("#1f4d78").setFontSize(CONTRACT_SECTION_FONT_SIZE).setBold(true);
}

function appendContractInfoTable_(body, rowData) {
  const infoTable = body.appendTable([
    ["出租人姓名", rowData["出租人姓名"], "出租人電話", rowData["出租人電話"]],
    ["承租人姓名", rowData["承租人姓名"], "承租人電話", rowData["承租人電話"]],
    ["取機地點", rowData["取機地點"], "還機地點", rowData["還機地點"]]
  ]);
  styleContractTable_(infoTable, { headerRows: 0, labelColumns: [0, 2] });
  setContractInfoTableWidths_(infoTable);

  const periodTable = body.appendTable([
    ["租借期間", `${plainText_(rowData["租借開始時間"])} 至 ${plainText_(rowData["租借結束時間"])}`]
  ]);
  styleContractTable_(periodTable, { headerRows: 0, labelColumns: [0] });
  setContractPeriodTableWidths_(periodTable);
}

function appendContractEquipmentTable_(body, rowData) {
  const equipmentLines = splitLines_(rowData["租借設備清單"]);
  const rows = [["項次", "設備 / 配件", "項次", "設備 / 配件"]];

  for (let index = 0; index < equipmentLines.length; index += 2) {
    rows.push([
      String(index + 1),
      equipmentLines[index],
      equipmentLines[index + 1] ? String(index + 2) : "",
      equipmentLines[index + 1] || ""
    ]);
  }

  const table = body.appendTable(rows);
  styleContractTable_(table, { headerRows: 1, labelColumns: [0, 2] });
  setEquipmentTableWidths_(table);
}

function appendContractFeeTable_(body, rowData) {
  const rows = [
    ["項目", "金額"],
    ["總租金", `NT. ${formatContractAmount_(getContractRentAmount_(rowData))} 元`],
    ["押金", getContractDepositDisplay_(rowData)],
    ["訂金", `NT. ${formatContractAmount_(rowData["已付訂金"])} 元`],
    ["剩餘款項", `NT. ${formatContractAmount_(rowData["剩餘款項"])} 元`]
  ];
  const table = body.appendTable(rows);
  styleContractTable_(table, { headerRows: 1, labelColumns: [0] });
  setTwoColumnTableWidths_(table);
}

function appendContractDepositSection_(body, rowData) {
  if (requiresCertificateDeposit_(rowData)) {
    appendContractSection_(body, "八、押金及證件須知");
    appendContractBullets_(body, [
      "證件正本將於取機時收取，會在現場裝入破壞袋並請您簽名，保證租用期間未擅自拆封使用於其他用途。",
      "還機時確認設備無異常後，現場退還押金及證件。",
      "若設備損壞且金額不足以賠償，將扣押證件，並採取法律行動。"
    ]);
    return;
  }

  appendContractSection_(body, "八、押金須知");
  appendContractBullets_(body, [
    "還機時確認設備無異常後，現場退還押金。",
    "若設備損壞且金額不足以賠償，將扣押證件，並採取法律行動。"
  ]);
}

function getContractRentAmount_(rowData) {
  return rowData["預估租金"] || rowData["總租金"];
}

function getContractDepositDisplay_(rowData) {
  const depositText = `NT. ${formatContractAmount_(rowData["押金"])} 元`;
  return requiresCertificateDeposit_(rowData)
    ? `${depositText} + 證件正本(身分證或駕照擇一)`
    : depositText;
}

function requiresCertificateDeposit_(rowData) {
  const depositOption = text_(rowData["押金方式"]);

  if (/免證|不用證|不押證/i.test(depositOption)) {
    return false;
  }

  if (/證件|押證|身分證|身份證|駕照/i.test(depositOption)) {
    return true;
  }

  if (number_(rowData["已付訂金"]) >= 1000) {
    return false;
  }

  if (number_(rowData["押金"]) >= 10000) {
    return false;
  }

  return true;
}

function appendContractSignatureTable_(body, rowData) {
  const table = body.appendTable([
    [`承租人 ${plainText_(rowData["承租人姓名"])} 簽名`, ""]
  ]);
  styleContractTable_(table, { headerRows: 0, labelColumns: [0] });
  setTwoColumnTableWidths_(table);
  styleSignatureRow_(table);
}

function appendContractBullets_(body, items) {
  items.forEach((item) => {
    const listItem = body.appendListItem(item).setGlyphType(DocumentApp.GlyphType.BULLET);
    listItem.setSpacingBefore(0).setSpacingAfter(0).setLineSpacing(1);
    listItem.editAsText().setFontSize(CONTRACT_BODY_FONT_SIZE);
  });
}

function appendCompactParagraph_(body, text, fontSize, spacingBefore, spacingAfter) {
  const paragraph = body.appendParagraph(text);
  paragraph.setSpacingBefore(spacingBefore).setSpacingAfter(spacingAfter).setLineSpacing(1);
  paragraph.editAsText().setFontSize(fontSize);
  return paragraph;
}

function appendContractFinalConfirmation_(body) {
  appendContractFinalLine_(body, "訂金交付後才會鎖定檔期，剩餘款項將於取機面交時當面付清。", 4);
  appendContractFinalLine_(body, "承租人確認已閱讀、理解並同意本合約全部內容,且同意依本合約約定租借、使用及歸還設備。", 0);
  appendContractFinalLine_(body, "電子文件及電子簽章，在功能上等同於實體文件及簽章，不得僅因其電子形式而否認其法律效力。", 0);
}

function appendContractFinalLine_(body, text, spacingBefore) {
  const paragraph = appendCompactParagraph_(body, text, CONTRACT_BODY_FONT_SIZE, spacingBefore, 0);
  paragraph.editAsText().setBold(true);
}

function styleContractTable_(table, options) {
  const settings = options || {};
  const headerRows = settings.headerRows || 0;
  const labelColumns = settings.labelColumns || [];

  for (let rowIndex = 0; rowIndex < table.getNumRows(); rowIndex += 1) {
    const row = table.getRow(rowIndex);

    for (let cellIndex = 0; cellIndex < row.getNumCells(); cellIndex += 1) {
      const cell = row.getCell(cellIndex);
      const isHeader = rowIndex < headerRows;
      const isLabel = labelColumns.indexOf(cellIndex) !== -1;

      cell.setPaddingTop(1).setPaddingBottom(1).setPaddingLeft(4).setPaddingRight(4);
      cell.editAsText().setFontSize(CONTRACT_TABLE_FONT_SIZE).setForegroundColor("#1f4d78");

      if (isHeader || isLabel) {
        cell.setBackgroundColor(isHeader ? "#e8eef5" : "#f5f6f8");
        cell.editAsText().setBold(true);
      }
    }
  }
}

function setContractInfoTableWidths_(table) {
  for (let rowIndex = 0; rowIndex < table.getNumRows(); rowIndex += 1) {
    const row = table.getRow(rowIndex);

    if (row.getNumCells() === 1) {
      setTableRowWidths_(row, [CONTRACT_TABLE_WIDTH]);
    } else {
      setTableRowWidths_(row, [
        CONTRACT_INFO_LABEL_WIDTH,
        CONTRACT_INFO_VALUE_WIDTH,
        CONTRACT_INFO_LABEL_WIDTH,
        CONTRACT_INFO_VALUE_WIDTH
      ]);
    }
  }
}

function setContractPeriodTableWidths_(table) {
  for (let rowIndex = 0; rowIndex < table.getNumRows(); rowIndex += 1) {
    setTableRowWidths_(table.getRow(rowIndex), [CONTRACT_INFO_LABEL_WIDTH, CONTRACT_TABLE_WIDTH - CONTRACT_INFO_LABEL_WIDTH]);
  }
}

function setTwoColumnTableWidths_(table) {
  for (let rowIndex = 0; rowIndex < table.getNumRows(); rowIndex += 1) {
    setTableRowWidths_(table.getRow(rowIndex), [CONTRACT_LABEL_COLUMN_WIDTH, CONTRACT_VALUE_COLUMN_WIDTH]);
  }
}

function styleSignatureRow_(table) {
  const row = table.getRow(0);
  row.setMinimumHeight(54);

  for (let cellIndex = 0; cellIndex < row.getNumCells(); cellIndex += 1) {
    row.getCell(cellIndex).setVerticalAlignment(DocumentApp.VerticalAlignment.CENTER);
  }
}

function setEquipmentTableWidths_(table) {
  for (let rowIndex = 0; rowIndex < table.getNumRows(); rowIndex += 1) {
    setTableRowWidths_(table.getRow(rowIndex), [
      CONTRACT_ITEM_NUMBER_WIDTH,
      CONTRACT_ITEM_TEXT_WIDTH,
      CONTRACT_ITEM_NUMBER_WIDTH,
      CONTRACT_ITEM_TEXT_WIDTH
    ]);
  }
}

function setTableRowWidths_(row, widths) {
  for (let cellIndex = 0; cellIndex < row.getNumCells(); cellIndex += 1) {
    if (widths[cellIndex]) {
      row.getCell(cellIndex).setWidth(widths[cellIndex]);
    }
  }
}

function writeContractResult_(sheet, headers, row, result) {
  const rowData = getRowContext_(sheet, row).rowData;
  const reservationId = text_(rowData["預約編號"]);
  const signatureToken = getOrCreateSignatureToken_(sheet, headers, row);
  const signatureUrl = buildSignatureUrl_(reservationId, signatureToken);
  const values = {
    "合約狀態": "已產生",
    "合約文件": result.documentUrl,
    "合約PDF": result.pdfUrl,
    "合約產生時間": result.generatedAt,
    "簽名連結": signatureUrl,
    "簽名狀態": "待簽署"
  };

  Object.keys(values).forEach((header) => {
    const column = getHeaderColumn_(headers, header);

    if (column) {
      sheet.getRange(row, column).setValue(values[header]);
    }
  });

  formatContractSheet_(sheet, headers);
  return signatureUrl;
}

function writeSignatureResult_(sheet, headers, row, signatureFileUrl, signedAt) {
  const values = {
    "合約狀態": "已簽署",
    "簽名狀態": "已簽署",
    "簽名檔案": signatureFileUrl,
    "簽名時間": signedAt
  };

  Object.keys(values).forEach((header) => {
    const column = getHeaderColumn_(headers, header);

    if (column) {
      sheet.getRange(row, column).setValue(values[header]);
    }
  });

  formatContractSheet_(sheet, headers);
}

function getOrCreateSignatureToken_(sheet, headers, row) {
  const tokenColumn = getHeaderColumn_(headers, "簽名金鑰");

  if (!tokenColumn) {
    throw new Error("找不到「簽名金鑰」欄位，請先重新整理合約明細。");
  }

  const currentToken = text_(sheet.getRange(row, tokenColumn).getDisplayValue());

  if (currentToken) {
    return currentToken;
  }

  const token = Utilities.getUuid().replace(/-/g, "");
  sheet.getRange(row, tokenColumn).setValue(token);
  return token;
}

function buildSignatureUrl_(reservationId, signatureToken) {
  return `${WEB_APP_URL}?action=sign&id=${encodeURIComponent(reservationId)}&token=${encodeURIComponent(signatureToken)}`;
}

function getContractFolder_() {
  const properties = PropertiesService.getScriptProperties();
  const folderId = properties.getProperty(CONTRACT_FOLDER_ID_PROPERTY);

  if (folderId) {
    try {
      return DriveApp.getFolderById(folderId);
    } catch (error) {
      properties.deleteProperty(CONTRACT_FOLDER_ID_PROPERTY);
    }
  }

  const folders = DriveApp.getFoldersByName(CONTRACT_FOLDER_NAME);
  const folder = folders.hasNext() ? folders.next() : DriveApp.createFolder(CONTRACT_FOLDER_NAME);
  properties.setProperty(CONTRACT_FOLDER_ID_PROPERTY, folder.getId());
  return folder;
}

function moveFileToFolder_(file, folder) {
  folder.addFile(file);

  try {
    DriveApp.getRootFolder().removeFile(file);
  } catch (error) {
    console.warn(`Unable to remove contract file from root folder: ${error.message}`);
  }
}

function formatContractDateTime_(dateString) {
  const normalized = normalizeDateValue_(dateString);

  if (!isValidDateString_(normalized)) {
    return "";
  }

  const [year, month, day] = normalized.split("-");
  return `${year}年${month}月${day}日 12點00分`;
}

function splitLines_(value) {
  return plainText_(value).split(/\r?\n+/).map((line) => line.trim()).filter(Boolean);
}

function formatContractAmount_(value) {
  const numericValue = Number(String(value).replace(/,/g, ""));

  if (!Number.isFinite(numericValue)) {
    return plainText_(value);
  }

  return Utilities.formatString("%s", Math.round(numericValue)).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function sanitizeFilename_(value) {
  return plainText_(value).replace(/[\\/:*?"<>|]/g, " ").replace(/\s+/g, " ").trim();
}

function showAlert_(message) {
  try {
    SpreadsheetApp.getUi().alert(message);
  } catch (error) {
    Logger.log(message);
  }
}

function getBookedDates_(targetItemIds) {
  const bookedDateSet = getBookedDateSet_(targetItemIds);
  return Object.keys(bookedDateSet).sort();
}

function getCachedAvailabilityByDate_(targetItemIds) {
  const cache = CacheService.getScriptCache();
  const cacheKey = buildAvailabilityCacheKey_(targetItemIds);
  const cachedValue = cache.get(cacheKey);

  if (cachedValue) {
    try {
      return JSON.parse(cachedValue);
    } catch (error) {
      cache.remove(cacheKey);
    }
  }

  const availability = getAvailabilityByDate_(targetItemIds);
  cache.put(cacheKey, JSON.stringify(availability), AVAILABILITY_CACHE_SECONDS);
  return availability;
}

function clearAvailabilityCache_() {
  CacheService.getScriptCache().removeAll(getAvailabilityCacheKeys_());
}

function getAvailabilityCacheKeys_() {
  const keys = [buildAvailabilityCacheKey_([])];
  const itemCount = KNOWN_ITEM_IDS.length;

  for (let mask = 1; mask < (1 << itemCount); mask += 1) {
    const itemIds = KNOWN_ITEM_IDS.filter((itemId, index) => mask & (1 << index));
    keys.push(buildAvailabilityCacheKey_(itemIds));
  }

  return keys;
}

function buildAvailabilityCacheKey_(targetItemIds) {
  const itemIds = normalizeItemIds_(Array.isArray(targetItemIds) ? targetItemIds.join(",") : targetItemIds).sort();
  return `availability:${itemIds.join("|") || "all"}`;
}

function getAvailabilityByDate_(targetItemIds) {
  const bookedItemsByDate = {};
  const pendingReservationsByDate = {};
  const sheet = getReservationSheet_({ skipFormat: true });

  if (sheet.getLastRow() < 2) {
    return { bookedItemsByDate, pendingReservationsByDate };
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

    if (isPending_(status)) {
      const entry = {
        reservationId,
        createdAt: normalizeDateTimeValue_(row[indexes["建立時間"]]),
        createdAtLabel: formatPendingCreatedAt_(row[indexes["建立時間"]]),
        status: status || "待定",
        items: overlapItemIds.map(getItemLabel_)
      };

      getDatesFromRow_(row, indexes).forEach((date) => {
        addPendingReservation_(pendingReservationsByDate, date, entry);
      });

      return;
    }

    if (isConfirmed_(status)) {
      getDatesFromRow_(row, indexes).forEach((date) => {
        overlapItemIds.forEach((itemId) => {
          addBookedItemLabel_(bookedItemsByDate, date, getItemLabel_(itemId));
        });
      });
    }
  });

  Object.keys(pendingReservationsByDate).forEach((date) => {
    pendingReservationsByDate[date].sort(comparePendingReservation_);
  });

  return { bookedItemsByDate, pendingReservationsByDate };
}

function getBookedItemsByDate_(targetItemIds) {
  const bookedItemsByDate = {};
  const sheet = getReservationSheet_({ skipFormat: true });

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

    if (!isConfirmed_(status)) {
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

function getPendingReservationsByDate_(targetItemIds) {
  const pendingReservationsByDate = {};
  const sheet = getReservationSheet_({ skipFormat: true });

  if (sheet.getLastRow() < 2) {
    return pendingReservationsByDate;
  }

  const values = sheet.getDataRange().getValues();
  const headers = values[0].map(canonicalHeader_);
  const indexes = buildHeaderIndex_(headers);
  const requestedItemSet = toSet_(targetItemIds || []);
  const shouldFilterByItem = Object.keys(requestedItemSet).length > 0;

  values.slice(1).forEach((row) => {
    const status = getCell_(row, indexes, "狀態");
    const reservationId = getCell_(row, indexes, "預約編號");

    if (reservationId.indexOf("TEST-") === 0 || !isPending_(status)) {
      return;
    }

    const rowItemIds = getItemIdsFromRow_(row, indexes);
    const overlapItemIds = shouldFilterByItem
      ? rowItemIds.filter((itemId) => requestedItemSet[itemId])
      : rowItemIds;

    if (!overlapItemIds.length) {
      return;
    }

    const entry = {
      reservationId,
      createdAt: normalizeDateTimeValue_(row[indexes["建立時間"]]),
      createdAtLabel: formatPendingCreatedAt_(row[indexes["建立時間"]]),
      status: status || "待定",
      items: overlapItemIds.map(getItemLabel_)
    };

    getDatesFromRow_(row, indexes).forEach((date) => {
      addPendingReservation_(pendingReservationsByDate, date, entry);
    });
  });

  Object.keys(pendingReservationsByDate).forEach((date) => {
    pendingReservationsByDate[date].sort(comparePendingReservation_);
  });

  return pendingReservationsByDate;
}

function addPendingReservation_(pendingReservationsByDate, date, entry) {
  if (!pendingReservationsByDate[date]) {
    pendingReservationsByDate[date] = [];
  }

  if (!pendingReservationsByDate[date].some((reservation) => reservation.reservationId === entry.reservationId)) {
    pendingReservationsByDate[date].push(entry);
  }
}

function comparePendingReservation_(first, second) {
  return String(first.createdAt || "").localeCompare(String(second.createdAt || ""));
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
  const sheet = getReservationSheet_({ skipFormat: true });

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

    if (!isConfirmed_(status)) {
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

function normalizeDateTimeValue_(value) {
  if (value instanceof Date) {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), "yyyy-MM-dd'T'HH:mm:ss");
  }

  return text_(value);
}

function formatPendingCreatedAt_(value) {
  if (value instanceof Date) {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), "MM/dd HH:mm");
  }

  const parsedDate = new Date(text_(value));

  if (!Number.isNaN(parsedDate.getTime())) {
    return Utilities.formatDate(parsedDate, Session.getScriptTimeZone(), "MM/dd HH:mm");
  }

  return text_(value);
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

function isPending_(status) {
  return /新預約|待確認|待定|pending/i.test(text_(status));
}

function isConfirmed_(status) {
  return !isCanceled_(status) && !isPending_(status);
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

  if (typeof value !== "string") {
    return value;
  }

  return isGeneratedFeeHeader_(header) ? plainText_(value) : text_(value);
}

function isGeneratedFeeHeader_(header) {
  return header === "取機加價" || header === "還機加價";
}

function text_(value) {
  const stringValue = value === null || value === undefined ? "" : String(value).trim();

  if (/^[=+\-@]/.test(stringValue)) {
    return `'${stringValue}`;
  }

  return stringValue;
}

function plainText_(value) {
  return value === null || value === undefined ? "" : String(value).trim();
}

function number_(value) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : "";
  }

  const normalizedValue = plainText_(value)
      .replace(/^'/, "")
      .replace(/,/g, "");
  const numberMatches = normalizedValue.match(/-?\d+(?:\.\d+)?/g);

  if (!numberMatches || !numberMatches.length) {
    return "";
  }

  const numberValue = Number(numberMatches[numberMatches.length - 1]);
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

function html_(title, message) {
  const sheetUrl = `https://docs.google.com/spreadsheets/d/${FALLBACK_SPREADSHEET_ID}/edit`;
  const safeTitle = escapeHtml_(title);
  const safeMessage = escapeHtml_(message);
  return HtmlService.createHtmlOutput(`
    <!doctype html>
    <html>
      <head>
        <base target="_top">
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
          body {
            margin: 0;
            min-height: 100vh;
            display: grid;
            place-items: center;
            background: #f8fafc;
            color: #0f172a;
            font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          }
          main {
            width: min(520px, calc(100vw - 32px));
            padding: 28px;
            border: 1px solid #dbe3ee;
            border-radius: 14px;
            background: #ffffff;
            box-shadow: 0 16px 40px rgba(15, 23, 42, 0.08);
          }
          h1 {
            margin: 0 0 14px;
            font-size: 22px;
          }
          p {
            white-space: pre-line;
            line-height: 1.65;
          }
          a {
            display: inline-block;
            margin-top: 14px;
            color: #1d4ed8;
            font-weight: 700;
          }
        </style>
      </head>
      <body>
        <main>
          <h1>${safeTitle}</h1>
          <p>${safeMessage}</p>
          <a href="${sheetUrl}">回到手機租借預約資料</a>
        </main>
      </body>
    </html>
  `);
}

function escapeHtml_(value) {
  return plainText_(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

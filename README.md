# 手機租借網站

這是一個可放在 GitHub Pages 的手機租借預約網站。客人填寫日期、機型、姓名、LINE 與電話後，前端會呼叫 Google Apps Script，將資料寫入 Google Sheet。

## 檔案

- `index.html`：手機租借預約頁面。
- `styles.css`：網站樣式。
- `script.js`：表單驗證、估價與送出邏輯。
- `config.js`：公開設定，貼上 Apps Script 網址與店家聯絡資訊。
- `apps-script/Code.gs`：貼到 Google Apps Script 的後台程式。

## 設定 Google Sheet 後台

1. 到 <https://script.google.com/home> 建立 Apps Script 新專案。
2. 將 `apps-script/Code.gs` 的內容貼進 Apps Script 編輯器。
3. 儲存後選「部署」→「新增部署作業」。
4. 類型選「網路應用程式」。
5. 執行身分選「我」。
6. 存取權限選「任何人」。
7. 部署後複製 Web App URL。
8. 打開 `config.js`，把 `appsScriptUrl` 改成剛剛複製的網址。

第一次打開 Web App URL 或收到預約時，Apps Script 會自動在你的 Google Drive 建立一份名為「手機租借預約資料」的 Google Sheet。

## 發佈到 GitHub Pages

1. 將整個資料夾推到 GitHub repository。
2. 到 repository 的 Settings → Pages。
3. Source 選 `Deploy from a branch`。
4. Branch 選 `main`，資料夾選 `/root`。
5. 儲存後等待 GitHub Pages 發佈。

網址會像這樣：

```text
https://你的帳號.github.io/phone-rental/
```

## 安全提醒

不要把管理員密碼、私密 API key、Google Sheet 編輯連結或任何秘密資訊放進前端檔案。GitHub Pages 的 HTML、CSS、JavaScript 都是公開的。

Apps Script Web App URL 可以放在前端，因為它本來就是公開接收表單用的網址。真正需要保護的是 Google Sheet 的權限與你的 Google 帳號。

## 測試

如果 `config.js` 還沒有填 Apps Script 網址，網站會進入測試模式，送出的資料只會暫存在目前瀏覽器的 localStorage，不會寫入 Google Sheet。

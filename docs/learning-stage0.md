# 階段 0：個人學習資料基礎（歷史驗收紀錄）

本文件保留階段 0 完成時的狀態。後續人物介面與整輪成績整合請參考 [階段 1 說明](learning-stage1.md)；逐題寫入仍未啟用。

基準：e01adb7。這一階段只新增獨立模組與測試；index.html、cloze.html、既有程式、教材、錄音與 localStorage 寫入方式均未修改。沒有預設學習者，也沒有新的逐題紀錄寫入。

## 啟用界線

- 目前網站不載入 learning-store.js、learning-catalog.js 或 learning-targets.json；不會自行開啟新資料庫。
- recordOutcome 固定拒絕 RECORDING_NOT_ENABLED，沒有設定旗標可開啟。
- createLearner、createSession、preserveLegacy、assignLegacy 僅為下一階段呼叫介面；此階段只有隔離測試呼叫。
- 頭像／暱稱選擇介面通過驗收後，才能另行授權接入。不可將第一位孩子默認為舊成績主人。
- 現有網站仍依原規則更新「舊版共用成績」。本階段不覆寫、不移除那些資料，也不更改現有功能；不表示停止既有練習的正常成績更新。

## 儲存版本與資料分區

IndexedDB 名稱 word-club-learning，資料庫版本 1，備份格式版本 1。沒有帳號、電子郵件、密碼或雲端同步。

| 區域 | 主鍵 | 內容／用途 |
|---|---|---|
| meta | id | schema、formatVersion、已完成的遷移清單 |
| learners | id | 固定 learnerId（欄位 id）、nickname、avatarId、revision |
| sessions | learnerId + id | 指定學習者、練習類型、固定目標 ID、open 狀態及格式版本 |
| events | learnerId + id | 保留逐題事件區，階段 0 不寫入 |
| mastery / mistakes | learnerId + id | 保留熟練度／錯題區，階段 0 不計算、不寫入 |
| rewards / wardrobe | learnerId + id | 保留裝扮獎勵／穿搭區，階段 0 不寫入 |
| legacy | shared-v1 | 舊版原始字串快照、未指定的 learnerId、格式版本 |

所有個人資料區都有 learnerId 索引。讀取必須指定存在的學習者，沒有讀取「目前預設孩子」的隱含行為。人物改名或換頭像不更換 ID。newId 使用安全隨機 UUID；在不支援的環境明確失敗，不用姓名或時間戳替代。

## 固定學習目標 ID

learning-targets.json 記錄 1,800 個永久 UUID：899 筆拼字來源、901 個克漏字目標。ID 是一次配置並保存的資料，不可重新生成整張表。

- 拼字來源以年級、課程與原英文查找永久 ID；中文、音檔路徑與陣列順序不是識別依據。
- 英文或課程來源改名時，人工維護 sources 並保留同一 ID；不可因查找失敗就自動建立新目標。
- 克漏字保存原課程 ID、target 與 questionIds；跨課練習須使用 origin、originTarget、originId 查回來源。
- 拼字與克漏字不自動合併；同字不同課也不自動共用熟練度。未來若要合併，另做明確語意對照。
- 綜合拼字目前會去重；後續啟用個人紀錄時必須補上來源攜帶規則，不能一次作答替所有同字課程加分。
- 本階段沒有改動原始教材的 ID、內容、排列或音檔路徑。

## 舊資料封存與歸屬

preserveLegacy 接收明確提供的 storage，只讀取 word-club-progress-v1 及 word-club-cloze: 前綴的字串，不讀取其他網站用途的資料。先完整讀完才開啟寫入交易；原始值不刪除、不修改，包含不合法 JSON 也原樣封存。失敗時不產生部分快照。

第一次快照的 learnerId 為 null。之後呼叫不更新既有快照，避免重複遷移覆寫；這是一份不可變的歷史快照，不是持續同步的備份。未來正式開啟歸屬介面時，需選定切換時點，提示快照與後續共用練習的差別；不得拿測試期快照冒充最新成績。

assignLegacy 必須傳入 confirmed: true 及存在的 learnerId。只能歸屬一次，同一人重試安全，改給另一人會拒絕。歸屬只標記封存資料的主人，不將最高成績轉換成逐題事件、日期、熟練度或獎勵。沒有公開的改歸屬或刪除介面。

## 多分頁、重試與失敗處理

- 同 ID、相同內容的建立重試不重複新增；同 ID 不同內容會拒絕。
- 修改人物須帶 expectedRevision。資料庫交易中檢查版本，舊分頁不得覆蓋較新的暱稱／頭像。
- 場次 ID 與 learnerId 一起固定歸屬。後續答題模組應使用場次中的身分，不隨全域人物切換改寫。
- 各次寫入必須等交易完成才回報成功，交易中斷不留下部分資料。
- onStatus 回報 STORAGE_UNAVAILABLE、OPEN_FAILED、UPGRADE_BLOCKED、REOPEN_REQUIRED 或 TRANSACTION_FAILED；下一階段介面須將訊息呈現給使用者，不可顯示假成功。
- 其他分頁升級版本時關閉本連線；被舊連線阻擋則回報失敗，遲到的成功連線也立即關閉。
- 不支援降版；未來版本需新增明確遷移步驟。初版只包含從空資料庫建立版本 1 的遷移，未宣稱已完成未來版本遷移。

## 未來事件與備份契約

後續啟用前須實作及驗證事件契約：formatVersion、learnerId、eventId、sessionId、targetId、來源課程／題目、教材版本、activity、提示模式、首次結果、錯誤次數、是否揭露答案、作答時間、是否完成。事件鍵為 learnerId + eventId；重送須查核相同內容，衝突拒絕。當次答題的多次嘗試須能區分，不能因後來答對就丟掉第一次答錯。

本階段只保留事件主鍵唯一限制並禁止寫入，尚未實作事件內容驗證、熟練度算法、錯題累積或獎勵運算。那些是身分介面驗收後的下一階段，不可直接繞過 recordOutcome 寫入。

未來單人備份外層應含 formatVersion、schemaVersion、catalogVersion、exportedAt、learner，以及 sessions、events、mastery、mistakes、rewards、wardrobe、已歸屬 legacy。每項資料必須符合該 learnerId；未知版本或混入他人資料先拒絕，匯入前預覽歸屬並決定新增／合併。事件 ID 用於去重；衍生摘要須記錄算法版本。現在只定義契約，沒有匯出／匯入介面或還原實作。

裝扮正式上線前，須先完成可用的基本備份／還原驗收。瀏覽器儲存仍可能被清除，本機分人不是密碼隔離，也不是永久備份。

## 測試

既有測試：node --test cloze-scope.test.cjs cloze.test.cjs practice.test.cjs speech.test.cjs

階段 0 測試：node --test learning.test.cjs

新測試需 Node.js、可解析的 playwright 模組與已安裝的 Microsoft Edge。可透過 NODE_PATH 指向既有工具環境的 node_modules，不需將工具或個人機器路徑提交。缺少依賴時測試直接失敗，不會跳過冒充通過。

真實 IndexedDB 測試在隔離的臨時瀏覽器及虛構 HTTPS 網站執行，不讀寫正式網站的紀錄。涵蓋身分隔離、重試、舊資料保留、不同分頁、版本變更、封存歸屬、硬性禁用逐題寫入及注入容量失敗。容量不足測試是故障注入，不是塞滿實際裝置。

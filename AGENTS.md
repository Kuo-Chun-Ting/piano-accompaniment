# UI 設計原則

設計 UI 時應保持專業、簡潔並聚焦使用者任務。預設移除低資訊密度、重複解釋、顯而易見的操作提示、裝飾性標籤，以及使用者未要求的選項。只有在使用者可能無法完成任務、操作具有風險，或系統狀態需要解釋時才顯示提示。不要用大量卡片、徽章、步驟文案或教學文字填滿畫面。

撰寫 UI 文案或其他使用者可見文字時，避免 AI 感或生成式文案：不要重述畫面已呈現的流程，不要為填滿空間加入說明，不要堆疊抽象形容詞或刻意使用工整口號。優先使用簡短、具體、符合操作情境的詞句，並維持名詞一致；沒有操作或判斷價值的文字直接省略。

系統畫面應保持簡潔，只呈現使用者完成當前任務所需的資訊。若某段文字、狀態或提示不會影響使用者判斷下一步，就不要顯示；避免用重複文案、裝飾性狀態、低資訊密度提示或 AI 感文案填滿畫面。

# 寫測試方式

所有功能修改預設走 TDD：先依 change scope 寫失敗測試，再實作到通過。

1. Unit test：
   - 使用 Vitest。
   - 適用於純邏輯、資料轉換、狀態更新、error handling，或可以用 stub / mock 隔離外部依賴的程式。

2. Component test：
   - 使用 Vitest、Nuxt Test Utils 與 Vue Test Utils。
   - 適用於 Vue / Nuxt 元件的 render、props、emit、互動與狀態變化。

3. E2E test：
   - 使用 Playwright。
   - 適用於跨元件、跨頁面、圖片上傳、API 串接與完整使用者流程。
   - 預設 stub AI API；只有修改 prompt、AI schema 或真實 API 串接時，才執行不 stub AI API 的 `@live` 測試。

4. 修改 Unit / Component / E2E test 時，同步更新 `docs/test-inventory.html`。

# 驗證方式

1. 預設執行所有不會呼叫真實 API 的測試。
2. 只有修改 prompt、AI schema、model 選擇或真實 API 串接時，才執行會呼叫真實 AI API 的 `@live` E2E test。
3. 修改音訊轉譜、五線譜渲染或 Player，且使用者已要求更新實際產物時，使用目前 worktree 的程式自行重建 `.audio-score/安靜` 與 `.audio-score/楓`，不要要求使用者執行。重建後使用本機權限執行 `npm run audio:score:verify`；兩者都通過才算完成。
4. 驗證實際產物外觀與音訊跳轉時，從專案根目錄執行 `npm run audio:score:serve`，再用 Browser 開啟 `http://127.0.0.1:3200/.audio-score/安靜/index.html` 與 `http://127.0.0.1:3200/.audio-score/楓/index.html`。必須實際檢查兩份畫面；不可使用 `file://`，也不可只依賴自動驗證結果。
5. 執行 `npm run test:e2e` 或 `npm run test:e2e:live` 前先停止上述靜態 Server。未設定 `PLAYWRIGHT_BASE_URL` 時，由 Playwright 自動在 `3200` 啟動測試網站；不要改用 `npm run dev` 的 `3000`。

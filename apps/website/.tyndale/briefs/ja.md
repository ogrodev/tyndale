# Translation Brief (en → ja)

## 1) App Context
- **Application type:** Developer-tool landing site/documentation front page for **Tyndale**, an open-source, AI-powered **i18n/localization workflow** tool.
- **Audience:** Frontend/full-stack developers (React/Next.js), DevOps/CI users.
- **Content style:** Marketing + technical feature highlights + onboarding steps + GitHub-driven adoption CTAs.

## 2) Register & Formality
- Use **丁寧体（です・ます調）** for full sentences.
- For UI labels/step titles/short headings, use concise neutral forms (noun or dictionary form), but keep overall tone polite.
- **Do not use 「あなた」** unless absolutely required; Japanese UI should be subject-implicit.

## 3) Tone
- **Professional, technical, and confident**, with light marketing energy.
- Keep copy **clear and concise**, not playful or overly casual.
- Emphasize speed, automation, reliability, and developer productivity.

## 4) Term Decisions

### Keep in English (or product/command literal)
- **Brand / platform / framework:** `Tyndale`, `GitHub`, `React`, `Next.js`
- **Code/CLI tokens:** `CLI`, `JSX`, `RTL`, `CI`, `tyndale validate`
- **Abbreviation:** `i18n` (optionally first mention: `i18n（国際化）`)

### Translate to Japanese (naturalized where standard)
- `Docs` → `ドキュメント`（or `Docs` only if nav style requires strict English consistency）
- `Open Source` / `Open-source` → `オープンソース`
- `AI-powered` → `AI搭載` or `AI活用`
- `Get Started` → `はじめる`
- `View on GitHub` → `GitHubで見る`
- `Star on GitHub` → `GitHubでスターを付ける`
- `Write your component. Run the CLI. Ship translated.`  
  → `コンポーネントを作成。CLIを実行。翻訳してリリース。`

### Preferred Japanese technical wording
- `locales` → `ロケール`
- `providers` → `プロバイダー`
- `static generation` → `静的生成`
- `workflow` → `ワークフロー`
- `incremental` → `差分` / `インクリメンタル`（文脈に応じて）
- `ship` (release context) → `リリース`

## 5) Patterns

### CTA buttons/links
- Use **action-oriented, non-forceful** labels (dictionary form / concise noun-verb), not harsh imperatives.
- Recommended pattern:
  - `Get Started` → `はじめる`
  - `See it in action` → `動作を見る`
  - `Install / Initialize / Translate` → `インストール` / `初期化` / `翻訳`
- Keep CTAs short (2–8 Japanese characters where possible).

### Error messages
- Tone: polite, factual, non-blaming.
- Structure: **What happened + what to do next**.
- Pattern: `〜に失敗しました。〜を確認して、もう一度お試しください。`

### Empty states
- Tone: calm and guiding.
- Structure: **Current state + first next action**.
- Pattern: `まだ翻訳はありません。CLIを実行して翻訳を生成してください。`

### Confirmations/success
- Tone: concise positive confirmation.
- Pattern: `〜が完了しました。` / `〜を保存しました。`
- Avoid excessive enthusiasm; prioritize clarity.

### Questions
- Use soft, natural question forms: `〜しますか？` / `〜できますか？`
- For marketing questions (e.g., “Ready to go global?”), use inviting but professional phrasing:  
  `グローバル展開の準備はできていますか？`
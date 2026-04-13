# Translation Brief (EN → Portuguese **pt-BR**)

## 1) App Context
- This appears to be a **developer-tool landing page** for an **open-source i18n solution** (Tyndale).
- Audience: **frontend engineers** (React/Next.js), likely technical decision-makers and individual contributors.
- Content types in sample:
  - Top-nav labels (`Docs`, `GitHub`)
  - Marketing headlines/value props
  - Feature bullets (technical capabilities)
  - Onboarding steps (`Install`, `Initialize`, `Translate`)
  - CTAs (`Get Started`, `Star on GitHub`)
- Product positioning: fast setup, AI-assisted translation workflow, CLI-centric, CI-friendly.

---

## 2) Register & Formality
- Use **Brazilian Portuguese (pt-BR)** with **“você” form** (usually implicit, not written explicitly).
- Preferred style: **direct, action-oriented imperative** for CTAs.
  - Example pattern: `Get Started` → `Comece agora`
- Avoid “tu” forms and avoid overly formal/legal phrasing.

---

## 3) Tone
- **Professional + technical + confident**, with light marketing energy.
- Keep copy:
  - **Concise**
  - **Benefit-led**
  - **Clear for developers**
- Avoid slang-heavy or playful tone.
- Prefer natural product language over literal translation of English idioms.

---

## 4) Term Decisions

### Keep in English (do not translate)
- **Brand/product/proper nouns:** `Tyndale`, `GitHub`, `React`, `Next.js`
- **Code/command tokens:** `JSX`, `CLI`, `CI`, `RTL`, `i18n`, ``tyndale validate``
- **Developer-common shorthand:** `app` (acceptable in pt-BR dev context)

### Translate to Portuguese
- `Open Source` → **código aberto**
- `AI-powered` → **com IA** / **potencializado por IA**
- `Docs` → **Documentação** (preferred for full localization)
- `Get Started` → **Comece agora**
- `View on GitHub` → **Ver no GitHub**
- `Ready to go global?` → **Pronto para levar seu app ao mundo?**

### Preferred renderings for tricky phrases
- `Next.js first-class` → **Suporte de primeira classe para Next.js**
- `Zero-key workflow` → **Fluxo sem arquivos de chave**
- `Ship translated` / `Ship it` → **Publique traduzido** / **Faça o deploy**
- `CI-friendly` → **Compatível com CI**

---

## 5) Patterns

### CTAs
- Use **imperative verbs** (consistent across buttons/hero/steps).
- Keep them short:
  - `Install` → `Instale`
  - `Initialize` → `Inicialize`
  - `Translate` → `Traduza`
  - `See the result` → `Veja o resultado`

### Error Messages (future strings)
- Structure: **What failed + next step**.
- Neutral, non-blaming tone.
- Pattern: `Não foi possível {ação}. Tente novamente.`
- If useful, add actionable context: `... Verifique sua configuração de CI.`

### Empty States (future strings)
- State absence clearly + suggest action.
- Pattern: `Ainda não há {item}.` + CTA
- Example: `Ainda não há traduções. Comece executando o CLI.`

### Confirmations (future strings)
- Short positive confirmation, optionally with result.
- Pattern: `{Ação} concluída com sucesso.`
- Example: `Traduções validadas com sucesso.`

### Questions / Prompt Headlines
- Use short, motivating questions ending with `?`
- Avoid verbose phrasing.
- Example style: `Pronto para globalizar seu app?`

### Micro-style consistency
- Prefer **sentence case** in Portuguese UI (not English title case).
- Keep punctuation minimal in short labels.
- Preserve parallel rhythm in benefit lines:
  - `No key files. No manual translations.` → `Sem arquivos de chave. Sem traduções manuais.`
# Translation Brief — EN → IT

## 1) App Context
- **Tipo di prodotto:** landing page/documentazione marketing per un tool developer-oriented di localizzazione/i18n.
- **Pubblico:** sviluppatori web (React/Next.js), team tecnici, DevOps/CI users.
- **Obiettivo dei testi:** spiegare valore prodotto, feature tecniche e onboarding rapido con CTA brevi.

## 2) Register & Formality
- **Scelta unica:** usare **registro informale (“tu”)**, quasi sempre implicito.
- **Implementazione pratica:** CTA in **imperativo diretto** (es. “Inizia”, “Installa”, “Traduci”).
- **Da evitare:** forma formale “Lei”, costruzioni burocratiche o troppo istituzionali.

## 3) Tone
- **Tono principale:** **tecnico-professionale con taglio marketing**.
- **Caratteristiche:** chiaro, sintetico, sicuro, orientato all’azione e ai benefici.
- **Stile:** frasi brevi, lessico da developer, niente gergo promozionale eccessivo.

## 4) Term Decisions

### Mantieni in inglese (non tradurre)
- **Brand / nomi propri:** `Tyndale`, `GitHub`, `React`, `Next.js`
- **Acronimi / termini tecnici standard:** `i18n`, `CLI`, `JSX`, `RTL`, `CI`
- **Concetti dev molto stabilizzati:** `provider` (quando React-specifico), `middleware` (contesto tecnico), `locale` (contesto i18n)

### Traduci in italiano
- Navigazione/UI generica:  
  - `Docs` → **Documentazione**  
  - `Get Started` → **Inizia**  
  - `View on GitHub` → **Vedi su GitHub**  
  - `See the result` → **Guarda il risultato**
- Messaggi marketing/descrittivi: tradurre completamente, mantenendo i tecnicismi necessari.
- `Open Source`: preferibile **open source** (minuscolo, uso comune in IT), eventualmente “a codice aperto” solo in testi meno tecnici.

### Scelte consigliate su stringhe chiave
- `AI-powered` → **basato sull’AI** / **con AI**
- `CI-friendly` → **compatibile con CI**
- `Next.js first-class` → **supporto di prima classe per Next.js**
- `Zero-key workflow` → **workflow senza file di chiavi**
- `Ship it` → **Pubblica** (evitare traduzioni letterali tipo “Spediscilo”)

## 5) Patterns

### CTA (pulsanti/titoli d’azione)
- **Forma:** imperativo, 1–3 parole, verbo iniziale.
- **Esempi:** `Install` → **Installa**, `Initialize` → **Inizializza**, `Translate` → **Traduci**, `Star on GitHub` → **Metti una stella su GitHub**.

### Messaggi informativi/feature
- Struttura breve “claim + dettaglio tecnico”.
- Evitare calchi rigidi dall’inglese; privilegiare naturalezza italiana mantenendo precisione tecnica.

### Error messages (linea guida)
- **Tono:** neutro, non colpevolizzante.
- **Pattern:** “Impossibile + azione. + passo successivo”.  
  - Es.: “Impossibile completare la traduzione. Riprova.”

### Empty states
- **Tono:** incoraggiante e orientato alla prossima azione.
- **Pattern:** stato + CTA.  
  - Es.: “Nessuna traduzione ancora. Inizia traducendo il tuo primo componente.”

### Confirmations/success
- Brevi e rassicuranti, orientate all’esito.
- Es.: “Fatto”, “Traduzione completata”, “Configurazione pronta”.

### Questions (headline/engagement)
- Domande brevi, dirette, in registro “tu”.
- Es.: `Ready to go global?` → **Pronto a diventare globale?**
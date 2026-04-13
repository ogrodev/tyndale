# Translation Brief — en → fr

## 1) App Context
- **Type d’application**: site marketing/documentation d’un outil développeur (Tyndale) pour l’**internationalisation (i18n)** d’apps **React / Next.js**.
- **Cible**: développeurs, équipes frontend, DevOps (usage CLI, CI, workflow de traduction).
- **Nature des chaînes**: navigation courte (“Docs”), promesses produit (“AI-powered i18n”), étapes d’onboarding (“Install”, “Initialize”), CTA (“Get Started”, “Star on GitHub”).

## 2) Register & Formality
- **Forme retenue**: **registre professionnel avec “vous”** (quand un pronom est nécessaire).
- **Consigne stricte**: ne jamais utiliser **“tu”**.
- Pour les libellés UI courts (boutons/menu), privilégier des formulations neutres (souvent infinitif), tout en restant compatibles avec un ton “vous” dans les phrases complètes.

## 3) Tone
- **Ton principal**: **pro-tech, clair, orienté bénéfices, dynamique mais crédible**.
- **Style**: concis, direct, sans jargon inutile (mais jargon dev accepté quand standard).
- **Éviter**: tournures trop littérales, trop “pub”, ou familières.
- **Objectif ressenti**: rapidité d’adoption (“en quelques minutes”), fiabilité technique, modernité.

## 4) Term Decisions

### A) Termes à conserver en anglais (inchangés)
- **Marque / plateformes / frameworks**: `Tyndale`, `GitHub`, `React`, `Next.js`
- **Acronymes/termes techniques standard**: `i18n`, `CLI`, `JSX`, `RTL`, `CI`
- **Commande CLI exacte**: ``tyndale validate`` (toujours en code, non traduit)
- **Positionnement courant dans la tech**: `open source` (préféré à “code source ouvert” dans ce contexte dev)

### B) Termes à traduire en français
- “AI-powered” → **“propulsé par l’IA”**
- “Get Started” → **“Commencer”**
- “View on GitHub” → **“Voir sur GitHub”**
- “Everything you need for i18n” → **“Tout ce qu’il vous faut pour l’i18n”**
- “Incremental” → **“Incrémental”** (ou “Traduction incrémentale” selon contexte)
- “Rich content” → **“Contenu riche”**
- “Up and running in 5 steps” → **“Prêt en 5 étapes”** / “Mise en route en 5 étapes”

### C) Règles terminologiques complémentaires
- Préférer **“IA”** en français (pas “AI”), sauf élément de marque figé.
- Capitalisation en **casse phrase** en français (pas Title Case systématique).
- Garder les éléments code/produit en monospaced/backticks si possible.

## 5) Patterns de traduction

### CTA (Call-to-Action)
- **Choix recommandé**: **infinitif** pour boutons/libellés courts.
  - Exemples: “Install” → “Installer”, “Initialize” → “Initialiser”, “Translate” → “Traduire”.
- CTA plus marketing: rester bref et orienté action.
  - “See it in action” → “Voir en action”
  - “Star on GitHub” → “Mettre une étoile sur GitHub”

### Messages d’erreur
- Structure: **problème + action possible**, ton neutre, jamais culpabilisant.
- Modèle: “Impossible de + infinitif …” / “Échec de …”.
- Ex.: “Impossible de valider les traductions. Réessayez après avoir vérifié la configuration.”

### Empty states
- Structure: **constat clair + prochaine action**.
- Ex.: “Aucune traduction pour le moment. Lancez la CLI pour générer la première version.”

### Confirmations / succès
- Courtes, factuelles, positives.
- Ex.: “Traductions mises à jour.” / “Validation terminée.”

### Questions
- Courtes, engageantes, sans familiarité.
- Ex.: “Ready to go global?” → **“Prêt à passer à l’international ?”**
- Éviter les formulations ambiguës ou trop idiomatiques.
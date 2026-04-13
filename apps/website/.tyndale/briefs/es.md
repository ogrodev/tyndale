# Translation Brief (en → es)

## 1) App Context
Aplicación **SaaS/dev tool** con enfoque en frontend (React/Next.js) para **internacionalización (i18n) asistida por IA**.  
Los textos parecen de una **landing page de producto open source** con CTAs comerciales y lenguaje técnico para desarrolladores (CLI, CI, JSX, middleware, deployment).

---

## 2) Register & Formality
Usar **tuteo (informal profesional)** de forma consistente:

- Pronombres/posesivos: **tú, tu**
- Verbos en 2.ª persona singular cuando aplique: “tu app”, “empieza”, “ejecuta”
- Evitar “usted” y regionalismos (voseo, modismos locales)

Variante recomendada: **español neutro internacional** (sin localismos de es-ES o es-419).

---

## 3) Tone
**Técnico + marketing directo**, con estos rasgos:

- Claro, breve y orientado a acción
- Seguro y moderno (sin exageraciones vacías)
- Profesional, no burocrático
- Cercano al developer, sin jerga innecesaria

---

## 4) Term Decisions

### Mantener en inglés (no traducir)
- **Tyndale** (marca)
- **GitHub**
- **React**
- **Next.js**
- **JSX**
- **CLI**
- **CI**
- **RTL**
- **i18n** (convención técnica internacional)

### Traducir al español
- “Docs” → **Documentación**
- “Open Source” / “Open-source” → **Código abierto** / **de código abierto**
- “Get Started” → **Comenzar** / **Empezar**
- “View on GitHub” → **Ver en GitHub**
- “Write your app in one language.” → **Escribe tu app en un solo idioma.**
- “Get every language.” → **Llega a todos los idiomas.** (evitar literal forzado)

### Decisiones terminológicas clave
- “AI-powered” → preferible **con IA** (natural en español técnico)
- “first-class” (en “Next.js first-class”) → **integración nativa/completa con Next.js** (no literal “de primera clase” salvo que el estilo global lo acepte)

---

## 5) Patterns

## CTAs
- Para botones/acciones cortas: **infinitivo** (más neutro en UI):  
  - “Install” → **Instalar**  
  - “Initialize” → **Inicializar**  
  - “Translate” → **Traducir**  
  - “See the result” → **Ver el resultado**
- Para claims promocionales en frase completa: tuteo natural (“tu app”, etc.)

## Error messages
- Estilo: **claro, no culpabilizante, accionable**
- Estructura recomendada: **Qué pasó + cómo resolverlo**
- Ejemplo de patrón: “No se pudo validar las traducciones. Vuelve a ejecutar el comando o revisa la configuración del proveedor de IA.”

## Empty states
- Tono útil y motivador, no dramático
- Incluir siguiente paso concreto:
  - “Aún no hay traducciones. Ejecuta la CLI para generar la primera versión.”

## Confirmations
- Breves y específicas:
  - “Traducción completada.”
  - “Validación finalizada sin errores.”

## Questions
- Directas y orientadas a decisión, con signos de apertura:
  - “¿Listo para lanzar tu app globalmente?”
- Evitar ambigüedad y preguntas demasiado coloquiales.

---

### Nota de consistencia
- Mantener **sentence case** en botones/títulos de UI.
- Preservar siglas técnicas y nombres propios exactamente como en origen.
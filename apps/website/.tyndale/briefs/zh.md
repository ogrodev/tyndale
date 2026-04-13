# Translation Brief (en → zh-CN)

## 1) App Context
- **应用类型**：面向开发者的产品官网/文档入口页。  
- **产品定位**：开源、AI 驱动的 i18n（国际化）工具，服务于 **React / Next.js** 应用。  
- **页面目的**：产品价值传达 + 功能卖点 + 快速上手引导 + GitHub 转化（查看、Star、开始使用）。  
- **受众**：前端/全栈开发者、技术团队、开源用户。

---

## 2) Register & Formality（统一风格）
- **统一使用：现代技术语境下的“专业非敬语”**。  
- 人称策略：  
  - 优先使用**省略主语**（如“开始使用”“运行 CLI”）。  
  - 需要人称时使用 **“你”**。  
  - **不使用“您”**（避免过度正式，保持开发者产品语感）。  

---

## 3) Tone
- **主基调**：专业、技术导向、简洁有力。  
- **营销语气**：自信但不夸张，避免空泛口号。  
- **文案节奏**：短句、动词驱动、可执行（尤其在步骤与 CTA 中）。  
- **可读性**：中英混排清晰，术语稳定一致。

---

## 4) Term Decisions（术语策略）

### 4.1 保留英文（品牌/生态/技术缩写）
- **Tyndale**
- **GitHub**
- **React**
- **Next.js**
- **JSX**
- **CLI**
- **CI**
- **RTL**
- **locale / locales**（在开发者语境可保留）
- **Star**（GitHub 动作场景中保留，如“在 GitHub 上 Star”）

### 4.2 建议翻译为中文（通用产品词）
- Docs → **文档**
- Open Source / Open-source → **开源**
- Get Started → **开始使用**
- Install → **安装**
- Initialize → **初始化**
- Translate → **翻译**
- See the result → **查看结果**
- Ready to go global? → **准备好走向全球了吗？**

### 4.3 混合表达（首选形式）
- i18n → **i18n（国际化）**（首次可带中文解释，后续仅 i18n）
- AI-powered → **AI 驱动**
- AI provider → **AI 提供商**
- key files → **key 文件**
- Zero-key workflow → **零 key 工作流**
- static generation → **静态生成**
- middleware / providers → **中间件 / providers**（若上下文偏代码配置，可保留 providers）

### 4.4 风格一致性细则
- 中英文混排时，英文术语前后保留适度空格（如“运行 CLI”）。
- 数字保持阿拉伯数字（如“5 步”）。
- 优先使用简体中文标点与问号“？”。

---

## 5) Patterns（句型与文案模式）

### 5.1 CTA（按钮/链接）
- **使用祈使句**，短促直接，动词开头。  
- 结构：`动词 + 对象`  
- 示例：
  - Get Started → **开始使用**
  - View on GitHub → **前往 GitHub 查看**
  - Star on GitHub → **在 GitHub 上 Star**
  - See it in action → **查看实际效果**

### 5.2 功能卖点/标题
- 采用**名词短语**或**并列短语**，避免长从句。  
- 示例：
  - AI-powered i18n for React & Next.js. → **面向 React 与 Next.js 的 AI 驱动 i18n。**
  - Everything you need for i18n → **i18n 所需，一应俱全**

### 5.3 步骤文案（How-to）
- 使用**动作序列**，每步一个动词。  
- 示例：
  - Write your component. Run the CLI. Ship translated.  
  → **编写组件。运行 CLI。发布多语言版本。**

### 5.4 错误消息（用于后续扩展）
- 语气：冷静、非指责、可操作。  
- 结构：`发生了什么 + 建议操作`  
- 示例模板：  
  - **翻译失败，请检查 AI 提供商配置后重试。**

### 5.5 Empty states（空状态）
- 语气：中性 + 下一步引导。  
- 结构：`当前为空 + 建议动作`  
- 示例模板：  
  - **暂无翻译内容。先运行 CLI 开始生成。**

### 5.6 Confirmations（成功反馈）
- 语气：简短明确，结果导向。  
- 示例模板：  
  - **已完成初始化。**
  - **翻译已更新。**

### 5.7 Questions（提问/转化语）
- 用于营销转化时可保留反问式，但保持自然不过度夸张。  
- 示例：
  - Ready to go global? → **准备好走向全球了吗？**
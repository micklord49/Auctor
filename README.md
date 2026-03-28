# Auctor

Auctor is an AI-powered IDE for writing novels. It’s an Electron desktop app built with Vite + React + TypeScript + Tailwind.

## What it does

- Project-based writing: chapters + worldbuilding files (Characters, Places, Objects, Organisations)
- Import text: ingest a plain text/manuscript file and auto-generate a project structure (chapter files plus initial Characters/Places/Objects/Organisations JSON) with progress feedback
- Chapter editor with tabs: **Text**, **Settings**, and **Critique**
- Subplots: define subplots in Project Settings and mark which ones are active per chapter (in the chapter **Settings** tab)
- Worldbuilding cards show **Mentioned in Chapters**: a clickable list of chapters where that character/place/object/organisation appears (based on `name` + `aka`)
  - Clicking a chapter reference opens the chapter, scrolls to the first occurrence, and highlights the matched text
- AI Assistant panel with streaming responses
- Right-click editor context menu:
  - Standard actions (cut/copy/paste)
  - Formatting (bold/italic)
  - **Refine Text**: opens a dialog to iteratively improve the selected passage while showing the selected text and relevant chapter context
  - AI selection tools:
    - **Rewrite Text**
    - **Make Shorter** (more concise, same voice)
    - **Make Longer** (expand with more detail, using your Characters/Places/Objects for color)
  - While rewriting/shortening/lengthening, the AI chat panel shows a “thinking” bubble (dancing ellipses)
- Critique + paragraph ratings: after running a critique, paragraphs can be colourized (toggleable) based on their rating to help spot weak sections at a glance
- Export to PDF: generate a single PDF from your chapters for sharing/printing

## Quick start

Prereqs: Node.js (recommended: current LTS).

```bash
npm install
npm run dev
```

`npm run dev` starts the Vite dev server and (via `vite-plugin-electron`) runs the Electron main + preload bundles for local development.

To build a packaged app:

```bash
npm run build
```

Note: `npm run build` runs `electron-builder`. On Windows, packaging may require Developer Mode and/or elevated privileges to allow symlink creation during tool extraction.

## Projects and file layout

Auctor stores each novel as a folder on disk. Creating a new project generates:

```
My Novel/
  auctor.json
  .env
  Chapters/
  Characters/
  Places/
  Objects/
  Organisations/
```

- `auctor.json` stores project metadata and settings (theme, font, AI provider selection, etc.).
- `.env` stores API keys for the selected AI provider.
- `Chapters/` contains chapter files (created as `.md`). Auctor treats chapter files as “structured” when they contain `<text>...</text>`, `<settings>...</settings>`, and `<critique>...</critique>` blocks.
- `Characters/`, `Places/`, `Objects/`, `Organisations/` contain JSON files used as reference context.

## Backup and restore

Project backups are configured per project in **View → Project Settings…**.

- **Backup Directory**: where backups are written. Defaults to the project folder.

The **File** menu provides:

- **Backup**: creates a `.zip` in the configured Backup Directory containing the entire project (excluding other backup `.zip` files). The filename includes the project title plus date/time.
- **Restore…**: choose a backup `.zip` from the Backup Directory and restore it over the currently open project (overwriting project files).

## AI providers

AI settings are configured per project in **View → Project Settings…**.

The app currently supports:

- OpenAI (uses `gpt-4-turbo`)
- Google Gemini (model selectable; stored in project settings)
- xAI Grok (via OpenAI-compatible API; uses `grok-beta`)

Keys are saved into the project’s `.env`:

- `OPENAI_API_KEY=...`
- `GOOGLE_GENERATIVE_AI_API_KEY=...`
- `XAI_API_KEY=...`

## Development notes

- Main process code lives under `electron/`.
- Renderer/UI code lives under `src/`.
- The app uses `vite-plugin-electron` to run Electron during development and to bundle `electron/main.ts` and `electron/preload.ts` for production.

## Scripts

- `npm run dev`: start the app in dev mode
- `npm run build`: typecheck + build renderer + build Electron bundles + package with electron-builder
- `npm run preview`: preview the Vite renderer build

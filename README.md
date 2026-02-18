# Auctor

Auctor is an AI-powered IDE for writing novels. It’s an Electron desktop app built with Vite + React + TypeScript + Tailwind.

## What it does

- Project-based writing: chapters + worldbuilding files (Characters, Places, Objects)
- Chapter editor with tabs: **Text**, **Settings**, and **Critique**
- AI Assistant panel with streaming responses
- Right-click editor context menu:
  - Standard actions (cut/copy/paste)
  - Formatting (bold/italic)
  - AI selection tools:
    - **Rewrite Text**
    - **Make Shorter** (more concise, same voice)
    - **Make Longer** (expand with more detail, using your Characters/Places/Objects for color)
  - While rewriting/shortening/lengthening, the AI chat panel shows a “thinking” bubble (dancing ellipses)
- Export to PDF

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
```

- `auctor.json` stores project metadata and settings (theme, font, AI provider selection, etc.).
- `.env` stores API keys for the selected AI provider.
- `Chapters/` contains chapter files (created as `.md`). Auctor treats chapter files as “structured” when they contain `<text>...</text>`, `<settings>...</settings>`, and `<critique>...</critique>` blocks.
- `Characters/`, `Places/`, `Objects/` contain JSON files used as reference context.

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

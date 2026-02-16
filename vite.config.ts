import { defineConfig } from 'vite'
import path from 'node:path'
import electron from 'vite-plugin-electron/simple'
import react from '@vitejs/plugin-react'
import fs from 'node:fs'

// Custom plugin to copy PDFKit fonts
const copyFonts = () => ({
  name: 'copy-fonts',
  closeBundle: () => {
    const src = path.resolve(__dirname, 'node_modules/pdfkit/js/data');
    const dest = path.resolve(__dirname, 'dist-electron/data');
    if (fs.existsSync(src)) {
        fs.cpSync(src, dest, { recursive: true });
        console.log(`[copy-fonts] Copied fonts to ${dest}`);
    } else {
        console.warn(`[copy-fonts] Source not found: ${src}`);
    }
  }
})

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    electron({
      main: {
        // Shortcut of `build.lib.entry`.
        entry: 'electron/main.ts',
        vite: {
          plugins: [ copyFonts() ]
        }
      },
      preload: {
        // Shortcut of `build.rollupOptions.input`.
        // Preload scripts may contain Web assets, so use the `build.rollupOptions.input` instead `build.lib.entry`.
        input: path.join(__dirname, 'electron/preload.ts'),
      },
      // Ployfill the Electron and Node.js API for Renderer process.
      // If you want use Node.js in Renderer process, the `nodeIntegration` needs to be enabled in the Main process.
      // See 👉 https://github.com/electron-vite/vite-plugin-electron-renderer
      renderer: process.env.NODE_ENV === 'test'
        // https://github.com/electron-vite/vite-plugin-electron-renderer/issues/78#issuecomment-2053600808
        ? undefined
        : {},
    }),
  ],
})

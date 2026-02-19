import { app, BrowserWindow, ipcMain, dialog, Menu, MenuItemConstructorOptions } from 'electron'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import fs from 'node:fs/promises'
import { createOpenAI } from '@ai-sdk/openai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { streamText, LanguageModel } from 'ai';
import { config } from 'dotenv';
import PDFDocument from 'pdfkit';
import { createWriteStream } from 'node:fs'; // Use fs directly for streams

// Load environment variables from .env file in the root if it exists
config();

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Global state for current project root. Defaults to Documents/AuctorProject if not set.
let PROJECT_ROOT = path.join(app.getPath('documents'), 'AuctorProject')
let win: BrowserWindow | null
let isEditorSelected = false
const RECENT_PROJECTS_FILE = path.join(app.getPath('userData'), 'recent_projects.json');

type AuctorConfig = {
    settings?: {
        chapterOrder?: string[];
        [key: string]: any;
    };
    [key: string]: any;
};

// Ensure project root exists
fs.mkdir(PROJECT_ROOT, { recursive: true }).catch(console.error)

// --- Recent Projects Logic ---
async function getRecentProjects(): Promise<string[]> {
    try {
        const data = await fs.readFile(RECENT_PROJECTS_FILE, 'utf-8');
        return JSON.parse(data);
    } catch {
        return [];
    }
}

async function addToRecentProjects(projectPath: string) {
    let recent = await getRecentProjects();
    recent = [projectPath, ...recent.filter(p => p !== projectPath)].slice(0, 10);
    await fs.writeFile(RECENT_PROJECTS_FILE, JSON.stringify(recent), 'utf-8');
    updateMenu();
}

async function loadProject(projectPath: string) {
    PROJECT_ROOT = projectPath;
    await addToRecentProjects(projectPath);
    if (win) {
        win.reload();
    }
}

async function readAuctorConfig(): Promise<AuctorConfig> {
    const auctorPath = path.join(PROJECT_ROOT, 'auctor.json');
    try {
        const data = await fs.readFile(auctorPath, 'utf-8');
        return JSON.parse(data);
    } catch {
        return {};
    }
}

async function writeAuctorConfig(configData: AuctorConfig) {
    const auctorPath = path.join(PROJECT_ROOT, 'auctor.json');
    await fs.writeFile(auctorPath, JSON.stringify(configData, null, 2), 'utf-8');
}

async function getChapterOrder(): Promise<string[]> {
    const configData = await readAuctorConfig();
    return Array.isArray(configData.settings?.chapterOrder)
        ? configData.settings!.chapterOrder.filter(name => typeof name === 'string')
        : [];
}

async function setChapterOrder(order: string[]) {
    const normalizedOrder = Array.from(new Set(order.filter(name => typeof name === 'string' && name.trim().length > 0)));
    const configData = await readAuctorConfig();
    configData.settings = configData.settings || {};
    configData.settings.chapterOrder = normalizedOrder;
    await writeAuctorConfig(configData);
}

// --- Menu Logic ---
async function updateMenu() {
    const recentProjects = await getRecentProjects();
    
    const recentMenu: MenuItemConstructorOptions[] = recentProjects.map(path => ({
        label: path,
        click: () => loadProject(path)
    }));

    const editSubmenu: MenuItemConstructorOptions[] = [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' }
    ];

    if (isEditorSelected) {
        editSubmenu.push(
            { type: 'separator' },
            {
                label: 'Find...',
                accelerator: 'CmdOrCtrl+F',
                click: () => {
                    if (win) {
                        win.webContents.send('editor-find');
                    }
                }
            },
            {
                label: 'Find Next',
                accelerator: 'F3',
                click: () => {
                    if (win) {
                        win.webContents.send('editor-find-next');
                    }
                }
            },
            {
                label: 'Find Previous',
                accelerator: 'Shift+F3',
                click: () => {
                    if (win) {
                        win.webContents.send('editor-find-previous');
                    }
                }
            },
            {
                label: 'Replace...',
                accelerator: 'CmdOrCtrl+H',
                click: () => {
                    if (win) {
                        win.webContents.send('editor-replace');
                    }
                }
            },
            {
                label: 'Replace In Selection',
                accelerator: 'CmdOrCtrl+Shift+H',
                click: () => {
                    if (win) {
                        win.webContents.send('editor-replace-selection');
                    }
                }
            }
        );
    }

    const template: MenuItemConstructorOptions[] = [
        {
            label: 'File',
            submenu: [
                {
                    label: 'New Project...',
                    accelerator: 'CmdOrCtrl+N',
                    click: () => {
                        console.log("Main: New Project menu clicked");
                        if (win) {
                            console.log("Main: Sending new-project event");
                            win.webContents.send('new-project');
                        } else {
                            console.error("Main: Window is null!");
                        }
                    }
                },
                {
                    label: 'Open Project...',
                    accelerator: 'CmdOrCtrl+O',
                    click: async () => {
                        if (!win) return;
                        const result = await dialog.showOpenDialog(win, {
                            properties: ['openDirectory']
                        });
                        if (!result.canceled && result.filePaths.length > 0) {
                            loadProject(result.filePaths[0]);
                        }
                    }
                },
                {
                   label: 'Export to PDF...',
                   click: async () => {
                       if (win) {
                           await exportToPDF(win);
                       }
                   }
                },
                {
                    label: 'Save',
                    accelerator: 'CmdOrCtrl+S',
                    click: () => {
                        if (win) win.webContents.send('save-current-file');
                    }
                },
                {
                    label: 'Open Recent',
                    submenu: recentMenu.length > 0 ? recentMenu : [{ label: 'No Recent Projects', enabled: false }]
                },
                { type: 'separator' },
                { role: 'quit' }
            ]
        },
        {
            label: 'Edit',
            submenu: editSubmenu
        },
        {
            label: 'View',
            submenu: [
                { role: 'reload' },
                { role: 'forceReload' },
                { role: 'toggleDevTools' },
                { type: 'separator' },
                { role: 'resetZoom' },
                { role: 'zoomIn' },
                { role: 'zoomOut' },
                { type: 'separator' },
                { 
                   label: 'Project Settings...',
                   click: () => {
                       if (win) win.webContents.send('open-settings');
                   }
                },
                { type: 'separator' },
                { role: 'togglefullscreen' }
            ]
        }
    ];

    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
}

ipcMain.on('editor-selected-changed', (_, isSelected: boolean) => {
    if (isEditorSelected === isSelected) {
        return;
    }

    isEditorSelected = isSelected;
    updateMenu().catch(console.error);
});

// --- IPC Handlers ---
ipcMain.handle('select-directory', async () => {
  const result = await dialog.showOpenDialog(win!, {
    properties: ['openDirectory']
  });
  if (!result.canceled && result.filePaths.length > 0) {
    return result.filePaths[0];
  }
  return null;
});

ipcMain.handle('create-project', async (_, projectData: { name: string; location: string; overview: string }) => {
  try {
    const projectPath = path.join(projectData.location, projectData.name);
    
    // 1. Create Subdirectories
    await fs.mkdir(path.join(projectPath, 'Chapters'), { recursive: true });
    await fs.mkdir(path.join(projectPath, 'Characters'), { recursive: true });
    await fs.mkdir(path.join(projectPath, 'Places'), { recursive: true });
    await fs.mkdir(path.join(projectPath, 'Objects'), { recursive: true });

    // 2. Create Project Settings JSON
    const settings = {
      name: projectData.name,
      overview: projectData.overview,
      createdAt: new Date().toISOString(),
      version: '1.0.0',
      settings: {
        theme: 'dark',
        fontFamily: 'sans-serif',
                fontSize: 16,
                chapterOrder: []
      }
    };
    await fs.writeFile(path.join(projectPath, 'auctor.json'), JSON.stringify(settings, null, 2), 'utf-8');

    // 2.5 Create .env file
    await fs.writeFile(path.join(projectPath, '.env'), 'OPENAI_API_KEY=', 'utf-8');

    // 3. Update Global Project Root
    PROJECT_ROOT = projectPath;
    await addToRecentProjects(projectPath);

    return { success: true, path: projectPath };
  } catch (error) {
    console.error('Error creating project:', error);
    return { success: false, error: String(error) };
  }
});

ipcMain.handle('get-files', async () => {
    try {
        const categories = ['Chapters', 'Characters', 'Places', 'Objects'];
        let allFiles: any[] = [];

        for (const category of categories) {
            const dirPath = path.join(PROJECT_ROOT, category);
            // Ensure directory exists
            await fs.mkdir(dirPath, { recursive: true });
            
            const files = await fs.readdir(dirPath);
            const categoryFiles = files.map(f => ({
                name: f,
                path: path.join(category, f),
                category: category, 
                isDirectory: false 
            }));
            
            allFiles = [...allFiles, ...categoryFiles];
        }

        return allFiles;
    } catch (error) {
        console.error('Error reading files:', error)
        return []
    }
})

ipcMain.handle('get-chapter-order', async () => {
    try {
        const chaptersDir = path.join(PROJECT_ROOT, 'Chapters');
        await fs.mkdir(chaptersDir, { recursive: true });
        const chapterFiles = await fs.readdir(chaptersDir);
        const chapterFileSet = new Set(chapterFiles);

        const savedOrder = await getChapterOrder();
        const orderedExisting = savedOrder.filter(file => chapterFileSet.has(file));
        const unorderedExisting = chapterFiles.filter(file => !orderedExisting.includes(file)).sort((a, b) => a.localeCompare(b));
        const normalized = [...orderedExisting, ...unorderedExisting];

        if (normalized.length !== savedOrder.length || normalized.some((name, idx) => name !== savedOrder[idx])) {
            await setChapterOrder(normalized);
        }

        return { success: true, order: normalized };
    } catch (error) {
        console.error('Error getting chapter order:', error);
        return { success: false, order: [], error: String(error) };
    }
});

ipcMain.handle('set-chapter-order', async (_, order: string[]) => {
    try {
        if (!Array.isArray(order)) {
            return { success: false, error: 'Order must be an array of chapter file names.' };
        }

        const chaptersDir = path.join(PROJECT_ROOT, 'Chapters');
        await fs.mkdir(chaptersDir, { recursive: true });
        const chapterFiles = await fs.readdir(chaptersDir);
        const chapterFileSet = new Set(chapterFiles);

        const filteredProvided = Array.from(new Set(order)).filter(name => chapterFileSet.has(name));
        const missing = chapterFiles.filter(name => !filteredProvided.includes(name)).sort((a, b) => a.localeCompare(b));
        const normalized = [...filteredProvided, ...missing];

        await setChapterOrder(normalized);
        return { success: true, order: normalized };
    } catch (error) {
        console.error('Error setting chapter order:', error);
        return { success: false, error: String(error) };
    }
});

ipcMain.handle('create-file', async (_, fileName: string, content: string = '', category: string = 'Chapters') => {
    try {
        const filePath = path.join(PROJECT_ROOT, category, fileName);
        await fs.writeFile(filePath, content, 'utf-8')

        if (category === 'Chapters') {
            const currentOrder = await getChapterOrder();
            if (!currentOrder.includes(fileName)) {
                await setChapterOrder([...currentOrder, fileName]);
            }
        }

        return { success: true, path: filePath }
    } catch (error) {
        console.error('Error creating file:', error)
        return { success: false, error: String(error) }
    }
})

ipcMain.handle('delete-file', async (_, fileName: string, category: string) => {
    try {
        // If category is provided, use it. Otherwise fallback to scan (for backward compat if needed, but UI should provide it)
        if (category) {
            const filePath = path.join(PROJECT_ROOT, category, fileName);
            await fs.unlink(filePath);

            if (category === 'Chapters') {
                const currentOrder = await getChapterOrder();
                await setChapterOrder(currentOrder.filter(name => name !== fileName));
            }

            return { success: true };
        }
        
        // Fallback scan (legacy)
        const categories = ['Chapters', 'Characters', 'Places', 'Objects'];
        for (const cat of categories) {
             try {
                 await fs.unlink(path.join(PROJECT_ROOT, cat, fileName));
                 return { success: true };
             } catch {}
        }

        throw new Error('File not found');
    } catch (error) {
         console.error('Error deleting file:', error)
         return { success: false, error: String(error) }
    }
})

ipcMain.handle('rename-file', async (_, oldName: string, newName: string, category: string) => {
     try {
        // If category is provided
        const subfolder = category || (oldName.endsWith('.json') ? 'Characters' : 'Chapters');
        
        const oldPath = path.join(PROJECT_ROOT, subfolder, oldName);
        const newPath = path.join(PROJECT_ROOT, subfolder, newName); // stay in same folder
        await fs.rename(oldPath, newPath)

        if (subfolder === 'Chapters') {
            const currentOrder = await getChapterOrder();
            const renamedOrder = currentOrder.map(name => name === oldName ? newName : name);
            if (!renamedOrder.includes(newName)) {
                renamedOrder.push(newName);
            }
            await setChapterOrder(renamedOrder);
        }

        return { success: true }
    } catch (error) {
        console.error('Error renaming file:', error)
        return { success: false, error: String(error) }
    }
})

ipcMain.handle('read-file', async (_, relativePath: string) => {
    try {
        const filePath = path.join(PROJECT_ROOT, relativePath);
        const content = await fs.readFile(filePath, 'utf-8');
        return { success: true, content };
    } catch (error) {
        console.error('Error reading file:', error);
        return { success: false, error: String(error) };
    }
});

ipcMain.handle('get-project-settings', async () => {
    try {
        const auctorPath = path.join(PROJECT_ROOT, 'auctor.json');
        const envPath = path.join(PROJECT_ROOT, '.env');

        // Read auctor.json
        const auctorContent = await fs.readFile(auctorPath, 'utf-8');
        const auctorData = JSON.parse(auctorContent);

        // Read .env
        let apiKey = '';
        let googleApiKey = '';
        let xaiApiKey = '';
        try {
            const envContent = await fs.readFile(envPath, 'utf-8');
            
            const matchOpenAI = envContent.match(/OPENAI_API_KEY=(.*)/);
            if (matchOpenAI) apiKey = matchOpenAI[1].trim();

            const matchGoogle = envContent.match(/GOOGLE_GENERATIVE_AI_API_KEY=(.*)/);
            if (matchGoogle) googleApiKey = matchGoogle[1].trim();

            const matchXAI = envContent.match(/XAI_API_KEY=(.*)/);
            if (matchXAI) xaiApiKey = matchXAI[1].trim();

        } catch {
            // env might not exist, that's fine
        }

        return {
            success: true,
            settings: {
                theme: auctorData.settings?.theme || 'dark', // default fallbacks
                fontFamily: auctorData.settings?.fontFamily || 'sans-serif',
                fontSize: auctorData.settings?.fontSize || 16,
                aiProvider: auctorData.settings?.aiProvider || 'openai',
                googleModel: auctorData.settings?.googleModel || 'models/gemini-2.0-flash-exp',
                apiKey,
                googleApiKey,
                xaiApiKey
            }
        };
    } catch (error) {
        console.error('Error getting settings:', error);
        return { success: false, error: String(error) };
    }
});

ipcMain.handle('save-project-settings', async (_, newSettings: any) => {
    try {
        const auctorPath = path.join(PROJECT_ROOT, 'auctor.json');
        const envPath = path.join(PROJECT_ROOT, '.env');

        // Update auctor.json
        const auctorContent = await fs.readFile(auctorPath, 'utf-8');
        const auctorData = JSON.parse(auctorContent);
        
        auctorData.settings = {
            theme: newSettings.theme,
            fontFamily: newSettings.fontFamily,
            fontSize: newSettings.fontSize,
            aiProvider: newSettings.aiProvider,
            googleModel: newSettings.googleModel
        };
        await fs.writeFile(auctorPath, JSON.stringify(auctorData, null, 2), 'utf-8');

        // Update .env
        let envContent = '';
        try {
            envContent = await fs.readFile(envPath, 'utf-8');
        } catch {}

        const updateEnvVar = (key: string, value: string) => {
            const regex = new RegExp(`${key}=(.*)`);
            if (envContent.match(regex)) {
                envContent = envContent.replace(regex, `${key}=${value}`);
            } else {
                envContent += `\n${key}=${value}`;
            }
        };

        updateEnvVar('OPENAI_API_KEY', newSettings.apiKey || '');
        updateEnvVar('GOOGLE_GENERATIVE_AI_API_KEY', newSettings.googleApiKey || '');
        updateEnvVar('XAI_API_KEY', newSettings.xaiApiKey || '');

        await fs.writeFile(envPath, envContent.trim(), 'utf-8');
        
        // Update process env for immediate use
        process.env.OPENAI_API_KEY = newSettings.apiKey;
        process.env.GOOGLE_GENERATIVE_AI_API_KEY = newSettings.googleApiKey;
        process.env.XAI_API_KEY = newSettings.xaiApiKey;

        return { success: true };
    } catch (error) {
        console.error('Error saving settings:', error);
        return { success: false, error: String(error) };
    }
});

ipcMain.handle('save-file', async (_, relativePath: string, content: string) => {
    try {
        const filePath = path.join(PROJECT_ROOT, relativePath);
        await fs.writeFile(filePath, content, 'utf-8');
        return { success: true };
    } catch (error) {
        console.error('Error saving file:', error);
        return { success: false, error: String(error) };
    }
});

// --- AI Handlers ---
ipcMain.handle('list-google-models', async (_, apiKey: string) => {
    try {
        if (!apiKey) {
            // Try to load from env if not provided
            const envPath = path.join(PROJECT_ROOT, '.env');
            try {
                const envContent = await fs.readFile(envPath, 'utf-8');
                const match = envContent.match(/GOOGLE_GENERATIVE_AI_API_KEY=(.*)/);
                if (match) apiKey = match[1].trim();
            } catch {}
        }

        if (!apiKey) throw new Error('API Key is missing');

        const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
        const response = await fetch(url);
        
        if (!response.ok) {
             const errorText = await response.text();
             throw new Error(`Google API Error: ${response.status} ${errorText}`);
        }

        const data = await response.json();
        // Filter for models that support content generation
        const models = (data.models || [])
             .filter((m: any) => m.supportedGenerationMethods?.includes('generateContent'))
             .map((m: any) => ({
                 id: m.name, // e.g. "models/gemini-1.5-pro"
                 name: m.displayName || m.name
             }));

        return { success: true, models };
    } catch (error) {
        console.error('Error listing google models:', error);
        return { success: false, error: String(error) };
    }
});

ipcMain.on('generate-ai-completion', async (event, { prompt }) => {
  try {
    // Determine provider from settings
    let provider = 'openai';
    let apiKey = '';
    let googleApiKey = '';
    let xaiApiKey = '';
    let googleModel = 'models/gemini-1.5-flash'; // Default

    try {
        const auctorPath = path.join(PROJECT_ROOT, 'auctor.json');
        const auctorContent = await fs.readFile(auctorPath, 'utf-8');
        const auctorData = JSON.parse(auctorContent);
        provider = auctorData.settings?.aiProvider || 'openai';
        if (auctorData.settings?.googleModel) {
            googleModel = auctorData.settings.googleModel;
        }

        // Load keys from .env directly to ensure we have latest even if app restarted
        const envPath = path.join(PROJECT_ROOT, '.env');
        const envContent = await fs.readFile(envPath, 'utf-8');
        
        const matchOpenAI = envContent.match(/OPENAI_API_KEY=(.*)/);
        if (matchOpenAI) apiKey = matchOpenAI[1].trim();

        const matchGoogle = envContent.match(/GOOGLE_GENERATIVE_AI_API_KEY=(.*)/);
        if (matchGoogle) googleApiKey = matchGoogle[1].trim();

        const matchXAI = envContent.match(/XAI_API_KEY=(.*)/);
        if (matchXAI) xaiApiKey = matchXAI[1].trim();

    } catch (e) {
        console.warn("Could not read settings for AI provider, defaulting to OpenAI", e);
    }

    let model: LanguageModel;

    switch (provider) {
        case 'google':
             // Explicitly create google provider with key
             const googleProvider = createGoogleGenerativeAI({
                 apiKey: googleApiKey || process.env.GOOGLE_GENERATIVE_AI_API_KEY
             });
            // Ensure model has 'models/' prefix if not present (though our list logic adds it or keeps it)
            if (!googleModel.startsWith('models/')) googleModel = `models/${googleModel}`; 
            
            model = googleProvider(googleModel);
            break;
        case 'xai':
             // Grok (xAI) via OpenAI compatible interface
             const xai = createOpenAI({
                name: 'xai',
                baseURL: 'https://api.x.ai/v1',
                apiKey: xaiApiKey || process.env.XAI_API_KEY,
            });
            model = xai('grok-beta');
            break;
        case 'openai':
        default:
            const openaiProvider = createOpenAI({
                apiKey: apiKey || process.env.OPENAI_API_KEY
            });
            model = openaiProvider('gpt-4-turbo');
            break;
    }

    const result = await streamText({
      model: model, 
      prompt: prompt,
    });

    for await (const textPart of result.textStream) {
      event.sender.send('ai-completion-chunk', textPart);
    }
    event.sender.send('ai-completion-end');
  } catch (error) {
    console.error("AI Error:", error);
    event.sender.send('ai-completion-error', String(error));
  }
});

ipcMain.on('rewrite-text-completion', async (event, { prompt }) => {
    try {
    event.sender.send('rewrite-text-start');
      // Determine provider from settings (Reuse logic, ideally this should be a helper function)
      let provider = 'openai';
      let apiKey = '';
      let googleApiKey = '';
      let xaiApiKey = '';
      let googleModel = 'models/gemini-1.5-flash';
  
      try {
          const auctorPath = path.join(PROJECT_ROOT, 'auctor.json');
          const auctorContent = await fs.readFile(auctorPath, 'utf-8');
          const auctorData = JSON.parse(auctorContent);
          provider = auctorData.settings?.aiProvider || 'openai';
          if (auctorData.settings?.googleModel) {
              googleModel = auctorData.settings.googleModel;
          }
  
          const envPath = path.join(PROJECT_ROOT, '.env');
          const envContent = await fs.readFile(envPath, 'utf-8');
          
          const matchOpenAI = envContent.match(/OPENAI_API_KEY=(.*)/);
          if (matchOpenAI) apiKey = matchOpenAI[1].trim();
  
          const matchGoogle = envContent.match(/GOOGLE_GENERATIVE_AI_API_KEY=(.*)/);
          if (matchGoogle) googleApiKey = matchGoogle[1].trim();
  
          const matchXAI = envContent.match(/XAI_API_KEY=(.*)/);
          if (matchXAI) xaiApiKey = matchXAI[1].trim();
  
      } catch (e) {
          console.warn("Could not read settings for AI provider, defaulting to OpenAI", e);
      }
  
      let model: LanguageModel;
  
      switch (provider) {
          case 'google':
               const googleProvider = createGoogleGenerativeAI({
                   apiKey: googleApiKey || process.env.GOOGLE_GENERATIVE_AI_API_KEY
               });
              if (!googleModel.startsWith('models/')) googleModel = `models/${googleModel}`; 
              model = googleProvider(googleModel);
              break;
          case 'xai':
               const xai = createOpenAI({
                  name: 'xai',
                  baseURL: 'https://api.x.ai/v1',
                  apiKey: xaiApiKey || process.env.XAI_API_KEY,
              });
              model = xai('grok-beta');
              break;
          case 'openai':
          default:
              const openaiProvider = createOpenAI({
                  apiKey: apiKey || process.env.OPENAI_API_KEY
              });
              model = openaiProvider('gpt-4-turbo');
              break;
      }
  
      const result = await streamText({
        model: model, 
        prompt: prompt,
      });
  
      for await (const textPart of result.textStream) {
        event.sender.send('rewrite-text-chunk', textPart);
      }
      event.sender.send('rewrite-text-end');
    } catch (error) {
      console.error("AI Error:", error);
      event.sender.send('rewrite-text-error', String(error));
    }
  });




// The built directory structure
//
// ├─┬─┬ dist
// │ │ └── index.html
// │ │
// │ ├─┬ dist-electron
// │ │ ├── main.js
// │ │ └── preload.mjs
// │
process.env.APP_ROOT = path.join(__dirname, '..')

// 🚧 Use ['ENV_NAME'] avoid vite:define plugin - Vite@2.x
export const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']
export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, 'public') : RENDERER_DIST

// win variable is declared at top level

async function createWindow() {
  // Load most recent project if exists
  const recent = await getRecentProjects();
  if(recent.length > 0) {
      PROJECT_ROOT = recent[0];
  }
  await updateMenu();

  win = new BrowserWindow({
    icon: path.join(process.env.VITE_PUBLIC, 'electron-vite.svg'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  })

  // Test active push message to Renderer-process.
  win.webContents.on('did-finish-load', () => {
    win?.webContents.send('main-process-message', (new Date).toLocaleString())
  })

    // Context Menu
    win.webContents.on('context-menu', (_, params) => {
        const menuTemplate: MenuItemConstructorOptions[] = [];

        // Spell Check
        if (params.misspelledWord) {
            menuTemplate.push({
                label: '➕ Add to Dictionary',
                click: () => win?.webContents.session.addWordToSpellCheckerDictionary(params.misspelledWord),
            });

            if (params.dictionarySuggestions.length > 0) {
                menuTemplate.push({ type: 'separator' });
                params.dictionarySuggestions.forEach((suggestion) => {
                    menuTemplate.push({
                        label: suggestion,
                        click: () => win?.webContents.replaceMisspelling(suggestion),
                    });
                });
            }
            menuTemplate.push({ type: 'separator' });
        }

        // Standard Editing
        menuTemplate.push(
            { role: 'cut', label: '✂️ Cut' },
            { role: 'copy', label: '📋 Copy' },
            { role: 'paste', label: '📎 Paste' },
            { type: 'separator' }
        );

        // Formatting (only if editable)
        if (params.isEditable) {
            menuTemplate.push(
                {
                    label: '𝐁  Bold',
                    click: () => win?.webContents.send('format-bold'),
                },
                {
                    label: '𝐼  Italic',
                    click: () => win?.webContents.send('format-italic'),
                }
            );

            // Rewrite Selection (only if text is selected)
            if (params.selectionText.trim().length > 0) {
                 menuTemplate.push({ type: 'separator' });
                 menuTemplate.push({
                     label: '✨ Rewrite Text',
                     click: () => win?.webContents.send('rewrite-selection'),
                 });

                 menuTemplate.push({
                     label: '✂️ Make Shorter',
                     click: () => win?.webContents.send('make-shorter-selection'),
                 });

                 menuTemplate.push({
                     label: '➕ Make Longer',
                     click: () => win?.webContents.send('make-longer-selection'),
                 });
            }
        }

        const menu = Menu.buildFromTemplate(menuTemplate);
        menu.popup({ window: win || undefined });
    });

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL)
  } else {
    // win.loadFile('dist/index.html')
    win.loadFile(path.join(RENDERER_DIST, 'index.html'))
  }
}

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
    win = null
  }
})

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

app.whenReady().then(() => {
    createWindow();
    // updateMenu call moved inside createWindow
});

// ... (previous functions)

async function exportToPDF(window: BrowserWindow) {
    const { filePath } = await dialog.showSaveDialog(window, {
        title: 'Export Novel to PDF',
        defaultPath: 'novel.pdf',
        filters: [{ name: 'PDF Document', extensions: ['pdf'] }]
    });

    if (!filePath) return;

    try {
        // 1. Get Project Metadata
        let title = "Untitled Novel";
        try {
            const auctorPath = path.join(PROJECT_ROOT, 'auctor.json');
            const data = JSON.parse(await fs.readFile(auctorPath, 'utf-8'));
            if (data.name) title = data.name;
        } catch (e) {
            console.error("No project metadata found, using default.");
        }

        // 2. Get Chapters
        const chaptersDir = path.join(PROJECT_ROOT, 'Chapters');
        let chapterFiles: string[] = [];
        try {
            chapterFiles = await fs.readdir(chaptersDir);
        } catch {
            dialog.showErrorBox("Export Failed", "Could not find Chapters directory.");
            return;
        }

        // Filter and sort
        chapterFiles = chapterFiles.filter(f => f.endsWith('.md') || f.endsWith('.txt')).sort((a,b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));

        if (chapterFiles.length === 0) {
            dialog.showErrorBox("Export Failed", "No chapters found to export.");
            return;
        }

        // 3. Setup PDF
        const doc = new PDFDocument({ bufferPages: true, autoFirstPage: false, size: 'A4', margin: 50 });
        const stream = createWriteStream(filePath);
        doc.pipe(stream);

        // --- Title Page ---
        doc.addPage();
        doc.moveDown(10);
        doc.font('Helvetica-Bold').fontSize(32).text(title, { align: 'center' });
        doc.moveDown(2);
        doc.font('Helvetica').fontSize(14).text("A Novel", { align: 'center' });
        
        // --- Table of Contents Placeholder ---
        doc.addPage();
        const tocInfo = {
             pageIndex: 1 // 0-based index of this TOC page
        };
        doc.font('Helvetica-Bold').fontSize(18).text("Table of Contents", { align: 'center', underline: true });
        doc.moveDown(2);
        
        // --- Content ---
        const tocEntries: string[] = [];
        
        for (const file of chapterFiles) {
            const contentPath = path.join(chaptersDir, file);
            const rawContent = await fs.readFile(contentPath, 'utf-8');
            
            // Extract Text part
            let text = rawContent;
            const textMatch = rawContent.match(/<text>([\s\S]*?)<\/text>/);
            if (textMatch) {
                text = textMatch[1].trim();
            }

            // Strip HTML tags
            let plainText = text
                .replace(/<\/p>/g, '\n\n')
                .replace(/<br\s*\/?>/g, '\n')
                .replace(/<[^>]+>/g, '') // remove remaining tags
                .replace(/&nbsp;/g, ' ')
                .replace(/&amp;/g, '&')
                .replace(/&lt;/g, '<')
                .replace(/&gt;/g, '>')
                .replace(/&quot;/g, '"');

            // Add Page for Chapter
            doc.addPage();
            
            // Format Title
            const chapterTitle = file.replace(/\.(md|txt)$/, '');
            tocEntries.push(chapterTitle);

            doc.font('Helvetica-Bold').fontSize(18).text(chapterTitle, { align: 'center' });
            doc.moveDown();
            doc.font('Helvetica').fontSize(12).text(plainText, { align: 'justify', lineGap: 2 });
        }

        // 4. Fill TOC (Go back to page 2)
        doc.switchToPage(tocInfo.pageIndex); 
        doc.font('Helvetica').fontSize(12);
        
        tocEntries.forEach((title, index) => {
             doc.text(`${index + 1}. ${title}`, { align: 'left' });
             doc.moveDown(0.5);
        });
        
        // 5. Finalize
        doc.end();
        
        // Simple manual Promise wrapper for stream finish
        await new Promise<void>((resolve, reject) => {
            stream.on('finish', () => resolve());
            stream.on('error', reject);
        });
        
        dialog.showMessageBox(window, { 
            type: 'info', 
            title: 'Export Successful', 
            message: `Successfully exported to ${filePath}` 
        });

    } catch (e) {
        console.error(e);
        dialog.showErrorBox("Export Error", String(e));
    }
}


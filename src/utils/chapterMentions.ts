type FileItem = {
  name: string;
  path: string;
  category: string;
};

type ChapterRef = {
  name: string;
  path: string;
};

const uniq = (items: string[]) => Array.from(new Set(items));

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const splitAliases = (aka: string | undefined | null): string[] => {
  if (!aka) return [];
  return aka
    .split(/[,\n;]/g)
    .map((t) => t.trim())
    .filter(Boolean);
};

const buildTermMatchers = (terms: string[]): RegExp[] => {
  const cleaned = uniq(
    terms
      .map((t) => (t ?? '').trim())
      .filter((t) => t.length > 0)
  );

  // Word-ish boundaries: don't match inside larger tokens.
  // Uses unicode-aware letters/numbers.
  return cleaned.map((term) => {
    const escaped = escapeRegExp(term);
    return new RegExp(`(?<![\\p{L}\\p{N}_])${escaped}(?![\\p{L}\\p{N}_])`, 'iu');
  });
};

const extractChapterPlainText = (raw: string): string => {
  let text = raw;
  const match = raw.match(/<text>([\s\S]*?)<\/text>/i);
  if (match) text = match[1];

  text = text
    .replace(/<\s*\/p\s*>/gi, '\n\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');

  return text;
};

async function getAllFiles(): Promise<FileItem[]> {
  // @ts-ignore
  const files: FileItem[] = await window.ipcRenderer.invoke('get-files');
  return Array.isArray(files) ? files : [];
}

async function readFile(relativePath: string): Promise<string | null> {
  try {
    // @ts-ignore
    const res = await window.ipcRenderer.invoke('read-file', relativePath);
    if (!res?.success) return null;
    return String(res.content ?? '');
  } catch {
    return null;
  }
}

async function getChapterOrder(): Promise<string[] | null> {
  try {
    // @ts-ignore
    const res = await window.ipcRenderer.invoke('get-chapter-order');
    if (!res?.success || !Array.isArray(res.order)) return null;
    return res.order.filter((x: any) => typeof x === 'string');
  } catch {
    return null;
  }
}

const sortChapters = async (chapters: ChapterRef[]): Promise<ChapterRef[]> => {
  const order = await getChapterOrder();
  if (!order || order.length === 0) {
    return [...chapters].sort((a, b) => a.name.localeCompare(b.name));
  }

  const pos = new Map(order.map((name, idx) => [name, idx]));
  return [...chapters].sort((a, b) => {
    const aPos = pos.get(a.name);
    const bPos = pos.get(b.name);
    if (aPos !== undefined && bPos !== undefined) return aPos - bPos;
    if (aPos !== undefined) return -1;
    if (bPos !== undefined) return 1;
    return a.name.localeCompare(b.name);
  });
};

export async function findChaptersWhereMentioned(entityName: string, entityAka?: string): Promise<ChapterRef[]> {
  const terms = uniq([entityName, ...splitAliases(entityAka)]).filter(Boolean);
  const matchers = buildTermMatchers(terms);
  if (matchers.length === 0) return [];

  const files = await getAllFiles();
  const chapters = files
    .filter((f) => f.category === 'Chapters' && typeof f.path === 'string' && typeof f.name === 'string')
    .map((f) => ({ name: f.name, path: f.path }));

  const ordered = await sortChapters(chapters);

  const results: ChapterRef[] = [];
  for (const chapter of ordered) {
    const raw = await readFile(chapter.path);
    if (!raw) continue;

    const text = extractChapterPlainText(raw);
    if (matchers.some((re) => re.test(text))) {
      results.push(chapter);
    }
  }

  return results;
}

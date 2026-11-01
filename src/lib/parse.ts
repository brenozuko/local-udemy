export interface JsonlEntry {
  lesson?: number;
  tag?: string;
  text?: string;
  media_type?: string;
  media_filename?: string;
}

export interface ModuleFolderInfo {
  order: number;
  title: string;
}

/** "02 - Módulo 0 - Bem-vindo à AUVP Escola" -> { order: 2, title: "Módulo 0 - Bem-vindo à AUVP Escola" } */
export function parseModuleFolder(name: string): ModuleFolderInfo | null {
  const m = name.normalize("NFC").match(/^(\d+)\s*-\s*(.+)$/);
  if (!m) return null;
  return { order: Number(m[1]), title: m[2].trim() };
}

export interface LessonFileInfo {
  order: number;
  tag: string | null;
  fallbackTitle: string;
}

/** "001_F001 - Aula 00 - Boas-vindas....mp4" -> order 1, tag F001, title from remainder */
export function parseLessonFilename(name: string): LessonFileInfo {
  const normalized = name.normalize("NFC");
  const base = normalized.replace(/\.[^.]+$/, "");
  const m = base.match(/^(\d+)_(\w+)\s*-\s*(.+)$/);
  if (m) {
    return { order: Number(m[1]), tag: m[2], fallbackTitle: m[3].trim() };
  }
  const n = base.match(/^(\d+)[_\s-]+(.+)$/);
  if (n) {
    return { order: Number(n[1]), tag: null, fallbackTitle: n[2].trim() };
  }
  return { order: Number.MAX_SAFE_INTEGER, tag: null, fallbackTitle: base };
}

/**
 * jsonl `text` looks like:
 *   "#F001 Aula 00 - Boas-vindas e aprendendo sobre a plataforma de aulas - By @xEistibus ❤️‍🔥\n\n..."
 * Returns clean title: "Aula 00 - Boas-vindas e aprendendo sobre a plataforma de aulas"
 */
export function titleFromJsonlText(text: string): string | null {
  const firstLine = text.normalize("NFC").split("\n")[0]?.trim();
  if (!firstLine) return null;
  let title = firstLine.replace(/^#\w+\s+/, "");
  title = title.replace(/\s*-\s*By\s+@\S+.*$/iu, "");
  title = cleanTitle(title);
  return title.length > 0 ? title : null;
}

/** Source filenames/metadata replace "?" with "_" — restore it at title end. */
export function cleanTitle(title: string): string {
  return title.trim().replace(/_$/, "?");
}

/** Parse messages.jsonl content into a map of NFC-normalized media_filename -> entry. */
export function parseJsonl(content: string): Map<string, JsonlEntry> {
  const map = new Map<string, JsonlEntry>();
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const entry = JSON.parse(trimmed) as JsonlEntry;
      if (entry.media_filename) {
        map.set(entry.media_filename.normalize("NFC"), entry);
      }
    } catch {
      // tolerate malformed lines
    }
  }
  return map;
}

import fs from "node:fs";
import path from "node:path";
import { getDb } from "./db";
import {
  cleanTitle,
  parseJsonl,
  parseLessonFilename,
  parseModuleFolder,
  titleFromJsonlText,
} from "./parse";
import { readMp4DurationSeconds } from "./duration";
import { coursesRoot, DriveNotMountedError, isDriveMounted } from "./paths";

const VIDEO_EXTENSIONS = new Set([".mp4", ".mkv", ".webm", ".mov"]);

function isVideo(name: string): boolean {
  return VIDEO_EXTENSIONS.has(path.extname(name).toLowerCase());
}

function listDir(dir: string): fs.Dirent[] {
  try {
    return fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }
}

function looksLikeCourse(courseDir: string): boolean {
  return listDir(courseDir).some((entry) => {
    if (!entry.isDirectory()) return false;
    if (!parseModuleFolder(entry.name)) return false;
    const moduleDir = path.join(courseDir, entry.name);
    return listDir(moduleDir).some(
      (f) => f.isFile() && (isVideo(f.name) || f.name === "messages.jsonl")
    );
  });
}

function slugify(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export interface ScanResult {
  courses: number;
  modules: number;
  lessons: number;
  attachments: number;
}

export function scanCourses(): ScanResult {
  if (!isDriveMounted()) throw new DriveNotMountedError();

  const root = coursesRoot();
  const db = getDb();
  const result: ScanResult = { courses: 0, modules: 0, lessons: 0, attachments: 0 };

  const run = db.transaction(() => {
    // Catalog is rebuilt from the filesystem; progress (keyed by lesson_key) is preserved.
    db.prepare("DELETE FROM attachments").run();
    db.prepare("DELETE FROM lessons").run();
    db.prepare("DELETE FROM modules").run();
    db.prepare("DELETE FROM courses").run();

    const insertCourse = db.prepare(
      "INSERT INTO courses (slug, folder_name, title, scanned_at) VALUES (?, ?, ?, ?)"
    );
    const insertModule = db.prepare(
      "INSERT INTO modules (course_id, folder_name, title, order_index, is_documents) VALUES (?, ?, ?, ?, ?)"
    );
    const insertLesson = db.prepare(
      "INSERT INTO lessons (module_id, lesson_key, filename, title, tag, order_index, file_size, duration_seconds) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
    );
    const insertAttachment = db.prepare(
      "INSERT INTO attachments (module_id, attachment_key, filename, title, file_size) VALUES (?, ?, ?, ?, ?)"
    );

    for (const courseEntry of listDir(root)) {
      if (!courseEntry.isDirectory() || courseEntry.name.startsWith(".")) continue;
      const courseDir = path.join(root, courseEntry.name);
      if (!looksLikeCourse(courseDir)) continue;

      const courseTitle = courseEntry.name.normalize("NFC");
      const courseId = insertCourse.run(
        slugify(courseTitle),
        courseEntry.name,
        courseTitle,
        new Date().toISOString()
      ).lastInsertRowid as number;
      result.courses++;

      // Prefixed folders ("NN - Title") keep their order; folders named
      // "Módulo N" without a prefix are appended after them, sorted by N.
      const prefixed: Array<{ name: string; title: string; order: number }> = [];
      const unprefixed: Array<{ name: string; title: string; order: number }> = [];
      for (const moduleEntry of listDir(courseDir)) {
        if (!moduleEntry.isDirectory() || moduleEntry.name.startsWith(".")) continue;
        const parsed = parseModuleFolder(moduleEntry.name);
        if (parsed) {
          prefixed.push({ name: moduleEntry.name, ...parsed });
        } else {
          const m = moduleEntry.name.normalize("NFC").match(/m[óo]dulo\s*(\d+)/i);
          if (m) {
            unprefixed.push({
              name: moduleEntry.name,
              title: moduleEntry.name.normalize("NFC"),
              order: Number(m[1]),
            });
          }
        }
      }
      prefixed.sort((a, b) => a.order - b.order);
      unprefixed.sort((a, b) => a.order - b.order);
      const maxOrder = prefixed.reduce((n, p) => Math.max(n, p.order), 0);
      const moduleFolders = [
        ...prefixed,
        ...unprefixed.map((u, i) => ({ ...u, order: maxOrder + i + 1 })),
      ];

      for (const moduleFolder of moduleFolders) {
        const moduleDir = path.join(courseDir, moduleFolder.name);
        const files = listDir(moduleDir).filter((f) => f.isFile() && !f.name.startsWith("."));
        const videos = files.filter((f) => isVideo(f.name));
        const others = files.filter(
          (f) => !isVideo(f.name) && f.name !== "messages.jsonl"
        );

        // Materials may live one subfolder deep inside the module folder.
        const subAttachments: Array<{ relPath: string; filename: string }> = [];
        for (const sub of listDir(moduleDir)) {
          if (!sub.isDirectory() || sub.name.startsWith(".")) continue;
          const subDir = path.join(moduleDir, sub.name);
          for (const f of listDir(subDir)) {
            if (
              !f.isFile() ||
              f.name.startsWith(".") ||
              isVideo(f.name) ||
              f.name === "messages.jsonl"
            )
              continue;
            subAttachments.push({
              relPath: path.join(sub.name, f.name),
              filename: f.name,
            });
          }
        }

        if (videos.length === 0 && others.length === 0 && subAttachments.length === 0)
          continue;

        const isDocuments = videos.length === 0;
        const moduleId = insertModule.run(
          courseId,
          moduleFolder.name,
          moduleFolder.title,
          moduleFolder.order,
          isDocuments ? 1 : 0
        ).lastInsertRowid as number;
        result.modules++;

        let jsonlMap = new Map<string, import("./parse").JsonlEntry>();
        const jsonlPath = path.join(moduleDir, "messages.jsonl");
        if (fs.existsSync(jsonlPath)) {
          try {
            jsonlMap = parseJsonl(fs.readFileSync(jsonlPath, "utf8"));
          } catch {
            // unreadable metadata — fall back to filenames
          }
        }

        for (const file of videos) {
          const info = parseLessonFilename(file.name);
          const entry = jsonlMap.get(file.name.normalize("NFC"));
          const title =
            (entry?.text && titleFromJsonlText(entry.text)) ||
            cleanTitle(info.fallbackTitle);
          const lessonKey = path
            .join(courseEntry.name, moduleFolder.name, file.name)
            .normalize("NFC");
          const absPath = path.join(moduleDir, file.name);
          let size: number | null = null;
          try {
            size = fs.statSync(absPath).size;
          } catch {}
          insertLesson.run(
            moduleId,
            lessonKey,
            file.name,
            title,
            entry?.tag ?? info.tag,
            info.order,
            size,
            readMp4DurationSeconds(absPath)
          );
          result.lessons++;
        }

        const attachmentFiles = [
          ...others.map((f) => ({ relPath: f.name, filename: f.name })),
          ...subAttachments,
        ];
        for (const file of attachmentFiles) {
          const attachmentKey = path
            .join(courseEntry.name, moduleFolder.name, file.relPath)
            .normalize("NFC");
          let size: number | null = null;
          try {
            size = fs.statSync(path.join(moduleDir, file.relPath)).size;
          } catch {}
          insertAttachment.run(moduleId, attachmentKey, file.filename, file.filename, size);
          result.attachments++;
        }
      }
    }
  });

  run();
  return result;
}

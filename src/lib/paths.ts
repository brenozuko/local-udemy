import fs from "node:fs";
import path from "node:path";

export function coursesRoot(): string {
  return process.env.COURSES_ROOT ?? "/Volumes/ExternalHDMac";
}

export function isDriveMounted(): boolean {
  try {
    return fs.statSync(coursesRoot()).isDirectory();
  } catch {
    return false;
  }
}

export class DriveNotMountedError extends Error {
  constructor() {
    super(`Courses root not mounted: ${coursesRoot()}`);
    this.name = "DriveNotMountedError";
  }
}

/**
 * Resolve a relative key (stored in DB) against the courses root,
 * rejecting anything that escapes the root.
 */
export function resolveWithinRoot(relativeKey: string): string | null {
  const root = path.resolve(coursesRoot());
  const abs = path.resolve(root, relativeKey);
  if (abs !== root && !abs.startsWith(root + path.sep)) return null;
  return abs;
}

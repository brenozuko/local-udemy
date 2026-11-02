import fs from "node:fs";

/** Read an MP4/MOV duration from the mvhd box without decoding the media. */
export function readMp4DurationSeconds(filePath: string): number | null {
  let fd: number;
  try {
    fd = fs.openSync(filePath, "r");
  } catch {
    return null;
  }
  try {
    const { size } = fs.fstatSync(fd);
    if (!size) return null;
    return readBoxes(fd, 0, size);
  } catch {
    return null;
  } finally {
    fs.closeSync(fd);
  }
}

function readBoxes(fd: number, start: number, end: number): number | null {
  let offset = start;
  const header = Buffer.alloc(16);
  while (offset + 8 <= end) {
    if (fs.readSync(fd, header, 0, 8, offset) < 8) return null;
    let size = header.readUInt32BE(0);
    const type = header.toString("latin1", 4, 8);
    let headerSize = 8;
    if (size === 1) {
      if (fs.readSync(fd, header, 8, 8, offset + 8) < 8) return null;
      const large = header.readBigUInt64BE(8);
      if (large > BigInt(Number.MAX_SAFE_INTEGER)) return null;
      size = Number(large);
      headerSize = 16;
    } else if (size === 0) {
      size = end - offset;
    }
    if (size < headerSize || offset + size > end) return null;

    const contentStart = offset + headerSize;
    if (type === "moov") {
      const found = readBoxes(fd, contentStart, offset + size);
      if (found != null) return found;
    } else if (type === "mvhd") {
      return readMvhd(fd, contentStart, offset + size - contentStart);
    }
    offset += size;
  }
  return null;
}

function readMvhd(fd: number, start: number, length: number): number | null {
  if (length < 20) return null;
  const buf = Buffer.alloc(32);
  const n = fs.readSync(fd, buf, 0, Math.min(32, length), start);
  if (n < 20) return null;
  const version = buf[0];
  if (version === 0) {
    const timescale = buf.readUInt32BE(12);
    const duration = buf.readUInt32BE(16);
    if (!timescale) return null;
    return duration / timescale;
  }
  if (version === 1) {
    if (n < 32) return null;
    const timescale = buf.readUInt32BE(20);
    const duration = buf.readBigUInt64BE(24);
    if (!timescale) return null;
    return Number(duration) / timescale;
  }
  return null;
}

/** Whole seconds shown in the UI, matching the player clock. */
export function displayedSeconds(seconds: number | null): number {
  if (seconds == null || !Number.isFinite(seconds) || seconds <= 0) return 0;
  return Math.floor(seconds);
}

export function formatLessonDuration(
  seconds: number | null,
  options?: { alwaysHours?: boolean }
): string | null {
  const total = displayedSeconds(seconds);
  if (total <= 0) return null;
  const s = total % 60;
  const m = Math.floor(total / 60) % 60;
  const h = Math.floor(total / 3600);
  const ss = String(s).padStart(2, "0");
  if (h === 0 && !options?.alwaysHours) return `${m}:${ss}`;
  const hh = String(h).padStart(2, "0");
  const mm = String(m).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

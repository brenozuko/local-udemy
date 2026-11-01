import { createReadStream, statSync, existsSync } from "node:fs";
import { Readable } from "node:stream";
import { getDb } from "@/lib/db";
import { resolveWithinRoot } from "@/lib/paths";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ lessonId: string }> }
) {
  const { lessonId } = await params;
  const lesson = getDb()
    .prepare("SELECT lesson_key FROM lessons WHERE id = ?")
    .get(Number(lessonId)) as { lesson_key: string } | undefined;
  if (!lesson) return new Response("Not found", { status: 404 });

  const abs = resolveWithinRoot(lesson.lesson_key);
  if (!abs) return new Response("Forbidden", { status: 403 });
  if (!existsSync(abs)) {
    return new Response("Drive not mounted or file missing", { status: 503 });
  }

  const size = statSync(abs).size;
  const baseHeaders: Record<string, string> = {
    "Accept-Ranges": "bytes",
    "Content-Type": "video/mp4",
    "Cache-Control": "no-store",
  };

  const range = req.headers.get("range");
  if (!range) {
    const stream = createReadStream(abs);
    req.signal.addEventListener("abort", () => stream.destroy());
    return new Response(Readable.toWeb(stream) as ReadableStream, {
      status: 200,
      headers: { ...baseHeaders, "Content-Length": String(size) },
    });
  }

  const match = range.match(/^bytes=(\d*)-(\d*)$/);
  const start = match?.[1] ? Number(match[1]) : 0;
  const end = match?.[2] ? Math.min(Number(match[2]), size - 1) : size - 1;
  if (!match || Number.isNaN(start) || start >= size || start > end) {
    return new Response(null, {
      status: 416,
      headers: { "Content-Range": `bytes */${size}` },
    });
  }

  const stream = createReadStream(abs, { start, end });
  req.signal.addEventListener("abort", () => stream.destroy());
  return new Response(Readable.toWeb(stream) as ReadableStream, {
    status: 206,
    headers: {
      ...baseHeaders,
      "Content-Range": `bytes ${start}-${end}/${size}`,
      "Content-Length": String(end - start + 1),
    },
  });
}

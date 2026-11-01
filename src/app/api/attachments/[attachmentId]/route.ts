import { createReadStream, statSync, existsSync } from "node:fs";
import { Readable } from "node:stream";
import path from "node:path";
import { getDb } from "@/lib/db";
import { resolveWithinRoot } from "@/lib/paths";

// Types the browser can render inline; anything else downloads.
const INLINE_TYPES: Record<string, string> = {
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".html": "text/html; charset=utf-8",
};

export async function GET(
  req: Request,
  { params }: { params: Promise<{ attachmentId: string }> }
) {
  const { attachmentId } = await params;
  const attachment = getDb()
    .prepare("SELECT attachment_key, filename FROM attachments WHERE id = ?")
    .get(Number(attachmentId)) as
    | { attachment_key: string; filename: string }
    | undefined;
  if (!attachment) return new Response("Not found", { status: 404 });

  const abs = resolveWithinRoot(attachment.attachment_key);
  if (!abs) return new Response("Forbidden", { status: 403 });
  if (!existsSync(abs)) {
    return new Response("Drive not mounted or file missing", { status: 503 });
  }

  const size = statSync(abs).size;
  const inlineType = INLINE_TYPES[path.extname(attachment.filename).toLowerCase()];
  const stream = createReadStream(abs);
  req.signal.addEventListener("abort", () => stream.destroy());
  return new Response(Readable.toWeb(stream) as ReadableStream, {
    status: 200,
    headers: {
      "Content-Length": String(size),
      "Content-Type": inlineType ?? "application/octet-stream",
      "Content-Disposition": `${
        inlineType ? "inline" : "attachment"
      }; filename*=UTF-8''${encodeURIComponent(attachment.filename)}`,
    },
  });
}

import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

interface ProgressPayload {
  lessonId: number;
  position?: number;
  duration?: number;
  watched?: 0 | 1;
}

export async function POST(req: Request) {
  // sendBeacon posts text/plain — always parse manually.
  let payload: ProgressPayload;
  try {
    payload = JSON.parse(await req.text());
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (typeof payload.lessonId !== "number") {
    return NextResponse.json({ error: "lessonId required" }, { status: 400 });
  }

  const db = getDb();
  const lesson = db
    .prepare("SELECT lesson_key FROM lessons WHERE id = ?")
    .get(payload.lessonId) as { lesson_key: string } | undefined;
  if (!lesson) {
    return NextResponse.json({ error: "Lesson not found" }, { status: 404 });
  }

  const position = typeof payload.position === "number" ? payload.position : null;
  const duration = typeof payload.duration === "number" ? payload.duration : null;
  let watched: number | null = payload.watched === 0 || payload.watched === 1 ? payload.watched : null;
  if (watched === null && position !== null && duration && position / duration >= 0.9) {
    watched = 1;
  }

  db.prepare(
    `INSERT INTO progress (lesson_key, watched, position_seconds, duration_seconds, updated_at)
     VALUES (@key, COALESCE(@watched, 0), COALESCE(@position, 0), @duration, @now)
     ON CONFLICT(lesson_key) DO UPDATE SET
       watched = COALESCE(@watched, progress.watched),
       position_seconds = COALESCE(@position, progress.position_seconds),
       duration_seconds = COALESCE(@duration, progress.duration_seconds),
       updated_at = @now`
  ).run({
    key: lesson.lesson_key,
    watched,
    position,
    duration,
    now: new Date().toISOString(),
  });

  return NextResponse.json({ ok: true });
}

import { getDb } from "./db";

export interface CourseSummary {
  id: number;
  slug: string;
  title: string;
  lessonCount: number;
  watchedCount: number;
}

export interface LessonRow {
  id: number;
  title: string;
  tag: string | null;
  orderIndex: number;
  fileSize: number | null;
  watched: boolean;
  positionSeconds: number;
  durationSeconds: number | null;
}

export interface AttachmentRow {
  id: number;
  filename: string;
  fileSize: number | null;
}

export interface ModuleWithLessons {
  id: number;
  title: string;
  orderIndex: number;
  isDocuments: boolean;
  lessons: LessonRow[];
  attachments: AttachmentRow[];
}

export interface CourseDetail {
  id: number;
  slug: string;
  title: string;
  modules: ModuleWithLessons[];
}

export function listCourses(): CourseSummary[] {
  return getDb()
    .prepare(
      `SELECT c.id, c.slug, c.title,
              COUNT(l.id) AS lessonCount,
              COALESCE(SUM(CASE WHEN p.watched = 1 THEN 1 ELSE 0 END), 0) AS watchedCount
         FROM courses c
         LEFT JOIN modules m ON m.course_id = c.id
         LEFT JOIN lessons l ON l.module_id = m.id
         LEFT JOIN progress p ON p.lesson_key = l.lesson_key
        GROUP BY c.id
        ORDER BY c.title`
    )
    .all() as CourseSummary[];
}

export function getCourse(courseId: number): CourseDetail | null {
  const db = getDb();
  const course = db
    .prepare("SELECT id, slug, title FROM courses WHERE id = ?")
    .get(courseId) as { id: number; slug: string; title: string } | undefined;
  if (!course) return null;

  const modules = db
    .prepare(
      `SELECT id, title, order_index AS orderIndex, is_documents AS isDocuments
         FROM modules WHERE course_id = ? ORDER BY order_index`
    )
    .all(course.id) as Array<{
    id: number;
    title: string;
    orderIndex: number;
    isDocuments: number;
  }>;

  const lessonsStmt = db.prepare(
    `SELECT l.id, l.title, l.tag, l.order_index AS orderIndex, l.file_size AS fileSize,
            COALESCE(p.watched, 0) AS watched,
            COALESCE(p.position_seconds, 0) AS positionSeconds,
            p.duration_seconds AS durationSeconds
       FROM lessons l
       LEFT JOIN progress p ON p.lesson_key = l.lesson_key
      WHERE l.module_id = ? ORDER BY l.order_index`
  );
  const attachmentsStmt = db.prepare(
    `SELECT id, filename, file_size AS fileSize FROM attachments WHERE module_id = ? ORDER BY filename`
  );

  return {
    ...course,
    modules: modules.map((m) => ({
      id: m.id,
      title: m.title,
      orderIndex: m.orderIndex,
      isDocuments: m.isDocuments === 1,
      lessons: (lessonsStmt.all(m.id) as Array<Omit<LessonRow, "watched"> & { watched: number }>).map(
        (l) => ({ ...l, watched: l.watched === 1 })
      ),
      attachments: attachmentsStmt.all(m.id) as AttachmentRow[],
    })),
  };
}

export interface LessonDetail {
  id: number;
  title: string;
  moduleTitle: string;
  courseId: number;
  courseTitle: string;
  watched: boolean;
  positionSeconds: number;
  durationSeconds: number | null;
  prevId: number | null;
  nextId: number | null;
}

export function getLesson(lessonId: number): LessonDetail | null {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT l.id, l.title, l.lesson_key AS lessonKey,
              m.id AS moduleId, m.title AS moduleTitle,
              c.id AS courseId, c.title AS courseTitle,
              COALESCE(p.watched, 0) AS watched,
              COALESCE(p.position_seconds, 0) AS positionSeconds,
              p.duration_seconds AS durationSeconds
         FROM lessons l
         JOIN modules m ON m.id = l.module_id
         JOIN courses c ON c.id = m.course_id
         LEFT JOIN progress p ON p.lesson_key = l.lesson_key
        WHERE l.id = ?`
    )
    .get(lessonId) as
    | {
        id: number;
        title: string;
        moduleId: number;
        moduleTitle: string;
        courseId: number;
        courseTitle: string;
        watched: number;
        positionSeconds: number;
        durationSeconds: number | null;
      }
    | undefined;
  if (!row) return null;

  // Course-wide ordering: module order, then lesson order.
  const ordered = db
    .prepare(
      `SELECT l.id FROM lessons l
         JOIN modules m ON m.id = l.module_id
        WHERE m.course_id = ? AND m.is_documents = 0
        ORDER BY m.order_index, l.order_index`
    )
    .all(row.courseId) as Array<{ id: number }>;
  const idx = ordered.findIndex((o) => o.id === row.id);

  return {
    id: row.id,
    title: row.title,
    moduleTitle: row.moduleTitle,
    courseId: row.courseId,
    courseTitle: row.courseTitle,
    watched: row.watched === 1,
    positionSeconds: row.positionSeconds,
    durationSeconds: row.durationSeconds,
    prevId: idx > 0 ? ordered[idx - 1].id : null,
    nextId: idx >= 0 && idx < ordered.length - 1 ? ordered[idx + 1].id : null,
  };
}

// Udemy-style resume: most recently played unfinished lesson, else first
// unwatched in course order, else first lesson.
export function getResumeLessonId(courseId: number): number | null {
  const db = getDb();
  const inProgress = db
    .prepare(
      `SELECT l.id FROM lessons l
         JOIN modules m ON m.id = l.module_id
         JOIN progress p ON p.lesson_key = l.lesson_key
        WHERE m.course_id = ? AND m.is_documents = 0
          AND p.watched = 0 AND p.position_seconds > 0
        ORDER BY p.updated_at DESC LIMIT 1`
    )
    .get(courseId) as { id: number } | undefined;
  if (inProgress) return inProgress.id;

  const firstUnwatched = db
    .prepare(
      `SELECT l.id FROM lessons l
         JOIN modules m ON m.id = l.module_id
         LEFT JOIN progress p ON p.lesson_key = l.lesson_key
        WHERE m.course_id = ? AND m.is_documents = 0
          AND COALESCE(p.watched, 0) = 0
        ORDER BY m.order_index, l.order_index LIMIT 1`
    )
    .get(courseId) as { id: number } | undefined;
  if (firstUnwatched) return firstUnwatched.id;

  const first = db
    .prepare(
      `SELECT l.id FROM lessons l
         JOIN modules m ON m.id = l.module_id
        WHERE m.course_id = ? AND m.is_documents = 0
        ORDER BY m.order_index, l.order_index LIMIT 1`
    )
    .get(courseId) as { id: number } | undefined;
  return first?.id ?? null;
}

export function hasCourses(): boolean {
  const row = getDb().prepare("SELECT COUNT(*) AS n FROM courses").get() as { n: number };
  return row.n > 0;
}

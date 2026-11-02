import Link from "next/link";
import { notFound } from "next/navigation";
import { getCourse, getLesson } from "@/lib/catalog";
import { Player } from "@/components/player";
import { CourseSidebar } from "@/components/course-sidebar";

export const dynamic = "force-dynamic";

export default async function LessonPage({
  params,
}: {
  params: Promise<{ courseId: string; lessonId: string }>;
}) {
  const { courseId, lessonId } = await params;
  const lesson = getLesson(Number(lessonId));
  if (!lesson || lesson.courseId !== Number(courseId)) notFound();

  const course = getCourse(lesson.courseId);
  if (!course) notFound();

  return (
    <main className="flex w-full flex-1 flex-col lg:flex-row">
      <div className="min-w-0 flex-1">
        <Player
          key={lesson.id}
          lessonId={lesson.id}
          courseId={lesson.courseId}
          initialPosition={lesson.positionSeconds}
          initialWatched={lesson.watched}
          prevId={lesson.prevId}
          nextId={lesson.nextId}
        />
        <div className="px-6 py-6">
          <div className="mb-2 text-sm text-muted-foreground">
            <Link href="/" className="hover:text-foreground">
              ← Todos os cursos
            </Link>
            <span className="mx-2">/</span>
            <span>{lesson.courseTitle}</span>
            <span className="mx-2">/</span>
            <span>{lesson.moduleTitle}</span>
          </div>
          <h1 className="text-xl font-bold">{lesson.title}</h1>
        </div>
      </div>

      <aside className="border-t lg:sticky lg:top-14 lg:h-[calc(100vh-3.5rem)] lg:w-[380px] lg:shrink-0 lg:overflow-y-auto lg:border-l lg:border-t-0">
        <CourseSidebar course={course} currentLessonId={lesson.id} />
      </aside>
    </main>
  );
}

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCourse, getResumeLessonId } from "@/lib/catalog";
import { coursesRoot, isDriveMounted } from "@/lib/paths";
import { DriveBanner } from "@/components/drive-banner";

export const dynamic = "force-dynamic";

export default async function CoursePage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const { courseId } = await params;
  const course = getCourse(Number(courseId));
  if (!course) notFound();

  const resumeLessonId = getResumeLessonId(course.id);
  if (resumeLessonId) {
    redirect(`/courses/${course.id}/lessons/${resumeLessonId}`);
  }

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-10">
      <div className="mb-2">
        <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">
          ← Todos os cursos
        </Link>
      </div>
      <h1 className="mb-3 text-2xl font-bold">{course.title}</h1>
      {!isDriveMounted() ? (
        <DriveBanner root={coursesRoot()} />
      ) : (
        <p className="text-muted-foreground">Este curso não tem aulas.</p>
      )}
    </main>
  );
}

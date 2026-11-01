import Link from "next/link";
import { listCourses, hasCourses } from "@/lib/catalog";
import { scanCourses } from "@/lib/scan";
import { coursesRoot, isDriveMounted } from "@/lib/paths";
import { DriveBanner } from "@/components/drive-banner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const mounted = isDriveMounted();
  if (mounted && !hasCourses()) {
    scanCourses();
  }
  const courses = listCourses();

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-10">
      <h1 className="mb-8 text-2xl font-bold">Meus cursos</h1>

      {!mounted && (
        <div className="mb-6">
          <DriveBanner root={coursesRoot()} />
        </div>
      )}

      {courses.length === 0 ? (
        <p className="text-muted-foreground">
          Nenhum curso encontrado. Monte o drive e reescaneie.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {courses.map((course) => {
            const pct =
              course.lessonCount > 0
                ? Math.round((course.watchedCount / course.lessonCount) * 100)
                : 0;
            return (
              <Link key={course.id} href={`/courses/${course.id}`}>
                <Card className="h-full transition-all hover:border-primary/50 hover:shadow-md">
                  <CardHeader>
                    <CardTitle>{course.title}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <Progress value={pct} />
                    <p className="text-sm text-muted-foreground">
                      {course.watchedCount} / {course.lessonCount} aulas · {pct}%
                    </p>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </main>
  );
}

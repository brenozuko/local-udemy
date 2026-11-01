import Link from "next/link";
import type { CourseDetail } from "@/lib/catalog";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { FileText } from "lucide-react";
import { WatchedToggle } from "@/components/watched-toggle";
import { Progress } from "@/components/ui/progress";

function formatSize(bytes: number | null): string {
  if (!bytes) return "";
  const mb = bytes / (1024 * 1024);
  return mb >= 1024 ? `${(mb / 1024).toFixed(1)} GB` : `${Math.round(mb)} MB`;
}

export function CourseSidebar({
  course,
  currentLessonId,
}: {
  course: CourseDetail;
  currentLessonId: number;
}) {
  const videoModules = course.modules.filter((m) => !m.isDocuments);
  const totalLessons = videoModules.reduce((n, m) => n + m.lessons.length, 0);
  const watchedLessons = videoModules.reduce(
    (n, m) => n + m.lessons.filter((l) => l.watched).length,
    0
  );
  const currentModule = videoModules.find((m) =>
    m.lessons.some((l) => l.id === currentLessonId)
  );
  const modules = course.modules.filter(
    (m) => m.lessons.length > 0 || m.attachments.length > 0
  );

  return (
    <div className="flex h-full flex-col">
      <div className="border-b px-4 py-3">
        <h2 className="text-sm font-bold">Conteúdo do curso</h2>
        <div className="mt-2 flex items-center gap-2">
          <Progress
            value={
              totalLessons > 0 ? (watchedLessons / totalLessons) * 100 : 0
            }
            className="h-1.5 flex-1"
          />
          <span className="shrink-0 text-xs font-medium text-muted-foreground">
            {totalLessons > 0
              ? Math.round((watchedLessons / totalLessons) * 100)
              : 0}
            %
          </span>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          {watchedLessons} / {totalLessons} aulas concluídas
        </p>
      </div>
      <Accordion
        type="multiple"
        defaultValue={currentModule ? [`module-${currentModule.id}`] : []}
        className="flex-1"
      >
        {modules.map((module) => {
          const watched = module.lessons.filter((l) => l.watched).length;
          const counts = [
            module.lessons.length > 0
              ? `${watched}/${module.lessons.length} aulas`
              : null,
            module.attachments.length > 0
              ? `${module.attachments.length} ${
                  module.attachments.length === 1 ? "material" : "materiais"
                }`
              : null,
          ]
            .filter(Boolean)
            .join(" · ");
          return (
            <AccordionItem
              key={module.id}
              value={`module-${module.id}`}
              className="border-b"
            >
              <AccordionTrigger className="cursor-pointer px-4 py-3 text-left text-sm font-semibold hover:bg-muted/50 hover:no-underline">
                <div className="min-w-0 pr-2">
                  <span className="block">{module.title}</span>
                  <span className="mt-0.5 block text-xs font-normal text-muted-foreground">
                    {counts}
                  </span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pb-0">
                <ul>
                  {module.lessons.map((l) => {
                    const isCurrent = l.id === currentLessonId;
                    return (
                      <li
                        key={l.id}
                        className={`flex items-start gap-2 border-l-2 px-4 py-2.5 text-sm ${
                          isCurrent
                            ? "border-primary bg-accent font-medium"
                            : "border-transparent hover:bg-muted/50"
                        }`}
                      >
                        <span className="mt-0.5 flex shrink-0">
                          <WatchedToggle lessonId={l.id} watched={l.watched} />
                        </span>
                        <Link
                          href={`/courses/${course.id}/lessons/${l.id}`}
                          className="flex min-w-0 flex-1 items-start gap-2"
                        >
                          <span
                            className={`min-w-0 flex-1 ${
                              l.watched && !isCurrent ? "text-muted-foreground" : ""
                            }`}
                          >
                            {l.title}
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
                {module.attachments.length > 0 && (
                  <div
                    className={`px-4 py-2 ${
                      module.lessons.length > 0 ? "border-t" : ""
                    }`}
                  >
                    {module.lessons.length > 0 && (
                      <h4 className="mb-1 pt-1 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                        Materiais
                      </h4>
                    )}
                    <ul>
                      {module.attachments.map((a) => (
                        <li key={a.id}>
                          <a
                            href={`/api/attachments/${a.id}`}
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center gap-2 rounded-md px-1 py-1.5 text-sm hover:bg-muted/50"
                          >
                            <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                            <span className="min-w-0 flex-1 truncate">
                              {a.filename}
                            </span>
                            <span className="shrink-0 text-xs text-muted-foreground">
                              {formatSize(a.fileSize)}
                            </span>
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>
    </div>
  );
}

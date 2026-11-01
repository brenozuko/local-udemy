"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { CheckCircle2, Circle } from "lucide-react";

export function WatchedToggle({
  lessonId,
  watched,
}: {
  lessonId: number;
  watched: boolean;
}) {
  const router = useRouter();
  const [optimistic, setOptimistic] = useState(watched);

  async function toggle(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const next = !optimistic;
    setOptimistic(next);
    await fetch("/api/progress", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lessonId, watched: next ? 1 : 0 }),
    });
    router.refresh();
  }

  return (
    <button
      onClick={toggle}
      title={optimistic ? "Desmarcar como concluída" : "Marcar como concluída"}
      className="shrink-0 text-muted-foreground transition-colors hover:text-primary"
    >
      {optimistic ? (
        <CheckCircle2 className="h-4 w-4 text-primary" />
      ) : (
        <Circle className="h-4 w-4" />
      )}
    </button>
  );
}

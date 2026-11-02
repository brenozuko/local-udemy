export function DriveBanner({ root }: { root: string }) {
  return (
    <div className="rounded-md border border-yellow-500/50 bg-yellow-500/10 px-4 py-3 text-sm text-yellow-700 dark:text-yellow-400">
      Drive externo não montado ({root}). Exibindo catálogo em cache — a
      reprodução ficará indisponível até o drive ser reconectado.
    </div>
  );
}

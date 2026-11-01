export function DriveBanner({ root }: { root: string }) {
  return (
    <div className="rounded-md border border-yellow-400 bg-yellow-50 px-4 py-3 text-sm text-yellow-800">
      Drive externo não montado ({root}). Exibindo catálogo em cache — a
      reprodução ficará indisponível até o drive ser reconectado.
    </div>
  );
}

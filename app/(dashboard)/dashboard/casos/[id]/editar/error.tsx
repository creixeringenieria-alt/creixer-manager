"use client";

import Link from "next/link";

export default function EditarCasoError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="page-shell">
      <section className="card">
        <h1>No fue posible cargar la edición del caso</h1>
        <p>La sesión está activa, pero esta vista presentó un error. Intenta de nuevo o vuelve al listado de casos.</p>
        <p className="feedback error">{error.message || "Error inesperado al cargar la edición del caso."}</p>
        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
          <button type="button" onClick={reset}>
            Intentar de nuevo
          </button>
          <Link href="/dashboard/casos">Volver a casos</Link>
        </div>
      </section>
    </main>
  );
}

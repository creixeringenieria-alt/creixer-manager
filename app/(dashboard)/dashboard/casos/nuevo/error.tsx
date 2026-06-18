"use client";

import Link from "next/link";

export default function NuevoCasoError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main>
      <section className="card">
        <h1>No fue posible cargar creación de caso</h1>
        <p>La sesión está activa, pero esta vista presentó un error al cargar.</p>
        <p className="feedback error">{error.message || "Error inesperado al cargar el formulario."}</p>
        <div className="inline-form">
          <button type="button" onClick={reset}>
            Intentar de nuevo
          </button>
          <Link href="/dashboard/casos">Volver a casos</Link>
          <Link href="/dashboard">Volver al dashboard</Link>
        </div>
      </section>
    </main>
  );
}

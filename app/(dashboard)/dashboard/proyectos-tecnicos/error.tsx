"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function ProyectosTecnicosError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[dashboard/proyectos-tecnicos] client error boundary", {
      message: error.message,
      digest: error.digest
    });
  }, [error]);

  return (
    <main>
      <section className="card">
        <h1 style={{ marginTop: 0 }}>No fue posible cargar proyectos técnicos</h1>
        <p>
          La sesión está activa, pero esta vista presentó un error al cargar. Puedes intentar de nuevo o volver al
          dashboard.
        </p>
        {error.message ? <p className="feedback error">{error.message}</p> : null}
        <div className="inline-form">
          <button type="button" onClick={reset}>
            Intentar de nuevo
          </button>
          <Link href="/dashboard">Volver al dashboard</Link>
          <Link href="/dashboard/casos/nuevo">Crear caso</Link>
        </div>
      </section>
    </main>
  );
}

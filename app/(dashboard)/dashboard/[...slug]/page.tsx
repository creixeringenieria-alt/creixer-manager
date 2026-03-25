import Link from "next/link";

import { requirePageAccess } from "@/lib/auth/permissions";

interface DashboardModuleFallbackProps {
  params: Promise<{ slug: string[] }>;
}

export default async function DashboardModuleFallbackPage({ params }: DashboardModuleFallbackProps) {
  await requirePageAccess(
    ["administrador", "asistente", "tecnico", "super_admin", "gerente_operativo", "administrativo", "contable", "almacen", "lider_operativo", "cliente_inmobiliaria"],
    "/dashboard",
    "Acceso denegado."
  );

  const { slug } = await params;
  const requestedPath = `/dashboard/${(slug ?? []).join("/")}`;

  return (
    <main>
      <section className="card">
        <h1 style={{ marginTop: 0 }}>Módulo en preparación</h1>
        <p>La ruta solicitada no está disponible todavía o fue movida.</p>
        <p>
          Ruta consultada: <code>{requestedPath}</code>
        </p>
        <div className="inline-form">
          <Link href="/dashboard">Volver al inicio</Link>
          <Link href="/dashboard/casos">Ir a casos</Link>
        </div>
      </section>
    </main>
  );
}

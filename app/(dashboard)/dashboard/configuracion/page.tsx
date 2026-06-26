import Link from "next/link";

import { requireCurrentProfile } from "@/lib/auth/current-profile";
import { requirePagePermission } from "@/lib/auth/permissions";
import { createAdminClient } from "@/lib/supabase/admin";

export default async function ConfiguracionPage() {
  await requirePagePermission("editar_casos", "/dashboard", "Acceso denegado a configuración.");
  const profile = await requireCurrentProfile();
  const isSuperAdmin = profile.role === "super_admin";

  const supabase = createAdminClient();
  const [usersResp, rolesResp, inmobiliariasResp] = await Promise.all([
    supabase.from("profiles").select("id", { count: "exact", head: true }),
    supabase.from("role_permissions").select("role", { count: "exact", head: true }),
    supabase.from("clients").select("id", { count: "exact", head: true })
  ]);

  return (
    <main>
      <div className="page-header">
        <div>
          <h1>Configuración</h1>
          <p>Administración de usuarios, roles, perfil e inmobiliarias.</p>
        </div>
        <Link href="/dashboard">Volver al dashboard</Link>
      </div>

      <section className="metrics-grid">
        <article className="card metric-card">
          <p className="metric-label">Usuarios</p>
          <p className="metric-value">{usersResp.count ?? 0}</p>
        </article>
        <article className="card metric-card">
          <p className="metric-label">Roles con permisos</p>
          <p className="metric-value">{rolesResp.count ?? 0}</p>
        </article>
        <article className="card metric-card">
          <p className="metric-label">Inmobiliarias</p>
          <p className="metric-value">{inmobiliariasResp.count ?? 0}</p>
        </article>
      </section>

      <section className="module-grid">
        {isSuperAdmin ? (
          <Link className="card" href="/dashboard/configuracion/gerencial">
            <h2>Configuración gerencial</h2>
            <p>Consola privada para operación, permisos y análisis con IA.</p>
          </Link>
        ) : null}
        <Link className="card" href="/dashboard/configuracion/usuarios">
          <h2>Usuarios</h2>
          <p>Listado base de usuarios autenticados y su rol actual.</p>
        </Link>
        <Link className="card" href="/dashboard/configuracion/roles-accesos">
          <h2>Roles y permisos</h2>
          <p>Matriz de permisos, módulos visibles y acciones permitidas por rol.</p>
        </Link>
        <Link className="card" href="/dashboard/perfil">
          <h2>Mi perfil</h2>
          <p>Datos del usuario actual, rol y empresa/inmobiliaria asociada.</p>
        </Link>
        <Link className="card" href="/dashboard/inmobiliarias">
          <h2>Inmobiliarias</h2>
          <p>Crear y editar inmobiliarias activas/inactivas para asociarlas a casos.</p>
        </Link>
      </section>
    </main>
  );
}

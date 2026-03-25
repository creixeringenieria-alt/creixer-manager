import Link from "next/link";

import { requirePagePermission } from "@/lib/auth/permissions";
import { createAdminClient } from "@/lib/supabase/admin";

export default async function ConfiguracionUsuariosPage() {
  await requirePagePermission("editar_casos", "/dashboard", "Acceso denegado a configuración de usuarios.");

  const supabase = createAdminClient();
  const { data: users, error } = await supabase
    .from("profiles")
    .select("id, full_name, role, client_id, clients(name), created_at")
    .order("created_at", { ascending: false })
    .limit(200);

  return (
    <main>
      <div className="page-header">
        <div>
          <h1>Configuración - Usuarios</h1>
          <p>Usuarios autenticados, rol vigente e inmobiliaria asociada.</p>
        </div>
        <Link href="/dashboard/configuracion">Volver a configuración</Link>
      </div>

      {error ? <p className="feedback error">No fue posible cargar usuarios: {error.message}</p> : null}

      <section className="card">
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Usuario</th>
                <th>Rol</th>
                <th>Inmobiliaria</th>
                <th>ID</th>
              </tr>
            </thead>
            <tbody>
              {(users ?? []).map((user) => (
                <tr key={user.id}>
                  <td>{user.full_name ?? "-"}</td>
                  <td>{user.role ?? "-"}</td>
                  <td>{(user.clients as { name?: string } | null)?.name ?? "-"}</td>
                  <td>{user.id}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}


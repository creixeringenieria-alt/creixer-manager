import Link from "next/link";

import { APP_PERMISSIONS, requirePagePermission } from "@/lib/auth/permissions";
import { APP_ROLES, type AppRole } from "@/lib/auth/roles";
import { DASHBOARD_NAV_ITEMS, getVisibleDashboardRole } from "@/lib/navigation/dashboard";
import { createAdminClient } from "@/lib/supabase/admin";

const ACTION_LABELS: Record<string, string> = {
  ver_casos: "Ver casos globales",
  ver_casos_propios: "Ver casos propios",
  ver_casos_cliente: "Ver casos de su inmobiliaria",
  ver_detalle_caso_cliente: "Ver detalle del caso cliente",
  ver_documentos_cliente: "Ver documentos del caso cliente",
  ver_evidencias_cliente: "Ver evidencias del caso cliente",
  crear_casos: "Crear casos",
  editar_casos: "Editar casos",
  cerrar_casos: "Cerrar casos",
  ver_clientes: "Ver clientes",
  crear_clientes: "Crear clientes",
  editar_clientes: "Editar clientes",
  eliminar_clientes: "Eliminar clientes",
  ver_finanzas: "Ver finanzas",
  registrar_gastos: "Registrar gastos",
  adjuntar_soportes: "Adjuntar soportes",
  ver_inventario: "Ver inventario",
  asignar_tecnicos: "Asignar técnicos"
};

export default async function RolesAccesosPage() {
  await requirePagePermission("editar_casos", "/dashboard", "Acceso denegado a roles y accesos.");

  const supabase = createAdminClient();
  const [permissionsResp, rolePermissionsResp] = await Promise.all([
    supabase.from("app_permissions").select("key, description").order("key", { ascending: true }),
    supabase.from("role_permissions").select("role, permission_key").order("role", { ascending: true })
  ]);

  const effectivePermissions = permissionsResp.data?.length
    ? permissionsResp.data.map((row) => row.key)
    : [...APP_PERMISSIONS];

  const rolePermissionsMap = new Map<string, string[]>();
  for (const row of rolePermissionsResp.data ?? []) {
    const key = String(row.role);
    const current = rolePermissionsMap.get(key) ?? [];
    current.push(String(row.permission_key));
    rolePermissionsMap.set(key, current);
  }

  return (
    <main>
      <div className="page-header">
        <div>
          <h1>Configuración - Roles y accesos</h1>
          <p>Matriz unificada de rol, permisos, módulos visibles y acciones permitidas.</p>
        </div>
        <Link href="/dashboard/configuracion">Volver a configuración</Link>
      </div>

      <section className="card">
        <h2>Catálogo de permisos</h2>
        <div className="inline-form">
          {effectivePermissions.map((permission) => (
            <span className="status-pill" key={permission}>
              {permission}
            </span>
          ))}
        </div>
      </section>

      <section className="card">
        <h2>Matriz por rol</h2>
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Rol</th>
                <th>Permisos asignados</th>
                <th>Módulos visibles</th>
                <th>Acciones permitidas</th>
              </tr>
            </thead>
            <tbody>
              {APP_ROLES.map((role) => {
                const roleKey = role as AppRole;
                const normalized = getVisibleDashboardRole(roleKey);
                const permissions = rolePermissionsMap.get(role) ?? [];
                const modules = normalized
                  ? DASHBOARD_NAV_ITEMS.filter((item) => !item.deprecated && item.roles.includes(normalized) && (item.showInHeader || item.showInDashboard)).map(
                      (item) => item.label
                    )
                  : [];
                const actions = permissions.map((permission) => ACTION_LABELS[permission] ?? permission);

                return (
                  <tr key={role}>
                    <td>{role}</td>
                    <td>{permissions.length > 0 ? permissions.join(", ") : "-"}</td>
                    <td>{modules.length > 0 ? modules.join(", ") : "-"}</td>
                    <td>{actions.length > 0 ? actions.join(", ") : "-"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

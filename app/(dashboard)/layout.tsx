import Link from "next/link";

import { logoutAction } from "@/app/(dashboard)/actions";
import { requireCurrentProfile } from "@/lib/auth/current-profile";
import { getHeaderNavGroupsByRole } from "@/lib/navigation/dashboard";

export default async function DashboardLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  const profile = await requireCurrentProfile();
  const { role } = profile;
  const navItems = getHeaderNavGroupsByRole(role);
  const displayName = profile.fullName || profile.email || "Usuario";
  const isSuperAdmin = role === "super_admin" || role === "administrador";
  const empresa = isSuperAdmin
    ? "CEO Creixer"
    : profile.userType === "colaborador_creixer"
      ? profile.organizationName ?? "Creixer Ingeniería S.A.S."
      : profile.clientName ?? "Sin inmobiliaria asociada";

  return (
    <>
      <header className="app-shell-header">
        <div className="app-shell-brand">
          <img src="/logo-creixer.png" alt="Creixer" className="app-logo" />
          <div>
            <strong>Creixer Manager</strong>
            <p className="app-shell-subtitle">Operación técnica</p>
          </div>
        </div>
        <div className="app-shell-right">
          <nav className="app-shell-nav">
            {navItems.map((item) => (
              <Link key={item.id} href={item.href}>
                {item.label}
              </Link>
            ))}
          </nav>
          <details className="user-menu">
            <summary>
              <span className="user-name">{displayName}</span>
              <span className="user-role">{role}</span>
              <span className="user-company">{empresa ?? "Sin inmobiliaria asociada"}</span>
            </summary>
            <div className="user-menu-dropdown">
              <Link href="/dashboard/perfil">Mi perfil</Link>
              <Link href="/dashboard/configuracion">Configuración</Link>
              {isSuperAdmin ? <Link href="/dashboard/configuracion/gerencial">Configuración gerencial</Link> : null}
              <Link href="/dashboard/configuracion/roles-accesos">Roles y accesos</Link>
              <form action={logoutAction}>
                <button type="submit">Cerrar sesión</button>
              </form>
            </div>
          </details>
        </div>
      </header>
      {children}
    </>
  );
}

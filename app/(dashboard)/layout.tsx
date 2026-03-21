import Link from "next/link";

import { getCurrentUserRole } from "@/lib/auth/permissions";
import { getHeaderNavGroupsByRole } from "@/lib/navigation/dashboard";

export default async function DashboardLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { role } = await getCurrentUserRole();
  const navItems = getHeaderNavGroupsByRole(role);

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
        <nav className="app-shell-nav">
          {navItems.map((item) => (
            <Link key={item.id} href={item.href}>
              {item.label}
            </Link>
          ))}
        </nav>
      </header>
      {children}
    </>
  );
}

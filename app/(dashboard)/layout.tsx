import Link from "next/link";

export default function DashboardLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
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
          <Link href="/dashboard">Inicio</Link>
          <Link href="/dashboard/proyectos-tecnicos">Proyectos técnicos</Link>
          <Link href="/dashboard/requerimientos">Requerimientos</Link>
          <Link href="/dashboard/apu">APU</Link>
          <Link href="/dashboard/agenda-operativa">Agenda operativa</Link>
          <Link href="/dashboard/agenda-operativa/tiempo-real">Agenda tiempo real</Link>
          <Link href="/dashboard/almacen">Almacén</Link>
          <Link href="/dashboard/cotizaciones">Cotizaciones</Link>
          <Link href="/dashboard/ordenes-trabajo">Órdenes</Link>
          <Link href="/dashboard/actas-satisfaccion">Actas</Link>
          <Link href="/dashboard/finanzas">Finanzas</Link>
          <Link href="/dashboard/casos">Casos</Link>
          <Link href="/dashboard/mis-tareas">Mis tareas</Link>
        </nav>
      </header>
      {children}
    </>
  );
}

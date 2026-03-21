import type { AppRole } from "@/lib/auth/roles";
import { normalizeRole as normalizeAppRole } from "@/lib/auth/roles";

type CoreRole =
  | "super_admin"
  | "gerente_operativo"
  | "administrativo"
  | "contable"
  | "almacen"
  | "lider_operativo"
  | "tecnico";

export interface DashboardNavItem {
  id: string;
  label: string;
  href: string;
  roles: CoreRole[];
  showInHeader: boolean;
  showInDashboard: boolean;
  deprecated?: boolean;
  note?: string;
}

export interface DashboardNavGroup {
  id: string;
  label: string;
  href: string;
  roles: CoreRole[];
}

export const DASHBOARD_NAV_ITEMS: DashboardNavItem[] = [
  {
    id: "inicio",
    label: "Inicio",
    href: "/dashboard",
    roles: ["super_admin", "gerente_operativo", "administrativo", "contable", "almacen", "lider_operativo", "tecnico"],
    showInHeader: true,
    showInDashboard: false
  },
  { id: "casos", label: "Casos", href: "/dashboard/casos", roles: ["super_admin", "gerente_operativo", "administrativo", "contable", "lider_operativo"], showInHeader: true, showInDashboard: true },
  {
    id: "nuevo-caso-proyecto",
    label: "Nuevo caso/proyecto",
    href: "/dashboard/casos/nuevo",
    roles: ["super_admin", "gerente_operativo", "administrativo", "lider_operativo"],
    showInHeader: true,
    showInDashboard: true
  },
  { id: "requerimientos", label: "Requerimientos", href: "/dashboard/requerimientos", roles: ["super_admin", "gerente_operativo", "administrativo", "lider_operativo"], showInHeader: true, showInDashboard: true },
  { id: "agenda", label: "Agenda operativa", href: "/dashboard/agenda-operativa", roles: ["super_admin", "gerente_operativo", "administrativo", "lider_operativo"], showInHeader: true, showInDashboard: true },
  { id: "mis-tareas", label: "Mis tareas", href: "/dashboard/mis-tareas", roles: ["super_admin", "gerente_operativo", "administrativo", "lider_operativo", "tecnico"], showInHeader: true, showInDashboard: true },
  { id: "reporte-visita", label: "Reporte de visita", href: "/dashboard/reporte-visita", roles: ["super_admin", "gerente_operativo", "lider_operativo", "tecnico"], showInHeader: true, showInDashboard: true },
  { id: "cotizaciones", label: "Cotizaciones", href: "/dashboard/cotizaciones", roles: ["super_admin", "gerente_operativo", "administrativo", "lider_operativo"], showInHeader: true, showInDashboard: true },
  { id: "ordenes", label: "Órdenes", href: "/dashboard/ordenes-trabajo", roles: ["super_admin", "gerente_operativo", "administrativo", "lider_operativo"], showInHeader: true, showInDashboard: true },
  { id: "actas", label: "Actas", href: "/dashboard/actas-satisfaccion", roles: ["super_admin", "gerente_operativo", "administrativo", "lider_operativo"], showInHeader: true, showInDashboard: true },
  { id: "proyectos", label: "Proyectos técnicos", href: "/dashboard/proyectos-tecnicos", roles: ["super_admin", "gerente_operativo", "administrativo", "lider_operativo"], showInHeader: true, showInDashboard: true },
  { id: "presupuesto", label: "Presupuesto obra", href: "/dashboard/presupuesto-obra", roles: ["super_admin", "gerente_operativo", "administrativo", "lider_operativo"], showInHeader: true, showInDashboard: true },
  { id: "apu", label: "APU", href: "/dashboard/apu", roles: ["super_admin", "gerente_operativo", "administrativo", "lider_operativo"], showInHeader: true, showInDashboard: true },
  { id: "almacen", label: "Almacén", href: "/dashboard/almacen", roles: ["super_admin", "gerente_operativo", "administrativo", "almacen"], showInHeader: true, showInDashboard: true },
  { id: "finanzas", label: "Finanzas", href: "/dashboard/finanzas", roles: ["super_admin", "gerente_operativo", "contable"], showInHeader: true, showInDashboard: true },

  // Compatibilidad / legado (fuera de navegación principal).
  {
    id: "agenda-tiempo-real-legacy",
    label: "Agenda tiempo real",
    href: "/dashboard/agenda-operativa/tiempo-real",
    roles: ["super_admin", "gerente_operativo", "administrativo", "lider_operativo"],
    showInHeader: false,
    showInDashboard: false,
    deprecated: true,
    note: "Consolidado en Agenda operativa."
  },
  {
    id: "facturacion-legacy",
    label: "Facturación",
    href: "/dashboard/facturacion",
    roles: ["super_admin", "gerente_operativo", "contable"],
    showInHeader: false,
    showInDashboard: false,
    deprecated: true,
    note: "Consolidado en Finanzas."
  },
  {
    id: "cartera-legacy",
    label: "Cartera",
    href: "/dashboard/cartera",
    roles: ["super_admin", "gerente_operativo", "contable"],
    showInHeader: false,
    showInDashboard: false,
    deprecated: true,
    note: "Consolidado en Finanzas."
  }
];

export const DASHBOARD_NAV_GROUPS: DashboardNavGroup[] = [
  { id: "inicio", label: "Inicio", href: "/dashboard", roles: ["super_admin", "gerente_operativo", "administrativo", "contable", "almacen", "lider_operativo", "tecnico"] },
  { id: "casos", label: "Casos", href: "/dashboard/casos", roles: ["super_admin", "gerente_operativo", "administrativo", "contable", "lider_operativo"] },
  {
    id: "proyectos",
    label: "Proyectos",
    href: "/dashboard/proyectos-tecnicos",
    roles: ["super_admin", "gerente_operativo", "administrativo", "lider_operativo"]
  },
  { id: "comercial", label: "Comercial", href: "/dashboard/cotizaciones", roles: ["super_admin", "gerente_operativo", "administrativo", "lider_operativo"] },
  { id: "operacion", label: "Operación", href: "/dashboard/agenda-operativa", roles: ["super_admin", "gerente_operativo", "administrativo", "lider_operativo"] },
  { id: "operacion-tecnico", label: "Operación", href: "/dashboard/mis-tareas", roles: ["tecnico"] },
  { id: "finanzas", label: "Finanzas", href: "/dashboard/finanzas", roles: ["super_admin", "gerente_operativo", "contable"] },
  { id: "recursos", label: "Recursos", href: "/dashboard/almacen", roles: ["super_admin", "gerente_operativo", "administrativo", "almacen"] },
  {
    id: "documentos",
    label: "Documentos",
    href: "/dashboard/ordenes-trabajo",
    roles: ["super_admin", "gerente_operativo", "administrativo", "lider_operativo"]
  }
];

function normalizeRole(role: AppRole | null): CoreRole | null {
  const normalized = normalizeAppRole(role);
  if (!normalized) return null;
  if (normalized === "cliente") return "tecnico";
  if (normalized === "contable" || normalized === "almacen" || normalized === "super_admin" || normalized === "gerente_operativo" || normalized === "administrativo" || normalized === "lider_operativo" || normalized === "tecnico") {
    return normalized;
  }
  return null;
}

export function getVisibleDashboardRole(role: AppRole | null): CoreRole | null {
  return normalizeRole(role);
}

export function getHeaderNavByRole(role: AppRole | null) {
  const normalized = normalizeRole(role);
  if (!normalized) {
    return [];
  }
  return DASHBOARD_NAV_ITEMS.filter((item) => item.showInHeader && item.roles.includes(normalized));
}

export function getHeaderNavGroupsByRole(role: AppRole | null) {
  const normalized = normalizeRole(role);
  if (!normalized) {
    return [];
  }
  return DASHBOARD_NAV_GROUPS.filter((item) => item.roles.includes(normalized));
}

export function getDashboardCardsByRole(role: AppRole | null) {
  const normalized = normalizeRole(role);
  if (!normalized) {
    return [];
  }
  return DASHBOARD_NAV_ITEMS.filter((item) => item.showInDashboard && item.roles.includes(normalized));
}

export function getDeprecatedRoutes() {
  return DASHBOARD_NAV_ITEMS.filter((item) => item.deprecated);
}

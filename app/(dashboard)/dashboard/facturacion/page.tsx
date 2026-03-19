import { redirect } from "next/navigation";

import { requirePageAccess } from "@/lib/auth/permissions";

export default async function FacturacionPage() {
  await requirePageAccess(
    ["administrador", "contabilidad"],
    "/dashboard",
    "Acceso denegado: tu rol no puede acceder a facturación."
  );
  redirect("/dashboard/finanzas");
}

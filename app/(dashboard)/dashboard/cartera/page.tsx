import { redirect } from "next/navigation";

import { requirePageAccess } from "@/lib/auth/permissions";

export default async function CarteraPage() {
  await requirePageAccess(
    ["administrador", "contabilidad"],
    "/dashboard",
    "Acceso denegado: tu rol no puede acceder a cartera."
  );
  redirect("/dashboard/finanzas");
}

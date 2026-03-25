import Link from "next/link";

import { requirePagePermission } from "@/lib/auth/permissions";
import { createAdminClient } from "@/lib/supabase/admin";

interface QrPageProps {
  searchParams: Promise<{ codigo?: string }>;
}

export default async function QrPage({ searchParams }: QrPageProps) {
  await requirePagePermission("ver_inventario", "/dashboard", "Acceso denegado a vista QR.");

  const params = await searchParams;
  const codigo = (params.codigo ?? "").trim();
  const supabase = createAdminClient();

  const [itemResp, toolResp] = await Promise.all([
    codigo
      ? supabase
          .from("inventory_items")
          .select("id, code, name, unit, stock_current, stock_min, average_unit_cost, qr_code, inventory_categories(name), storage_locations(name)")
          .or(`qr_code.eq.${codigo},code.eq.${codigo}`)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null } as any),
    codigo
      ? supabase
          .from("tools")
          .select(
            "id, code, name, serial_number, condition_status, operational_status, qr_code, tool_categories(name), storage_locations(name), profiles(full_name)"
          )
          .or(`qr_code.eq.${codigo},code.eq.${codigo}`)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null } as any)
  ]);

  return (
    <main>
      <div className="page-header">
        <div>
          <h1>Vista por QR</h1>
          <p>Consulta rápida de material o herramienta por código.</p>
        </div>
        <div className="inline-form">
          <Link href="/dashboard/almacen/materiales">Materiales</Link>
          <Link href="/dashboard/almacen/herramientas">Herramientas</Link>
        </div>
      </div>

      <section className="card">
        <form method="GET" className="inline-form">
          <input name="codigo" defaultValue={codigo} placeholder="Código QR / código interno" required />
          <button type="submit">Buscar</button>
        </form>
      </section>

      {codigo && !itemResp.data && !toolResp.data ? (
        <p className="feedback error">No se encontró recurso para el código consultado.</p>
      ) : null}

      {itemResp.data ? (
        <section className="card">
          <h2>Material encontrado</h2>
          <p>
            <strong>{itemResp.data.code}</strong> - {itemResp.data.name}
          </p>
          <p>
            Categoría: {(itemResp.data.inventory_categories as { name?: string } | null)?.name ?? "-"} | Ubicación:{" "}
            {(itemResp.data.storage_locations as { name?: string } | null)?.name ?? "-"}
          </p>
          <p>
            Stock: {Number(itemResp.data.stock_current)} {itemResp.data.unit} | Mínimo: {Number(itemResp.data.stock_min)}
          </p>
          <p>Costo promedio: {Number(itemResp.data.average_unit_cost).toLocaleString("es-CO")}</p>
        </section>
      ) : null}

      {toolResp.data ? (
        <section className="card">
          <h2>Herramienta encontrada</h2>
          <p>
            <strong>{toolResp.data.code}</strong> - {toolResp.data.name}
          </p>
          <p>
            Categoría: {(toolResp.data.tool_categories as { name?: string } | null)?.name ?? "-"} | Ubicación:{" "}
            {(toolResp.data.storage_locations as { name?: string } | null)?.name ?? "-"}
          </p>
          <p>
            Estado operativo: {toolResp.data.operational_status} | Condición: {toolResp.data.condition_status}
          </p>
          <p>Responsable actual: {(toolResp.data.profiles as { full_name?: string } | null)?.full_name ?? "-"}</p>
          <p>Serial: {toolResp.data.serial_number ?? "-"}</p>
        </section>
      ) : null}
    </main>
  );
}

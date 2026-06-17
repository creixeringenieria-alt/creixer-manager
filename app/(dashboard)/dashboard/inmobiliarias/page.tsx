import Link from "next/link";

import { requirePagePermission } from "@/lib/auth/permissions";
import { createAdminClient } from "@/lib/supabase/admin";

import { actualizarInmobiliariaAction, crearInmobiliariaAction } from "./actions";

interface InmobiliariasPageProps {
  searchParams: Promise<{ ok?: string; error?: string }>;
}

export default async function InmobiliariasPage({ searchParams }: InmobiliariasPageProps) {
  await requirePagePermission("crear_casos", "/dashboard", "Acceso denegado al módulo de inmobiliarias.");

  const params = await searchParams;
  const supabase = createAdminClient();
  const { data: inmobiliarias, error } = await supabase
    .from("clients")
    .select("id, name, client_type, tax_id, contact_name, contact_email, contact_phone, is_active, created_at")
    .eq("client_type", "Inmobiliaria")
    .order("created_at", { ascending: false });

  return (
    <main>
      <div className="page-header">
        <div>
          <h1>Inmobiliarias</h1>
          <p>Catálogo maestro de inmobiliarias para crear y relacionar casos.</p>
        </div>
        <Link href="/dashboard/configuracion">Volver a configuración</Link>
      </div>

      {params.error ? <p className="feedback error">{params.error}</p> : null}
      {params.ok ? <p className="feedback success">{params.ok}</p> : null}

      <section className="card">
        <h2>Nueva inmobiliaria</h2>
        <form action={crearInmobiliariaAction} className="form-grid">
          <input name="name" placeholder="Nombre" required />
          <input name="tax_id" placeholder="NIT (opcional)" />
          <input name="contact_name" placeholder="Contacto principal (opcional)" />
          <input type="email" name="contact_email" placeholder="Correo (opcional)" />
          <input name="contact_phone" placeholder="Teléfono (opcional)" />
          <button type="submit">Crear inmobiliaria</button>
        </form>
      </section>

      <section className="card">
        <h2>Listado</h2>
        {error ? <p className="feedback error">No fue posible cargar inmobiliarias: {error.message}</p> : null}
        {!inmobiliarias || inmobiliarias.length === 0 ? (
          <p>No hay inmobiliarias registradas.</p>
        ) : (
          <div className="clients-list">
            {inmobiliarias.map((row) => (
              <article className="client-item" key={row.id}>
                <form action={actualizarInmobiliariaAction} className="form-grid">
                  <input type="hidden" name="id" value={row.id} />
                  <input name="name" defaultValue={row.name} required />
                  <input name="tax_id" defaultValue={row.tax_id ?? ""} placeholder="NIT" />
                  <input name="contact_name" defaultValue={row.contact_name ?? ""} placeholder="Contacto principal" />
                  <input type="email" name="contact_email" defaultValue={row.contact_email ?? ""} placeholder="Correo" />
                  <input name="contact_phone" defaultValue={row.contact_phone ?? ""} placeholder="Teléfono" />
                  <label className="checkbox-row">
                    <input type="checkbox" name="is_active" defaultChecked={row.is_active} />
                    Inmobiliaria activa
                  </label>
                  <button type="submit">Guardar cambios</button>
                </form>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

import Link from "next/link";

import { requirePagePermission } from "@/lib/auth/permissions";
import { createAdminClient } from "@/lib/supabase/admin";

import { createClientAction, deleteClientAction, updateClientAction } from "./actions";

interface ClientsPageProps {
  searchParams: Promise<{ error?: string; ok?: string }>;
}

export default async function ClientsPage({ searchParams }: ClientsPageProps) {
  await requirePagePermission("ver_clientes", "/dashboard", "Acceso denegado: tu rol no puede gestionar clientes.");

  const params = await searchParams;
  const supabase = createAdminClient();

  const { data: clients, error } = await supabase
    .from("clients")
    .select("id, name, client_type, documentary_prefix, tax_id, contact_name, contact_email, contact_phone, is_active")
    .order("created_at", { ascending: false });

  return (
    <main>
      <div className="page-header">
        <div>
          <h1>Módulo de clientes</h1>
          <p>Administra inmobiliarias y su prefijo documental.</p>
        </div>
        <Link href="/dashboard">Volver al dashboard</Link>
      </div>

      {params.error ? <p className="feedback error">{params.error}</p> : null}
      {params.ok ? <p className="feedback success">{params.ok}</p> : null}

      <section className="card">
        <h2>Crear cliente</h2>
        <form action={createClientAction} className="client-form-grid">
          <input name="name" placeholder="Nombre del cliente" required />
          <select name="client_type" defaultValue="">
            <option value="">Tipo de cliente</option>
            <option value="Inmobiliaria">Inmobiliaria</option>
            <option value="Empresa">Empresa</option>
            <option value="Persona natural">Persona natural</option>
            <option value="Conjunto Residencial">Conjunto Residencial</option>
          </select>
          <input name="documentary_prefix" placeholder="Prefijo documental (ej: CRM)" maxLength={12} />
          <input name="tax_id" placeholder="NIT" />
          <input name="contact_name" placeholder="Nombre de contacto" />
          <input type="email" name="contact_email" placeholder="Correo de contacto" />
          <input name="contact_phone" placeholder="Teléfono de contacto" />
          <button type="submit">Crear cliente</button>
        </form>
      </section>

      <section className="card">
        <h2>Listado de clientes</h2>
        {error ? <p className="feedback error">No se pudo cargar el listado: {error.message}</p> : null}

        {!clients || clients.length === 0 ? (
          <p>No hay clientes registrados.</p>
        ) : (
          <div className="clients-list">
            {clients.map((client) => (
              <article className="client-item" key={client.id}>
                <form action={updateClientAction} className="client-form-grid">
                  <input type="hidden" name="id" value={client.id} />
                  <input name="name" defaultValue={client.name} required />
                  <select name="client_type" defaultValue={client.client_type ?? ""}>
                    <option value="">Tipo de cliente</option>
                    <option value="Inmobiliaria">Inmobiliaria</option>
                    <option value="Empresa">Empresa</option>
                    <option value="Persona natural">Persona natural</option>
                    <option value="Conjunto Residencial">Conjunto Residencial</option>
                  </select>
                  <input
                    name="documentary_prefix"
                    defaultValue={client.documentary_prefix ?? ""}
                    placeholder="Prefijo"
                    maxLength={12}
                  />
                  <input name="tax_id" defaultValue={client.tax_id ?? ""} placeholder="NIT" />
                  <input
                    name="contact_name"
                    defaultValue={client.contact_name ?? ""}
                    placeholder="Contacto"
                  />
                  <input
                    type="email"
                    name="contact_email"
                    defaultValue={client.contact_email ?? ""}
                    placeholder="Correo"
                  />
                  <input
                    name="contact_phone"
                    defaultValue={client.contact_phone ?? ""}
                    placeholder="Teléfono"
                  />
                  <div className="client-actions">
                    <button type="submit">Guardar cambios</button>
                  </div>
                </form>

                <form action={deleteClientAction}>
                  <input type="hidden" name="id" value={client.id} />
                  <button type="submit" className="danger-btn">
                    Eliminar cliente
                  </button>
                </form>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

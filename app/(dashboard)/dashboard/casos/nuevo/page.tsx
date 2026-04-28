import Link from "next/link";

import { requirePagePermission } from "@/lib/auth/permissions";
import { createAdminClient } from "@/lib/supabase/admin";

import { crearCasoAction } from "./actions";

interface NuevoCasoPageProps {
  searchParams: Promise<{ ok?: string; error?: string; q?: string }>;
}

interface ClientRow {
  id: string;
  name: string;
}

interface CaseRow {
  id: string;
  case_code?: string | null;
  flow_type?: string | null;
  service_area?: string | null;
  internal_client_code?: string | null;
  external_property_code?: string | null;
  external_case_id?: string | null;
  external_case_code?: string | null;
  bill_to_assigned_client?: boolean | null;
  billing_client_id?: string | null;
  status?: string | null;
  created_at: string;
  clients?: { name?: string } | { name?: string }[] | null;
}

export default async function NuevoCasoProyectoPage({ searchParams }: NuevoCasoPageProps) {
  await requirePagePermission("crear_casos", "/dashboard", "Acceso denegado para crear casos/proyectos.");

  const params = await searchParams;
  const supabase = createAdminClient() as any;
  const queryText = (params.q ?? "").trim();

  let recentCasesQuery = supabase
    .from("cases")
    .select(
      "id, case_code, flow_type, service_area, internal_client_code, external_property_code, external_case_id, external_case_code, bill_to_assigned_client, billing_client_id, status, created_at, clients(name)"
    )
    .order("created_at", { ascending: false })
    .limit(30);

  if (queryText) {
    recentCasesQuery = recentCasesQuery.or(
      `case_code.ilike.%${queryText}%,internal_client_code.ilike.%${queryText}%,external_property_code.ilike.%${queryText}%,external_case_id.ilike.%${queryText}%,external_case_code.ilike.%${queryText}%`
    );
  }

  const [clientsResp, recentCasesResp] = await Promise.all([
    supabase.from("clients").select("id, name").eq("is_active", true).order("name"),
    recentCasesQuery
  ]);

  const clients = ((clientsResp.data ?? []) as ClientRow[]) || [];
  const recentCases = ((recentCasesResp.data ?? []) as CaseRow[]) || [];
  const creationToken = crypto.randomUUID();

  return (
    <main>
      <div className="page-header">
        <div>
          <h1>Nuevo caso/proyecto</h1>
          <p>Entidad de entrada única. Al crear el caso se genera consecutivo automático.</p>
        </div>
        <Link href="/dashboard/casos">Volver a casos</Link>
      </div>

      {params.error ? <p className="feedback error">{params.error}</p> : null}
      {params.ok ? <p className="feedback success">{params.ok}</p> : null}

      <section className="card">
        <h2>Crear caso</h2>
        <form action={crearCasoAction} className="form-grid">
          <input type="hidden" name="creation_token" value={creationToken} />
          <div className="form-field">
            <label htmlFor="case-client-id">Cliente / Inmobiliaria</label>
            <select id="case-client-id" name="client_id" required defaultValue="">
              <option value="" disabled>
                Seleccionar cliente
              </option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
              ))}
            </select>
          </div>

          <div className="form-field">
            <label htmlFor="case-flow-type">Tipo de proyecto</label>
            <select id="case-flow-type" name="flow_type" required defaultValue="mantenimiento">
              <option value="mantenimiento">mantenimiento</option>
              <option value="consultoria">consultoria</option>
              <option value="interventoria">interventoria</option>
              <option value="obra_conjunto_residencial">obra_conjunto_residencial</option>
              <option value="reparacion">reparacion</option>
            </select>
          </div>

          <div className="form-field">
            <label htmlFor="case-internal-client-code">Código interno de la inmobiliaria</label>
            <input id="case-internal-client-code" name="internal_client_code" placeholder="Ej: APT-503-TORRE2" />
          </div>

          <div className="form-field">
            <label htmlFor="case-external-property-code">N° Inmueble / ID / Código del cliente</label>
            <input id="case-external-property-code" name="external_property_code" placeholder="Referencia tal como la maneja la inmobiliaria" />
          </div>

          <div className="form-field">
            <label htmlFor="case-external-id">ID externo del caso (opcional)</label>
            <input id="case-external-id" name="external_case_id" placeholder="ID interno del cliente" />
          </div>

          <div className="form-field">
            <label htmlFor="case-external-code">Código externo del caso (opcional)</label>
            <input id="case-external-code" name="external_case_code" placeholder="Código de ticket/solicitud del cliente" />
          </div>

          <div className="form-field">
            <label htmlFor="case-service-area">Caso / Requerimiento</label>
            <select id="case-service-area" name="service_area" required defaultValue="mantenimiento_general">
              <option value="hidraulico">hidraulico</option>
              <option value="electrico">electrico</option>
              <option value="gasodomestico">gasodomestico</option>
              <option value="albanileria">albanileria</option>
              <option value="acabados">acabados</option>
              <option value="mantenimiento_general">mantenimiento_general</option>
            </select>
          </div>

          <div className="form-field">
            <label htmlFor="case-status">Estado inicial</label>
            <input id="case-status" value="en_visita" readOnly />
          </div>

          <div className="form-field">
            <label htmlFor="case-priority">Prioridad</label>
            <select id="case-priority" name="priority" defaultValue="media">
              <option value="baja">baja</option>
              <option value="media">media</option>
              <option value="alta">alta</option>
              <option value="critica">critica</option>
            </select>
          </div>

          <div className="form-field">
            <label htmlFor="case-estimated-delivery">Fecha estimada de entrega (después de aprobación)</label>
            <input id="case-estimated-delivery" name="estimated_delivery_date" type="date" />
          </div>

          <div className="form-field">
            <label htmlFor="case-bill-to-assigned">¿Se factura a esta inmobiliaria?</label>
            <select id="case-bill-to-assigned" name="bill_to_assigned_client" defaultValue="si">
              <option value="si">Sí, se factura a la inmobiliaria asignada</option>
              <option value="no">No, se factura a otro cliente/tercero</option>
            </select>
          </div>

          <div className="form-field">
            <label htmlFor="case-billing-client-id">Cliente a facturar (si es diferente)</label>
            <select id="case-billing-client-id" name="billing_client_id" defaultValue="">
              <option value="">Sin cambio (usar inmobiliaria asignada)</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
              ))}
            </select>
          </div>

          <div className="form-field" style={{ gridColumn: "1 / -1" }}>
            <label htmlFor="case-billing-observations">Observación de facturación</label>
            <textarea id="case-billing-observations" name="billing_observations" placeholder="Ej: se factura al propietario final" />
          </div>

          <div className="form-field" style={{ gridColumn: "1 / -1" }}>
            <label htmlFor="case-description">Descripción del caso</label>
            <textarea id="case-description" name="description" placeholder="Detalle operativo del caso" />
          </div>

          <div className="form-field">
            <label htmlFor="case-document-type">Tipo de documento inicial</label>
            <select id="case-document-type" name="case_document_type" defaultValue="archivo_tecnico">
              <option value="convocatoria">convocatoria</option>
              <option value="terminos_referencia">terminos_referencia</option>
              <option value="anexos">anexos</option>
              <option value="planos">planos</option>
              <option value="documento_cliente">documento_cliente</option>
              <option value="archivo_tecnico">archivo_tecnico</option>
              <option value="otro">otro</option>
            </select>
          </div>

          <div className="form-field">
            <label htmlFor="case-document-name">Nombre para documentos (opcional)</label>
            <input id="case-document-name" name="case_document_name" placeholder="Ej: soporte inicial del caso" />
          </div>

          <div className="form-field" style={{ gridColumn: "1 / -1" }}>
            <label htmlFor="case-files">Fotos y archivos iniciales</label>
            <input
              id="case-files"
              name="case_files"
              type="file"
              multiple
              accept=".jpg,.jpeg,.png,.webp,.pdf,.doc,.docx,.xls,.xlsx,.zip,.rar"
            />
          </div>

          <div className="span-2" style={{ fontSize: "0.9rem", color: "#475569" }}>
            Al guardar, el sistema asigna consecutivo automáticamente (ejemplo: <strong>CAS-000001</strong>) y te envía al
            flujo correspondiente para continuar la operación.
          </div>

          <button type="submit">Crear caso con consecutivo</button>
        </form>
      </section>

      <section className="card">
        <h2>Últimos casos creados</h2>
        <form method="GET" className="inline-form" style={{ marginBottom: "0.75rem" }}>
          <input
            name="q"
            defaultValue={queryText}
            placeholder="Buscar por consecutivo, código interno, N° Inm, ID o código externo"
          />
          <button type="submit">Buscar</button>
        </form>
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Consecutivo</th>
                <th>Cliente</th>
                <th>Ref. cliente</th>
                <th>Tipo</th>
                <th>Especialidad</th>
                <th>Facturación</th>
                <th>Estado</th>
                <th>Fecha</th>
              </tr>
            </thead>
            <tbody>
              {recentCases.map((row) => {
                const clientRow = Array.isArray(row.clients) ? row.clients[0] : row.clients;
                return (
                  <tr key={row.id}>
                    <td>{row.case_code ?? `CASO-${row.id.slice(0, 8).toUpperCase()}`}</td>
                    <td>{clientRow?.name ?? "-"}</td>
                    <td>{[row.internal_client_code, row.external_property_code, row.external_case_id, row.external_case_code].filter(Boolean).join(" | ") || "-"}</td>
                    <td>{row.flow_type ?? "-"}</td>
                    <td>{row.service_area ?? "-"}</td>
                    <td>{row.bill_to_assigned_client === false ? "Tercero" : "Inmobiliaria"}</td>
                    <td>{row.status ?? "-"}</td>
                    <td>{new Date(row.created_at).toLocaleDateString("es-CO")}</td>
                  </tr>
                );
              })}
              {recentCases.length === 0 ? (
                <tr>
                  <td colSpan={8}>Aún no hay casos creados.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

import Link from "next/link";

import { generarDiagnosticoIaAction } from "@/app/(dashboard)/dashboard/configuracion/gerencial/actions";
import { APP_PERMISSIONS } from "@/lib/auth/permissions";
import { requireCurrentProfile } from "@/lib/auth/current-profile";
import { createAdminClient } from "@/lib/supabase/admin";

const ROLES_CRITICOS = [
  "super_admin",
  "gerente_operativo",
  "administrativo",
  "contable",
  "almacen",
  "lider_operativo",
  "tecnico",
  "cliente_inmobiliaria"
];

function getParamValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

async function loadConsoleData() {
  const supabase = createAdminClient();

  const [usersResp, clientsResp, casesResp, docsResp, rolePermissionsResp] = await Promise.all([
    supabase.from("profiles").select("id", { count: "exact", head: true }),
    supabase.from("clients").select("id", { count: "exact", head: true }),
    supabase.from("cases").select("id", { count: "exact", head: true }),
    supabase.from("case_documents").select("id", { count: "exact", head: true }),
    supabase.from("role_permissions").select("role, permission_key")
  ]);

  const errors = [
    ["profiles", usersResp.error],
    ["clients", clientsResp.error],
    ["cases", casesResp.error],
    ["case_documents", docsResp.error],
    ["role_permissions", rolePermissionsResp.error]
  ].filter(([, error]) => Boolean(error));

  if (errors.length > 0) {
    console.error(
      "[configuracion-gerencial] queries failed",
      errors.map(([query, error]) => ({ query, error: (error as { message?: string })?.message }))
    );
  }

  const permissionRows = (rolePermissionsResp.data ?? []) as Array<{ role: string; permission_key: string }>;
  const permissionsByRole = ROLES_CRITICOS.map((role) => ({
    role,
    total: permissionRows.filter((row) => row.role === role).length
  }));

  return {
    usersCount: usersResp.count ?? 0,
    clientsCount: clientsResp.count ?? 0,
    casesCount: casesResp.count ?? 0,
    docsCount: docsResp.count ?? 0,
    permissionsCount: permissionRows.length,
    permissionsByRole,
    hasErrors: errors.length > 0
  };
}

export default async function ConfiguracionGerencialPage({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const profile = await requireCurrentProfile();

  if (profile.role !== "super_admin") {
    return (
      <main>
        <section className="card">
          <h1>Acceso denegado</h1>
          <p>Esta consola gerencial está habilitada solo para el rol super_admin.</p>
          <Link href="/dashboard">Volver al dashboard</Link>
        </section>
      </main>
    );
  }

  const params = (await searchParams) ?? {};
  const error = getParamValue(params.error);
  const ok = getParamValue(params.ok);
  const aiResult = getParamValue(params.ai_result);

  let consoleData = {
    usersCount: 0,
    clientsCount: 0,
    casesCount: 0,
    docsCount: 0,
    permissionsCount: 0,
    permissionsByRole: ROLES_CRITICOS.map((role) => ({ role, total: 0 })),
    hasErrors: false
  };
  let loadError: string | null = null;

  try {
    consoleData = await loadConsoleData();
  } catch (loadConsoleError) {
    console.error("[configuracion-gerencial] load failed", {
      error: loadConsoleError instanceof Error ? loadConsoleError.message : String(loadConsoleError)
    });
    loadError = "No fue posible cargar todos los datos gerenciales. La consola sigue disponible en modo seguro.";
  }

  const aiConfigured = Boolean(process.env.OPENAI_API_KEY);

  return (
    <main>
      <div className="page-header">
        <div>
          <p className="section-eyebrow">Solo super_admin</p>
          <h1>Configuración gerencial</h1>
          <p>Centro privado para operación, permisos y análisis con IA de Creixer Manager.</p>
        </div>
        <Link href="/dashboard/configuracion">Volver a configuración</Link>
      </div>

      {error ? <div className="feedback error">{error}</div> : null}
      {ok ? <div className="feedback success">{ok}</div> : null}
      {loadError ? <div className="feedback error">{loadError}</div> : null}
      {consoleData.hasErrors ? (
        <div className="feedback error">Algunas consultas de configuración fallaron. Revisa logs del servidor.</div>
      ) : null}

      <section className="metrics-grid">
        <article className="card metric-card">
          <p className="metric-label">Usuarios</p>
          <p className="metric-value">{consoleData.usersCount}</p>
        </article>
        <article className="card metric-card">
          <p className="metric-label">Clientes / inmobiliarias</p>
          <p className="metric-value">{consoleData.clientsCount}</p>
        </article>
        <article className="card metric-card">
          <p className="metric-label">Casos</p>
          <p className="metric-value">{consoleData.casesCount}</p>
        </article>
        <article className="card metric-card">
          <p className="metric-label">Documentos</p>
          <p className="metric-value">{consoleData.docsCount}</p>
        </article>
        <article className="card metric-card">
          <p className="metric-label">Permisos activos</p>
          <p className="metric-value">{consoleData.permissionsCount}</p>
        </article>
        <article className="card metric-card">
          <p className="metric-label">IA</p>
          <p className="metric-value">{aiConfigured ? "Activa" : "Pendiente"}</p>
        </article>
      </section>

      <section className="module-grid">
        <article className="card">
          <h2>Operación</h2>
          <p>Accesos rápidos para revisar el flujo operativo completo.</p>
          <div className="quick-links">
            <Link href="/dashboard/casos">Casos</Link>
            <Link href="/dashboard/casos/nuevo">Crear caso</Link>
            <Link href="/dashboard/agenda-operativa">Agenda operativa</Link>
            <Link href="/dashboard/finanzas">Finanzas</Link>
          </div>
        </article>

        <article className="card">
          <h2>Permisos</h2>
          <p>Resumen por rol. super_admin conserva acceso total a los permisos del sistema.</p>
          <table className="data-table compact-table">
            <thead>
              <tr>
                <th>Rol</th>
                <th>Permisos</th>
              </tr>
            </thead>
            <tbody>
              {consoleData.permissionsByRole.map((row) => (
                <tr key={row.role}>
                  <td>{row.role}</td>
                  <td>{row.role === "super_admin" ? APP_PERMISSIONS.length : row.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <Link href="/dashboard/configuracion/roles-accesos">Ver matriz completa</Link>
        </article>
      </section>

      <section className="card">
        <div className="section-heading-row">
          <div>
            <h2>IA para diagnósticos y análisis</h2>
            <p>
              La conexión se hace con OpenAI API mediante <strong>OPENAI_API_KEY</strong>, no con una sesión personal de
              ChatGPT. Así queda seguro y usable por el ERP.
            </p>
          </div>
          <span className={aiConfigured ? "status-pill status-success" : "status-pill status-warning"}>
            {aiConfigured ? "OPENAI_API_KEY configurada" : "Falta OPENAI_API_KEY"}
          </span>
        </div>

        <form action={generarDiagnosticoIaAction} className="ai-console-form">
          <div className="form-grid">
            <div className="form-field">
              <label htmlFor="tipo_analisis">Tipo de análisis</label>
              <select id="tipo_analisis" name="tipo_analisis" defaultValue="diagnostico_tecnico">
                <option value="diagnostico_tecnico">Diagnóstico técnico</option>
                <option value="analisis_caso">Análisis de caso</option>
                <option value="riesgo_operativo">Riesgo operativo</option>
                <option value="resumen_gerencial">Resumen para gerencia</option>
              </select>
            </div>
          </div>
          <div className="form-field">
            <label htmlFor="contexto">Contexto para la IA</label>
            <textarea
              id="contexto"
              name="contexto"
              rows={8}
              placeholder="Ej: caso de filtración en baño, fotos indican humedad en muro, cliente reporta daño hace 3 días..."
            />
          </div>
          <button type="submit" className="primary-action-button">
            Generar análisis con IA
          </button>
        </form>

        {aiResult ? (
          <div className="ai-result-box">
            <h3>Resultado IA</h3>
            <pre>{aiResult}</pre>
          </div>
        ) : null}
      </section>
    </main>
  );
}

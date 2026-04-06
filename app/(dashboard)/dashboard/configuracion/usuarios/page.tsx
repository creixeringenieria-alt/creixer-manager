import Link from "next/link";

import { getCurrentUserPermissions } from "@/lib/auth/permissions";
import { isComplementaryProfileComplete } from "@/lib/auth/profile-completion";
import { CORE_APP_ROLES } from "@/lib/auth/roles";
import { createAdminClient } from "@/lib/supabase/admin";
import { adminUpdateUserBasicDataAction } from "./actions";

interface UserRow {
  id: string;
  full_name: string | null;
  role: string | null;
  user_type: "colaborador_creixer" | "usuario_inmobiliaria" | null;
  organization_name: string | null;
  client_id: string | null;
  document_type: string | null;
  document_number: string | null;
  phone: string | null;
  is_active: boolean | null;
  basic_data_locked: boolean | null;
  created_at: string;
  clients: { name?: string } | null;
  profile_complementary_data:
    | {
        fecha_nacimiento?: string | null;
        grupo_sanguineo_rh?: string | null;
        eps?: string | null;
        arl?: string | null;
        fondo_pension?: string | null;
        fondo_cesantias?: string | null;
        direccion_residencia?: string | null;
        ciudad_residencia?: string | null;
        contacto_emergencia_nombre?: string | null;
        contacto_emergencia_telefono?: string | null;
        parentesco_contacto_emergencia?: string | null;
      }
    | {
        fecha_nacimiento?: string | null;
        grupo_sanguineo_rh?: string | null;
        eps?: string | null;
        arl?: string | null;
        fondo_pension?: string | null;
        fondo_cesantias?: string | null;
        direccion_residencia?: string | null;
        ciudad_residencia?: string | null;
        contacto_emergencia_nombre?: string | null;
        contacto_emergencia_telefono?: string | null;
        parentesco_contacto_emergencia?: string | null;
      }[]
    | null;
}

export default async function ConfiguracionUsuariosPage() {
  const context = await getCurrentUserPermissions();
  if (!context.userId) {
    return (
      <main>
        <p className="feedback error">Debes iniciar sesión.</p>
      </main>
    );
  }
  if (context.normalizedRole !== "super_admin") {
    return (
      <main>
        <p className="feedback error">Acceso denegado. Esta sección es exclusiva para super_admin.</p>
      </main>
    );
  }
  const canEditRole = context.normalizedRole === "super_admin";
  const canEditUsers = context.normalizedRole === "super_admin";

  const supabase = createAdminClient();
  const [{ data: users, error }, { data: clients }] = await Promise.all([
    supabase
      .from("profiles")
      .select(
        "id, full_name, role, user_type, organization_name, client_id, clients(name), document_type, document_number, phone, is_active, basic_data_locked, created_at, profile_complementary_data(fecha_nacimiento, grupo_sanguineo_rh, eps, arl, fondo_pension, fondo_cesantias, direccion_residencia, ciudad_residencia, contacto_emergencia_nombre, contacto_emergencia_telefono, parentesco_contacto_emergencia)"
      )
      .order("created_at", { ascending: false })
      .limit(200),
    supabase.from("clients").select("id, name").eq("is_active", true).order("name")
  ]);

  return (
    <main>
      <div className="page-header">
        <div>
          <h1>Configuración - Usuarios</h1>
          <p>Usuarios autenticados, rol vigente e inmobiliaria asociada.</p>
        </div>
        <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
          <Link href="/dashboard/configuracion/usuarios/export">Descargar CSV</Link>
          <Link href="/dashboard/configuracion">Volver a configuración</Link>
        </div>
      </div>

      {error ? <p className="feedback error">No fue posible cargar usuarios: {error.message}</p> : null}

      <section className="card">
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Usuario</th>
                <th>Rol</th>
                <th>Tipo usuario</th>
                <th>Organización</th>
                <th>Documento</th>
                <th>Teléfono</th>
                <th>Activo</th>
                <th>Edición básica</th>
                <th>Perfil</th>
                <th>ID</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {((users ?? []) as UserRow[]).map((user) => {
                const complementaryRaw = user.profile_complementary_data ?? null;
                const complementary = Array.isArray(complementaryRaw) ? complementaryRaw[0] ?? null : complementaryRaw;
                const complete = isComplementaryProfileComplete(complementary ?? null);

                return (
                  <tr key={user.id}>
                    <td>{user.full_name ?? "-"}</td>
                    <td>{user.role ?? "-"}</td>
                    <td>{user.user_type === "usuario_inmobiliaria" ? "Usuario Inmobiliaria" : "Colaborador Creixer"}</td>
                    <td>
                      {user.user_type === "usuario_inmobiliaria"
                        ? (user.clients as { name?: string } | null)?.name ?? "Inmobiliaria no asociada"
                        : user.organization_name ?? "Creixer Ingeniería S.A.S."}
                    </td>
                    <td>{[user.document_type, user.document_number].filter(Boolean).join(": ") || "-"}</td>
                    <td>{user.phone ?? "-"}</td>
                    <td>{user.is_active === false ? "No" : "Sí"}</td>
                    <td>{user.basic_data_locked ? "Solo super_admin" : "Abierta"}</td>
                    <td>{complete ? "Completo" : "Incompleto"}</td>
                    <td>{user.id}</td>
                    <td>
                      {canEditUsers ? (
                        <details>
                          <summary>Editar</summary>
                          <form action={adminUpdateUserBasicDataAction} className="form-grid" style={{ marginTop: "0.5rem" }}>
                            <input type="hidden" name="id" value={user.id} />
                            <div className="form-field">
                              <label htmlFor={`full_name-${user.id}`}>Nombre completo</label>
                              <input id={`full_name-${user.id}`} name="full_name" defaultValue={user.full_name ?? ""} />
                            </div>
                            <div className="form-field">
                              <label htmlFor={`phone-${user.id}`}>Teléfono</label>
                              <input id={`phone-${user.id}`} name="phone" defaultValue={user.phone ?? ""} />
                            </div>
                            <div className="form-field">
                              <label htmlFor={`document_type-${user.id}`}>Tipo documento</label>
                              <select id={`document_type-${user.id}`} name="document_type" defaultValue={user.document_type ?? ""}>
                                <option value="">Seleccionar</option>
                                <option value="Cédula de ciudadanía">Cédula de ciudadanía</option>
                                <option value="PPT">PPT</option>
                                <option value="Cédula de extranjería">Cédula de extranjería</option>
                              </select>
                            </div>
                            <div className="form-field">
                              <label htmlFor={`document_number-${user.id}`}>Número documento</label>
                              <input
                                id={`document_number-${user.id}`}
                                name="document_number"
                                defaultValue={user.document_number ?? ""}
                              />
                            </div>
                            <div className="form-field">
                              <label htmlFor={`is_active-${user.id}`}>Estado activo</label>
                              <select id={`is_active-${user.id}`} name="is_active" defaultValue={user.is_active === false ? "false" : "true"}>
                                <option value="true">Activo</option>
                                <option value="false">Inactivo</option>
                              </select>
                            </div>
                            <div className="form-field">
                              <label htmlFor={`role-${user.id}`}>Rol base</label>
                              {canEditRole ? (
                                <select id={`role-${user.id}`} name="role" defaultValue={user.role ?? "tecnico"}>
                                  <optgroup label="Roles internos Creixer">
                                    {CORE_APP_ROLES.filter((roleKey) => roleKey !== "cliente_inmobiliaria").map((roleKey) => (
                                      <option key={roleKey} value={roleKey}>
                                        {roleKey}
                                      </option>
                                    ))}
                                  </optgroup>
                                  <optgroup label="Roles externos">
                                    <option value="cliente_inmobiliaria">cliente_inmobiliaria</option>
                                  </optgroup>
                                </select>
                              ) : (
                                <input id={`role-${user.id}`} value={user.role ?? ""} readOnly />
                              )}
                            </div>
                            <div className="form-field">
                              <label htmlFor={`user_type-${user.id}`}>Tipo de usuario</label>
                              <select id={`user_type-${user.id}`} name="user_type" defaultValue={user.user_type ?? "colaborador_creixer"}>
                                <option value="colaborador_creixer">Colaborador Creixer</option>
                                <option value="usuario_inmobiliaria">Usuario Inmobiliaria</option>
                              </select>
                            </div>
                            <div className="form-field">
                              <label htmlFor={`organization_name-${user.id}`}>Organización (si colaborador)</label>
                              <input
                                id={`organization_name-${user.id}`}
                                name="organization_name"
                                defaultValue={user.organization_name ?? "Creixer Ingeniería S.A.S."}
                              />
                            </div>
                            <div className="form-field">
                              <label htmlFor={`client_id-${user.id}`}>Inmobiliaria (si usuario inmobiliaria)</label>
                              <select id={`client_id-${user.id}`} name="client_id" defaultValue={user.client_id ?? ""}>
                                <option value="">Sin inmobiliaria</option>
                                {(clients ?? []).map((client) => (
                                  <option key={client.id} value={client.id}>
                                    {client.name}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <p style={{ gridColumn: "1 / -1", margin: 0, fontSize: "0.8rem", color: "#475569" }}>
                              Si eliges <strong>Colaborador Creixer</strong>, el sistema guarda organización Creixer y limpia
                              inmobiliaria. Si eliges <strong>Usuario Inmobiliaria</strong>, exige inmobiliaria y rol externo.
                            </p>
                            <button type="submit">Guardar</button>
                          </form>
                        </details>
                      ) : (
                        <span>-</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

import Link from "next/link";

import { requireCurrentProfile } from "@/lib/auth/current-profile";

import {
  updateOwnBasicProfileAction,
  updateOwnComplementaryProfileAction
} from "@/app/(dashboard)/dashboard/perfil/actions";

interface PerfilDashboardPageProps {
  searchParams: Promise<{ ok?: string; error?: string }>;
}

export default async function PerfilDashboardPage({ searchParams }: PerfilDashboardPageProps) {
  const params = await searchParams;
  const profile = await requireCurrentProfile();
  const complementary = profile.complementary;

  return (
    <main>
      <div className="page-header">
        <div>
          <h1>Mi perfil</h1>
          <p>Consulta y edita tu información básica y tu perfil laboral/complementario.</p>
        </div>
        <Link href="/dashboard/configuracion">Volver a configuración</Link>
      </div>

      {params.error ? <p className="feedback error">{params.error}</p> : null}
      {params.ok ? <p className="feedback success">{params.ok}</p> : null}

      <section className="card">
        <h2 style={{ marginTop: 0 }}>Datos básicos de usuario</h2>
        <form action={updateOwnBasicProfileAction} className="form-grid">
          <input type="hidden" name="redirect_to" value="/dashboard/perfil" />
          <div className="form-field">
            <label htmlFor="full_name">Nombre completo</label>
            <input id="full_name" name="full_name" defaultValue={profile.fullName ?? ""} />
          </div>
          <div className="form-field">
            <label htmlFor="email_readonly">Correo</label>
            <input id="email_readonly" value={profile.email ?? ""} readOnly />
          </div>
          <div className="form-field">
            <label htmlFor="role_readonly">Rol base</label>
            <input id="role_readonly" value={profile.role} readOnly />
          </div>
          <div className="form-field">
            <label htmlFor="user_type_readonly">Tipo de usuario</label>
            <input
              id="user_type_readonly"
              value={profile.userType === "colaborador_creixer" ? "Colaborador Creixer" : "Usuario Inmobiliaria"}
              readOnly
            />
          </div>
          <div className="form-field">
            <label htmlFor="organization_readonly">Organización</label>
            <input
              id="organization_readonly"
              value={
                profile.userType === "colaborador_creixer"
                  ? profile.organizationName ?? "Creixer Ingeniería S.A.S."
                  : profile.clientName ?? "Inmobiliaria no asociada"
              }
              readOnly
            />
          </div>
          <div className="form-field">
            <label htmlFor="phone">Teléfono</label>
            <input id="phone" name="phone" defaultValue={profile.phone ?? ""} />
          </div>
          <div className="form-field">
            <label htmlFor="document_type">Tipo de documento</label>
            <input id="document_type" name="document_type" defaultValue={profile.documentType ?? ""} />
          </div>
          <div className="form-field">
            <label htmlFor="document_number">Número de documento</label>
            <input id="document_number" name="document_number" defaultValue={profile.documentNumber ?? ""} />
          </div>
          <button type="submit">Guardar datos básicos</button>
        </form>
      </section>

      <section className="card">
        <h2 style={{ marginTop: 0 }}>Perfil laboral y datos complementarios</h2>
        {!profile.profileComplete ? (
          <p className="feedback error" style={{ marginTop: 0 }}>
            Perfil incompleto: completa los campos obligatorios para operar sin restricciones.
          </p>
        ) : (
          <p className="feedback success" style={{ marginTop: 0 }}>
            Perfil complementario completo.
          </p>
        )}

        <form action={updateOwnComplementaryProfileAction} className="form-grid">
          <input type="hidden" name="redirect_to" value="/dashboard/perfil" />

          <div className="form-field">
            <label htmlFor="fecha_nacimiento">Fecha de nacimiento</label>
            <input
              id="fecha_nacimiento"
              type="date"
              name="fecha_nacimiento"
              defaultValue={complementary?.fecha_nacimiento ?? ""}
              required
            />
          </div>
          <div className="form-field">
            <label htmlFor="grupo_sanguineo_rh">Grupo sanguíneo RH</label>
            <input id="grupo_sanguineo_rh" name="grupo_sanguineo_rh" defaultValue={complementary?.grupo_sanguineo_rh ?? ""} required />
          </div>
          <div className="form-field">
            <label htmlFor="eps">EPS</label>
            <input id="eps" name="eps" defaultValue={complementary?.eps ?? ""} required />
          </div>
          <div className="form-field">
            <label htmlFor="arl">ARL</label>
            <input id="arl" name="arl" defaultValue={complementary?.arl ?? ""} required />
          </div>
          <div className="form-field">
            <label htmlFor="fondo_pension">Fondo de pensión</label>
            <input id="fondo_pension" name="fondo_pension" defaultValue={complementary?.fondo_pension ?? ""} required />
          </div>
          <div className="form-field">
            <label htmlFor="fondo_cesantias">Fondo de cesantías</label>
            <input id="fondo_cesantias" name="fondo_cesantias" defaultValue={complementary?.fondo_cesantias ?? ""} required />
          </div>
          <div className="form-field">
            <label htmlFor="direccion_residencia">Dirección de residencia</label>
            <input
              id="direccion_residencia"
              name="direccion_residencia"
              defaultValue={complementary?.direccion_residencia ?? ""}
              required
            />
          </div>
          <div className="form-field">
            <label htmlFor="ciudad_residencia">Ciudad de residencia</label>
            <input id="ciudad_residencia" name="ciudad_residencia" defaultValue={complementary?.ciudad_residencia ?? ""} required />
          </div>
          <div className="form-field">
            <label htmlFor="contacto_emergencia_nombre">Contacto de emergencia</label>
            <input
              id="contacto_emergencia_nombre"
              name="contacto_emergencia_nombre"
              defaultValue={complementary?.contacto_emergencia_nombre ?? ""}
              required
            />
          </div>
          <div className="form-field">
            <label htmlFor="contacto_emergencia_telefono">Teléfono contacto de emergencia</label>
            <input
              id="contacto_emergencia_telefono"
              name="contacto_emergencia_telefono"
              defaultValue={complementary?.contacto_emergencia_telefono ?? ""}
              required
            />
          </div>
          <div className="form-field">
            <label htmlFor="parentesco_contacto_emergencia">Parentesco contacto de emergencia</label>
            <input
              id="parentesco_contacto_emergencia"
              name="parentesco_contacto_emergencia"
              defaultValue={complementary?.parentesco_contacto_emergencia ?? ""}
              required
            />
          </div>
          <div className="form-field" style={{ gridColumn: "1 / -1" }}>
            <label htmlFor="observaciones_medicas_relevantes">Observaciones médicas relevantes</label>
            <textarea
              id="observaciones_medicas_relevantes"
              name="observaciones_medicas_relevantes"
              defaultValue={complementary?.observaciones_medicas_relevantes ?? ""}
            />
          </div>
          <button type="submit">Guardar perfil complementario</button>
        </form>
      </section>
    </main>
  );
}

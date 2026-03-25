import { redirect } from "next/navigation";

import { requireCurrentProfile } from "@/lib/auth/current-profile";

import { updateOwnComplementaryProfileAction } from "@/app/(dashboard)/dashboard/perfil/actions";

interface CompletarPerfilPageProps {
  searchParams: Promise<{ ok?: string; error?: string }>;
}

export default async function CompletarPerfilPage({ searchParams }: CompletarPerfilPageProps) {
  const params = await searchParams;
  const profile = await requireCurrentProfile();
  const complementary = profile.complementary;

  if (profile.profileComplete) {
    redirect("/dashboard");
  }

  return (
    <main>
      <section className="card" style={{ maxWidth: 860, margin: "0 auto" }}>
        <h1 style={{ marginTop: 0 }}>Completar perfil laboral</h1>
        <p>
          Tu sesión está activa, pero falta información obligatoria para continuar. Completa este formulario una sola vez y
          luego podrás usar el dashboard normalmente.
        </p>
        <p className="feedback" style={{ marginTop: "0.5rem" }}>
          Tipo de usuario:{" "}
          <strong>{profile.userType === "colaborador_creixer" ? "Colaborador Creixer" : "Usuario Inmobiliaria"}</strong> | Organización:{" "}
          <strong>
            {profile.userType === "colaborador_creixer"
              ? profile.organizationName ?? "Creixer Ingeniería S.A.S."
              : profile.clientName ?? "Inmobiliaria no asociada"}
          </strong>
        </p>

        {params.error ? <p className="feedback error">{params.error}</p> : null}
        {params.ok ? <p className="feedback success">{params.ok}</p> : null}

        <form action={updateOwnComplementaryProfileAction} className="form-grid">
          <input type="hidden" name="redirect_to" value="/dashboard/perfil/completar" />

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
          <button type="submit">Guardar y continuar</button>
        </form>
      </section>
    </main>
  );
}

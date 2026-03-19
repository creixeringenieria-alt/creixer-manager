import { loginWithPasswordAction } from "./actions";

interface LoginPageProps {
  searchParams: Promise<{ error?: string }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;

  return (
    <main>
      <div className="card">
        <img src="/logo-creixer.png" alt="Creixer" className="login-logo" />
        <h1>Ingreso</h1>
        <p>Inicia sesión con tu cuenta de Creixer Manager.</p>

        {params.error ? <p className="feedback error">{params.error}</p> : null}

        <form action={loginWithPasswordAction} className="form-grid">
          <input type="email" name="email" placeholder="Correo" required />
          <input type="password" name="password" placeholder="Contraseña" required />
          <button type="submit">Iniciar sesión</button>
        </form>
      </div>
    </main>
  );
}

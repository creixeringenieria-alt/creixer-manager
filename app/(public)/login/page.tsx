import { loginWithPasswordAction } from "./actions";

interface LoginPageProps {
  searchParams: Promise<{ error?: string }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;

  return (
    <main className="login-main">
      <div className="card login-card">
        <img src="/logo-creixer.png" alt="Creixer Ingeniería" className="login-logo" />
        <h1>Creixer Manager</h1>
        <p className="login-subtitle">Plataforma operativa y gerencial de Creixer Ingeniería</p>

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

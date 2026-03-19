# Deploy en Vercel - Creixer Manager

Esta guía deja el proyecto listo para acceso desde cualquier dispositivo con login.

## 1) Variables de entorno en Vercel

En Vercel, agrega estas variables para los entornos `Production`, `Preview` y `Development`:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

Notas:
- Para autenticación (login/sesión) son obligatorias `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- En este proyecto también se usa `SUPABASE_SERVICE_ROLE_KEY` en acciones de servidor para módulos administrativos (finanzas, etc.). Si no la configuras, esas acciones fallan en producción.

## 2) Configuración en Supabase Auth (producción)

En Supabase Dashboard:

1. Ve a `Authentication` -> `URL Configuration`.
2. Define `Site URL` con tu dominio de producción en Vercel, por ejemplo:
   - `https://creixer-manager.vercel.app`
   - o tu dominio propio, por ejemplo `https://app.creixer.com`
3. En `Redirect URLs`, agrega:
   - `https://<tu-proyecto>.vercel.app/**`
   - `https://<tu-dominio>/**` (si aplica)
   - `http://localhost:3000/**` (para desarrollo local)

## 3) Publicar en Vercel (pasos exactos)

### Opción A: Desde la web de Vercel (recomendado)

1. Sube tu código a GitHub.
2. Entra a [Vercel](https://vercel.com) -> `Add New...` -> `Project`.
3. Importa el repositorio `Creixer Manager`.
4. Framework detectado: `Next.js` (dejar por defecto).
5. En `Environment Variables`, carga las 3 variables listadas arriba.
6. Clic en `Deploy`.

### Opción B: CLI de Vercel

```bash
npm i -g vercel
vercel login
vercel
vercel --prod
```

Durante el flujo, define las variables de entorno cuando las solicite (o desde panel luego).

## 4) Verificaciones post-deploy (autenticación y acceso)

1. Abre `https://<tu-dominio>/login`.
2. Inicia sesión con un usuario existente en Supabase Auth.
3. Verifica redirección por rol:
   - `administrador` -> `/dashboard`
   - `asistente` -> `/dashboard`
   - `tecnico` -> `/dashboard/mis-tareas`
   - `contabilidad` -> `/dashboard/finanzas`
4. Intenta abrir `/dashboard` sin sesión (en incógnito):
   - Debe redirigir a `/login`.
5. Intenta abrir una ruta no permitida para tu rol:
   - Debe redirigir o mostrar acceso denegado.

## 5) Checklist de problemas comunes

- Login no persiste sesión:
  - Revisa `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
  - Revisa `Site URL` y `Redirect URLs` en Supabase Auth.
- Acciones server fallan en producción:
  - Falta `SUPABASE_SERVICE_ROLE_KEY` en Vercel.
- Errores por datos faltantes:
  - Ejecuta migraciones en la base destino con `supabase db push` antes de usar módulos.

## 6) Comandos útiles locales

```bash
npm run build
npm run dev
```

`npm run build` ya valida que el proyecto compile para producción.

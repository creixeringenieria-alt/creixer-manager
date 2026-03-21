# Creixer Manager

Sistema para administrar una empresa de mantenimiento.

## Stack

- Frontend: Next.js (App Router, TypeScript)
- Backend/Auth/DB: Supabase
- Almacenamiento de fotos: Supabase Storage

## Módulos de negocio

- Usuarios y roles (`administrador`, `tecnico`, `cliente`)
- Clientes (inmobiliarias)
- Inmuebles
- Requerimientos de mantenimiento
- Diagnósticos técnicos
- Cotizaciones
- Órdenes de trabajo
- Evidencias fotográficas

## Estructura inicial

- `app/`: rutas y layouts de Next.js
- `lib/supabase/`: clientes de Supabase (browser/server/middleware)
- `lib/auth/`: lógica de roles
- `types/`: tipos compartidos
- `docs/`: arquitectura
- `supabase/migrations/`: esquema SQL

## Primeros pasos

1. Instalar dependencias:

```bash
npm install
```

2. Copiar variables de entorno:

```bash
cp .env.example .env.local
```

3. Configurar Supabase y ejecutar migraciones:

```bash
supabase db push
```

4. Ejecutar entorno local:

```bash
npm run dev
```

## Variables de entorno

Revisar `.env.example`.

## Deploy en producción

Guía paso a paso para Vercel + Supabase Auth:

- [docs/deploy-vercel.md](/Users/juliangamboa/Documents/Creixer Manager/docs/deploy-vercel.md)

## Roles y permisos

- [docs/roles-y-permisos.md](/Users/juliangamboa/Documents/Creixer Manager/docs/roles-y-permisos.md)

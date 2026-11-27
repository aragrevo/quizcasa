# CLAUDE.md

Este archivo orienta a Claude Code (claude.ai/code) cuando trabaja con el código de este repositorio.

@AGENTS.md

## Comandos

- `npm run dev` — servidor de desarrollo (Turbopack) en http://localhost:3000
- `npm run build` — build de producción (Turbopack); también hace la comprobación de tipos
- `npm run lint` — ESLint (config plana con las reglas core-web-vitals + TypeScript de Next)

No hay tests. Las variables de entorno van en `.env.local` (ver `.env.example`): URL y publishable/anon key de Supabase, `ANTHROPIC_API_KEY`, `ANTHROPIC_WORKSPACE_ID` opcional (solo para claves `sk-ant-usr...`), `GEMINI_API_KEY` y `CRON_SECRET`.

## Qué es

QuizCasa es una app tipo Kahoot para que un alumno de secundaria estudie: se suben fotos de los apuntes de un tema, Claude genera un quiz y el repaso espaciado Leitner vuelve a mostrar las preguntas falladas. Los textos de la interfaz, los comentarios del código y el README están en español: los nuevos textos y comentarios también deben ir en español. Se despliega en Vercel y se usa desde el celular como PWA (`public/manifest.webmanifest`).

## Arquitectura

**Next.js 16 App Router + Supabase, casi todo en el cliente.** Cada página de `app/` es un componente `"use client"` que consulta Supabase directamente desde el navegador con `lib/supabase/client.ts`. No hay capa de datos en el servidor; la autorización la aplica el Row Level Security de Postgres, no el código de la app. Solo hay tres rutas de API:
- `app/api/generate/route.ts` — el único sitio donde se usa la API key de Anthropic.
- `app/api/lesson/route.ts` — repaso del tema con Gemini (`GEMINI_API_KEY`, modelo `gemini-4-hydrogen` con respaldo `gemini-3.5-flash` si da 404/429/500/503, en `generateWithFallback` de `lib/gemini.ts`): crea desde las transcripciones unas tarjetas (`LessonSchema`/`buildLessonPrompt` de `lib/prompts.ts`) y las guarda en `topics.lesson`. Se pone a `null` cuando entran apuntes nuevos y la página del tema lo vuelve a crear en segundo plano.
- `app/api/keepalive/route.ts` — llamada diaria de Vercel Cron (`vercel.json`), protegida con `CRON_SECRET`, para que Supabase no pause el proyecto gratis.

**El control de acceso está en `proxy.ts`** (el reemplazo de `middleware.ts` en Next 16). Refresca la cookie de sesión de Supabase y redirige a `/login` las peticiones sin sesión; las rutas públicas son `/login`, `/auth/*` y `/api/keepalive`. Cualquier ruta pública nueva hay que agregarla ahí.

**Base de datos** (`supabase/migrations/0001_init.sql`, se aplica a mano en el SQL Editor de Supabase): `subjects → topics → photos / questions → attempts`. Todas las tablas tienen `user_id default auth.uid()` y una política RLS "own rows", así que los inserts desde el cliente omiten `user_id`. Las fotos están en un bucket privado `photos`, bajo `<user_id>/...`. El estado Leitner (`box`, `next_review`) vive directamente en la fila de `questions`.

**La generación del quiz tiene dos caminos que comparten `lib/prompts.ts`:**
1. API: `/api/generate` envía las fotos sin procesar del tema (`extracted_text is null`) a `claude-opus-5-5` con salida estructurada según el esquema zod `QuizSchema`, inserta las filas con `toQuestionRows` y luego guarda la transcripción en `photos.extracted_text` — así se marca una foto como "usada" para que nunca genere preguntas repetidas.
2. Manual (sin API key): `app/tema/[id]/page.tsx` copia `buildManualPrompt(...)` al portapapeles para pegarlo en Claude.ai, luego parsea el JSON pegado con `parsePastedQuiz` y hace el mismo insert + marcado de fotos desde el cliente.
Cualquier cambio en la forma del quiz o en el prompt debe mantener funcionando ambos caminos.

Las imágenes se reducen a ~1600px JPEG en el navegador (`lib/image.ts`) antes de subirlas.

**Juego** (`app/jugar/page.tsx`): modos por query string — `?tema=<id>` (un tema, de fácil a difícil), `?modo=repaso` (preguntas que tocan hoy) y `?tema=<id>&modo=falladas` (las más falladas de ese tema, `lib/missed.ts`). Al jugar un tema (`?tema=`, también `falladas`) primero va un repaso obligatorio (`components/Lesson.tsx`): tarjetas con la idea clave y una pregunta de comprobación; si no se puede crear, se juega sin él. Máximo 15 preguntas por partida (el prompt pide 18–20 para tener margen). Cada respuesta inserta una fila en `attempts` y actualiza la pregunta con `nextReviewState` de `lib/leitner.ts` (intervalos de 1/3/7/14/30 días, vuelve a la caja 1 al fallar, vence al inicio del día).

**Estilos**: Tailwind v4 con los tokens del tema en `app/globals.css` (tema oscuro fijo, colores de respuesta `k-red/blue/yellow/green/purple`, fuente Nunito). Los componentes de UI compartidos están en `components/ui.tsx`.

**Nota de lint**: `react-hooks/set-state-in-effect` está desactivada a propósito — las páginas cargan datos en efectos y el juego avanza con temporizadores.

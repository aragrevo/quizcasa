# QuizCasa

App tipo Kahoot para estudiar: subes fotos de los apuntes de un tema, Claude genera un quiz,
y el repaso espaciado vuelve a mostrar lo que se falló.

## Puesta en marcha (una sola vez)

1. **Supabase** (gratis): crea un proyecto en https://supabase.com.
   - SQL Editor → pega y ejecuta `supabase/migrations/0001_init.sql`.
   - Authentication → URL Configuration: pon `http://localhost:3000` como Site URL
     (y luego la URL de Vercel) y agrega `<url>/auth/callback` en Redirect URLs.
2. **Claude**: crea una API key en https://platform.claude.com.
3. Copia `.env.example` a `.env.local` y completa las tres variables.
4. `npm install && npm run dev` → abre http://localhost:3000.

## Usarlo desde el celular

Despliega en Vercel (`npx vercel`, con las mismas variables de entorno) y abre la URL en el
celular → "Agregar a pantalla de inicio". Queda como una app con acceso a la cámara.

En Vercel define también `CRON_SECRET`. El cron de `vercel.json` llama a `/api/keepalive` una vez
al día para que Supabase no pause el proyecto gratis cuando la app pasa una semana sin usarse.

## Cómo funciona

- `app/api/generate/route.ts`: envía las fotos nuevas del tema a Claude (`claude-opus-5-5`)
  y guarda las preguntas validadas. Cada foto se usa una sola vez para no repetir preguntas.
- `lib/prompts.ts`: instrucciones y esquema del quiz (opción múltiple y verdadero/falso).
- `lib/leitner.ts`: repaso espaciado. Si acierta, la pregunta vuelve en 1, 3, 7, 14 y 30 días; si falla, vuelve mañana.
- `/jugar?tema=…` juega un tema (de fácil a difícil); `/jugar?modo=repaso` juega lo que toca repasar hoy.
- `/panel`: aciertos por materia, temas flojos y preguntas más falladas.

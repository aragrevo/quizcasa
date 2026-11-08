# Comprensión lectora en QuizCasa

## Contexto
Hoy un tema = apuntes → preguntas sueltas que se responden de memoria en 20 s. En comprensión lectora las preguntas dependen de **un texto concreto** que el alumno debe leer y poder consultar; sin ese texto las preguntas no tienen sentido. Decisiones del usuario:
- El texto puede venir de **fotos** (lectura del libro/ficha) **o generarlo Claude** (práctica ilimitada).
- Juego: **pantalla de lectura sin tiempo → preguntas** con botón "📖 Ver texto" siempre disponible y más tiempo por pregunta.

## Modelo de datos — `supabase/migrations/0002_lectura.sql` (se aplica a mano)
- `topics.kind text not null default 'apuntes' check (kind in ('apuntes','lectura'))`.
- Nueva tabla `passages (id, user_id default auth.uid(), topic_id → topics on delete cascade, title text, body text, created_at)` + índice en `topic_id` + política RLS "own rows" igual que 0001.
- `questions.passage_id uuid null references passages on delete cascade` + índice.
- Un tema de lectura tiene varias lecturas (cada generación crea un `passage`); las preguntas cuelgan del passage. Leitner/attempts no cambian.
- `lib/types.ts`: `Topic.kind`, tipo `Passage`, `Question.passage_id`.

## Generación — `lib/prompts.ts` (ambos caminos, API y manual)
- `ReadingSchema = { title, passage, questions[] }` (mismas preguntas que `QuizSchema`).
- `buildReadingSystemPrompt()`: 8–10 preguntas que **no se puedan responder sin el texto**, repartidas en idea principal, detalle literal, inferencia, vocabulario en contexto, intención del autor / tipo de texto, secuencia/causa-efecto; mc + vf; dificultad 1–3; explicación que cite el texto. Mismo idioma que el material (portugués de Portugal si aplica).
- Dos instrucciones de usuario: *"transcribe fielmente el texto de las fotos en `passage`"* (fotos) o *"escribe un texto original de tipo X sobre Y, ~250–400 palabras, para 12–15 años"* (inventado; tipos: narrativo, expositivo, argumentativo, noticia, poema; tema opcional).
- `buildManualReadingPrompt(subject, topic, opts | null)` + `parsePastedReading(text)` (reutilizar la lógica de extracción de JSON de `parsePastedQuiz` en un helper común).
- `toQuestionRows(quiz, topicId, passageId?)`: añadir `passage_id` opcional.
- Inserción compartida: passage → preguntas con `passage_id` → (si hubo fotos) `photos.extracted_text = passage`.

## API — `app/api/generate/route.ts`
- Leer `topics.kind`. Si `lectura`: body `{ topicId, inventar?: { tipo, tema } }`. Con `inventar` → petición solo texto (sin imágenes); si no → fotos nuevas como hoy. Usar `ReadingSchema` y el prompt de lectura; insertar passage + preguntas. El camino `apuntes` queda igual.

## UI
- `app/materia/[id]/page.tsx`: al crear tema, selector "📝 Apuntes / 📖 Lectura" → guarda `kind`. Icono 📖 en la tarjeta del tema (`components/TopicCard.tsx`).
- `app/tema/[id]/page.tsx`: si `kind === 'lectura'`, renderizar un nuevo componente `components/ReadingPanel.tsx` en lugar de las secciones de apuntes (el archivo ya tiene 347 líneas). El panel:
  1. Fotos del texto (reutiliza la subida existente — se pasa `onFiles`/fotos como props o se extrae el bloque de fotos a un componente compartido).
  2. "O pide a Claude un texto nuevo": selector de tipo + tema opcional.
  3. Crear preguntas: copiar prompt / pegar JSON (manual) y botón API en `<details>`, igual que hoy.
  4. Lista de lecturas: título, nº preguntas, botón **▶ Leer y jugar** (`/jugar?lectura=<id>`), "Ver/ocultar preguntas" con el editor/borrado existente (`QuestionEditor`) y "Borrar lectura".
  - Botón "🔁 Las que más fallas" del tema se mantiene (funciona igual).

## Juego — `app/jugar/page.tsx`
- Nuevo modo `?lectura=<passageId>`: carga el passage y sus preguntas (ordenadas por dificultad, máx. 15). Nueva fase `"reading"` antes de la cuenta atrás: título + texto con scroll y botón "Ya lo leí → Empezar". Volver lleva a `/tema/<topic_id>`.
- En todos los modos, cargar `*, passages(title, body)`: si la pregunta tiene passage, botón "📖 Ver texto" que abre el texto en una capa a pantalla completa (el tiempo sigue corriendo). Así repaso diario y "falladas" funcionan con preguntas de lectura.
- Tiempo por pregunta: `q.passage_id ? 45 : 20`; el cálculo de puntos y el `time_ms` usan ese valor en lugar de la constante `SECONDS`.

## Fuera de alcance
Preguntas abiertas/respuesta escrita, audio/lectura en voz alta, medir velocidad lectora, nivel configurable por alumno.

## Verificación
1. `npm run lint` y `npm run build` (comprobación de tipos).
2. Aplicar `0002_lectura.sql` en Supabase; `npm run dev`.
3. Crear tema "📖 Lectura": (a) subir foto de un texto + camino manual (copiar prompt → Claude.ai → pegar) y (b) "texto inventado" por API → aparecen dos lecturas con sus preguntas.
4. ▶ Leer y jugar: pantalla de lectura → preguntas con 45 s y "📖 Ver texto"; fallar alguna.
5. Comprobar que "Las que más fallas" y el repaso diario muestran "Ver texto" en esas preguntas, y que un tema de apuntes sigue igual (20 s, sin botón).

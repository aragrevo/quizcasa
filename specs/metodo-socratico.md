# Tutor socrático tras fallar (modo manual con Claude.ai)

## Contexto
El alumno mejoró en algunos exámenes pero en otros le fue mal, aunque había estudiado con el quiz. Esos exámenes eran de opción múltiple o de respuesta corta (no está claro del todo). La causa probable es que **memoriza la respuesta, no la entiende**: al fallar ve la respuesta correcta y una explicación de 1–2 frases, y sigue jugando. Nadie le hace razonar por qué se equivocó.

Objetivo: cuando falla, que **razone hasta llegar él mismo a la respuesta** con un tutor socrático. Como no hay API key, se usa el camino manual: la app arma el prompt y él conversa en Claude.ai.

## 1. Prompt socrático — `lib/prompts.ts`
`buildSocraticPrompt({ subject, topic, question, chosen, notes })` devuelve texto para pegar en Claude.ai:
- Rol: tutor de secundaria (12–15 años) que usa el método socrático. **Nunca da la respuesta directamente.**
- Contexto: materia, tema, la pregunta, sus opciones, la que eligió el alumno (o "se le acabó el tiempo"), la correcta y la explicación guardada (solo para el tutor: "no la reveles"), y la transcripción de sus apuntes (`photos.extracted_text` del tema), para que el tutor se base en lo que estudió.
- Guion: (1) preguntarle por qué eligió esa opción; (2) **una pregunta por mensaje**, corta, que le lleve del error a la idea correcta usando sus apuntes; (3) si se atasca 2–3 veces, dar una pista más directa; (4) cuando llegue a la respuesta, pedirle que la explique con sus palabras; (5) cerrar con **una pregunta nueva parecida, con otra redacción**, para comprobar que lo entendió.
- Mismo idioma que el material (portugués de Portugal si aplica). Tono cercano, sin sermones.
- Si llega la feature de lectura, se añade el texto (`passage.body`) al contexto. No hace falta prepararlo ahora.

## 2. Botón "🤔 Entenderlo con Claude" — `app/jugar/page.tsx`
- Dónde aparece: (a) en la tarjeta roja de feedback al fallar; (b) en cada pregunta de "Para repasar" de la pantalla final (es mejor momento, porque no corta la partida).
- Qué hace: copia `buildSocraticPrompt(...)` al portapapeles y abre `https://claude.ai/new` en otra pestaña. Muestra "✓ Copiado: pégalo en Claude", siguiendo el patrón de `copyPrompt` en `app/tema/[id]/page.tsx`.
- Datos: cambiar la consulta de preguntas a `*, topics(title, subjects(name))`. Al cargar, traer de una sola vez las transcripciones de los temas de la partida (`photos.select("topic_id, extracted_text").in("topic_id", ids).not("extracted_text", "is", null)`). Se carga antes para que `navigator.clipboard.writeText` se ejecute directamente en el clic: iOS Safari rechaza el portapapeles si antes hay un `await` de red.
- Guardar en `Result` el texto de la opción elegida (no solo `chosen`), porque el juego baraja las opciones en cada partida.

## 3. (Opcional, barato) En la página del tema
En `app/tema/[id]/page.tsx`, junto al contador "✕ N fallos" de cada pregunta, el mismo botón "🤔". Así el padre o el alumno pueden trabajar a fondo las más falladas fuera del juego. Reutiliza `buildSocraticPrompt`, con las fotos ya cargadas en la página.

## Fuera de alcance
- Chat socrático dentro de la app. Requiere API key: sería una ruta `/api/tutor` con streaming, para más adelante si se configura la clave.
- Registrar si la conversación sirvió.
- Preguntas abiertas evaluadas por Claude.

## Recomendación aparte (no es código)
Revisar los exámenes corregidos en los que le fue mal: ¿las preguntas falladas trataban temas que no estaban en las fotos, o venían redactadas de otra forma? Si era lo primero, el problema es la cobertura de los apuntes, no la forma de estudiar.

## Verificación
1. `npm run lint` y `npm run build`.
2. Fallar una pregunta, pulsar "🤔 Entenderlo con Claude", pegar en Claude.ai y comprobar que el tutor pregunta por qué eligió esa opción, no revela la respuesta y cierra con una pregunta parecida.
3. Probar el botón en el celular (PWA, iOS/Android): que copie bien y abra Claude.

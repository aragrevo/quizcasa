-- QuizCasa: variantes de las preguntas más falladas. Pegar en Supabase > SQL Editor y ejecutar.

-- Una variante es otra redacción del mismo concepto. variant_of apunta siempre a la
-- pregunta raíz (la original), nunca a otra variante.
-- Una pregunta "retired" fue reemplazada por una variante: sale del juego, del repaso
-- y de los conteos, pero se conserva con su historial de intentos.
alter table questions
  add column variant_of uuid references questions on delete cascade,
  add column retired boolean not null default false;

create index on questions (variant_of);

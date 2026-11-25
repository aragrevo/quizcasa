-- Repaso del tema que se muestra antes de cada partida (lo genera Gemini en /api/lesson).
-- Se vuelve a null cuando entran apuntes nuevos, para que se regenere.
alter table topics add column if not exists lesson jsonb;

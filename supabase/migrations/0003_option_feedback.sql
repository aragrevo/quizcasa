-- QuizCasa: explicación de por qué cada opción incorrecta está mal. Pegar en Supabase > SQL Editor y ejecutar.

-- Una frase por opción, en el mismo orden que options ("" en la correcta).
-- Vacío en las preguntas creadas antes de esta migración.
alter table questions add column option_feedback text[] not null default '{}';

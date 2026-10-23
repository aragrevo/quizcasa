-- QuizCasa: esquema inicial. Pegar en Supabase > SQL Editor y ejecutar.

create table subjects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  name text not null,
  emoji text not null default '📚',
  color text not null default '#6366f1',
  created_at timestamptz not null default now()
);

create table topics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  subject_id uuid not null references subjects on delete cascade,
  title text not null,
  exam_date date,
  created_at timestamptz not null default now()
);

create table photos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  topic_id uuid not null references topics on delete cascade,
  storage_path text not null,
  extracted_text text,
  created_at timestamptz not null default now()
);

-- El estado de repaso espaciado (caja Leitner) vive en la misma pregunta.
create table questions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  topic_id uuid not null references topics on delete cascade,
  kind text not null check (kind in ('mc', 'vf')),
  prompt text not null,
  options text[] not null,
  correct_index int not null,
  explanation text not null default '',
  difficulty int not null default 1 check (difficulty between 1 and 3),
  box int not null default 0,
  next_review timestamptz,
  created_at timestamptz not null default now()
);

create table attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  question_id uuid not null references questions on delete cascade,
  correct boolean not null,
  time_ms int not null,
  created_at timestamptz not null default now()
);

create index on topics (subject_id);
create index on photos (topic_id);
create index on questions (topic_id);
create index on questions (user_id, next_review);
create index on attempts (user_id, created_at);

-- Cada familia (usuario) solo ve sus propios datos.
do $$
declare t text;
begin
  foreach t in array array['subjects', 'topics', 'photos', 'questions', 'attempts'] loop
    execute format('alter table %I enable row level security', t);
    execute format(
      'create policy "own rows" on %I for all using (user_id = auth.uid()) with check (user_id = auth.uid())', t);
  end loop;
end $$;

-- Bucket privado para las fotos; cada usuario escribe en la carpeta <user_id>/...
insert into storage.buckets (id, name, public) values ('photos', 'photos', false);

create policy "own photos" on storage.objects for all
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);

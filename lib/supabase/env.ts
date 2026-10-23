export const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;

// Los proyectos nuevos de Supabase usan la "publishable key" (sb_publishable_...);
// los antiguos, la "anon key" (eyJ...). Cualquiera de las dos sirve.
export const supabaseKey = (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)!;

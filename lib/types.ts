export type Subject = {
  id: string;
  name: string;
  emoji: string;
  color: string;
};

export type Topic = {
  id: string;
  subject_id: string;
  title: string;
  exam_date: string | null;
};

export type Photo = {
  id: string;
  topic_id: string;
  storage_path: string;
  extracted_text: string | null;
};

export type Question = {
  id: string;
  topic_id: string;
  kind: "mc" | "vf";
  prompt: string;
  options: string[];
  correct_index: number;
  explanation: string;
  difficulty: number;
  box: number;
  next_review: string | null;
  // Una frase por opción con el error que lleva a elegirla ("" en la correcta); vacío en preguntas viejas.
  option_feedback: string[];
  // Pregunta raíz de la que es variante; null si es original.
  variant_of: string | null;
  // Reemplazada por una variante: fuera del juego, del repaso y de los conteos.
  retired: boolean;
};

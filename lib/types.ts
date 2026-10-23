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
};

export type FormItemType =
  | "short_text"
  | "paragraph"
  | "multiple_choice"
  | "checkboxes"
  | "dropdown"
  | "linear_scale"
  | "date"
  | "time"
  | "title"
  | "image"
  | "video"
  | "section";

export type FormItem = {
  id: string;
  type: FormItemType;
  label: string;
  helpText?: string;
  required?: boolean;
  options?: string[];
  min?: number;
  max?: number;
  minLabel?: string;
  maxLabel?: string;
  url?: string;
};

export const QUESTION_TYPES: FormItemType[] = [
  "short_text",
  "paragraph",
  "multiple_choice",
  "checkboxes",
  "dropdown",
  "linear_scale",
  "date",
  "time",
];

export const LAYOUT_TYPES: FormItemType[] = ["title", "image", "video", "section"];

export const TYPE_LABELS: Record<FormItemType, string> = {
  short_text: "Resposta curta",
  paragraph: "Parágrafo",
  multiple_choice: "Múltipla escolha",
  checkboxes: "Caixas de seleção",
  dropdown: "Lista suspensa",
  linear_scale: "Escala linear",
  date: "Data",
  time: "Horário",
  title: "Título e descrição",
  image: "Imagem",
  video: "Vídeo",
  section: "Seção",
};

export const isQuestion = (t: FormItemType) => QUESTION_TYPES.includes(t);

export const newItem = (type: FormItemType): FormItem => ({
  id: crypto.randomUUID(),
  type,
  label:
    type === "section"
      ? "Nova seção"
      : type === "title"
        ? "Título"
        : isQuestion(type)
          ? "Pergunta sem título"
          : "",
  helpText: "",
  required: false,
  options: ["multiple_choice", "checkboxes", "dropdown"].includes(type)
    ? ["Opção 1"]
    : undefined,
  min: type === "linear_scale" ? 1 : undefined,
  max: type === "linear_scale" ? 5 : undefined,
  minLabel: "",
  maxLabel: "",
  url: "",
});

export const parseSchema = (raw: unknown): FormItem[] =>
  Array.isArray(raw) ? (raw as FormItem[]).filter((i) => i && typeof i === "object" && i.type) : [];

/** Converts a YouTube/Vimeo URL to an embeddable URL. Returns null when unsupported. */
export function embedUrl(url?: string): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    if (u.hostname.includes("youtube.com")) {
      const v = u.searchParams.get("v");
      if (v) return `https://www.youtube.com/embed/${v}`;
      if (u.pathname.startsWith("/embed/")) return url;
    }
    if (u.hostname === "youtu.be") return `https://www.youtube.com/embed${u.pathname}`;
    if (u.hostname.includes("vimeo.com")) return `https://player.vimeo.com/video${u.pathname}`;
    return url;
  } catch {
    return null;
  }
}

export type FormAnswers = Record<string, string | string[]>;

export function validateAnswers(items: FormItem[], answers: FormAnswers): string | null {
  for (const it of items) {
    if (!isQuestion(it.type) || !it.required) continue;
    const v = answers[it.id];
    const empty = Array.isArray(v) ? v.length === 0 : !v;
    if (empty) return `Responda: ${it.label}`;
  }
  return null;
}

export function answerToText(v: string | string[] | undefined): string {
  if (Array.isArray(v)) return v.join(", ");
  return v ?? "";
}

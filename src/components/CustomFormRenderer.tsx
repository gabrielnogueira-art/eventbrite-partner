import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { embedUrl, isQuestion, type FormAnswers, type FormItem } from "@/lib/form-schema";

export function CustomFormRenderer({
  items,
  answers,
  onChange,
  disabled,
}: {
  items: FormItem[];
  answers: FormAnswers;
  onChange: (next: FormAnswers) => void;
  disabled?: boolean;
}) {
  if (items.length === 0) return null;
  const set = (id: string, v: string | string[]) => onChange({ ...answers, [id]: v });

  return (
    <div className="space-y-5">
      {items.map((it) => {
        if (it.type === "section")
          return (
            <div key={it.id} className="border-t pt-4">
              <div className="text-base font-semibold">{it.label}</div>
              {it.helpText && (
                <p className="text-sm text-muted-foreground">{it.helpText}</p>
              )}
            </div>
          );
        if (it.type === "title")
          return (
            <div key={it.id}>
              <div className="text-base font-semibold">{it.label}</div>
              {it.helpText && (
                <p className="whitespace-pre-line text-sm text-muted-foreground">{it.helpText}</p>
              )}
            </div>
          );
        if (it.type === "image")
          return it.url ? (
            <figure key={it.id}>
              <img src={it.url} alt={it.label || "Imagem do formulário"} className="max-h-72 rounded-md border" />
              {it.label && (
                <figcaption className="mt-1 text-xs text-muted-foreground">{it.label}</figcaption>
              )}
            </figure>
          ) : null;
        if (it.type === "video") {
          const src = embedUrl(it.url);
          return src ? (
            <div key={it.id}>
              <iframe
                src={src}
                title={it.label || "Vídeo"}
                className="aspect-video w-full rounded-md border"
                allowFullScreen
              />
              {it.label && <div className="mt-1 text-xs text-muted-foreground">{it.label}</div>}
            </div>
          ) : null;
        }
        if (!isQuestion(it.type)) return null;

        const value = answers[it.id];
        return (
          <div key={it.id} className="space-y-2">
            <Label>
              {it.label} {it.required && <span className="text-destructive">*</span>}
            </Label>
            {it.helpText && <p className="text-xs text-muted-foreground">{it.helpText}</p>}

            {it.type === "short_text" && (
              <Input
                value={(value as string) ?? ""}
                onChange={(e) => set(it.id, e.target.value)}
                disabled={disabled}
              />
            )}
            {it.type === "paragraph" && (
              <Textarea
                rows={3}
                value={(value as string) ?? ""}
                onChange={(e) => set(it.id, e.target.value)}
                disabled={disabled}
              />
            )}
            {it.type === "date" && (
              <Input
                type="date"
                value={(value as string) ?? ""}
                onChange={(e) => set(it.id, e.target.value)}
                disabled={disabled}
              />
            )}
            {it.type === "time" && (
              <Input
                type="time"
                value={(value as string) ?? ""}
                onChange={(e) => set(it.id, e.target.value)}
                disabled={disabled}
              />
            )}
            {it.type === "multiple_choice" && (
              <RadioGroup
                value={(value as string) ?? ""}
                onValueChange={(v) => set(it.id, v)}
                className="space-y-1"
              >
                {(it.options ?? []).map((op) => (
                  <label key={op} className="flex cursor-pointer items-center gap-2 text-sm">
                    <RadioGroupItem value={op} disabled={disabled} /> {op}
                  </label>
                ))}
              </RadioGroup>
            )}
            {it.type === "checkboxes" && (
              <div className="space-y-1">
                {(it.options ?? []).map((op) => {
                  const arr = Array.isArray(value) ? value : [];
                  return (
                    <label key={op} className="flex cursor-pointer items-center gap-2 text-sm">
                      <Checkbox
                        checked={arr.includes(op)}
                        disabled={disabled}
                        onCheckedChange={(c) =>
                          set(it.id, c === true ? [...arr, op] : arr.filter((x) => x !== op))
                        }
                      />
                      {op}
                    </label>
                  );
                })}
              </div>
            )}
            {it.type === "dropdown" && (
              <Select value={(value as string) ?? ""} onValueChange={(v) => set(it.id, v)}>
                <SelectTrigger disabled={disabled}>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {(it.options ?? []).map((op) => (
                    <SelectItem key={op} value={op}>
                      {op}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {it.type === "linear_scale" && (
              <div className="flex flex-wrap items-center gap-3">
                {it.minLabel && <span className="text-xs text-muted-foreground">{it.minLabel}</span>}
                {Array.from(
                  { length: Math.max(2, (it.max ?? 5) - (it.min ?? 1) + 1) },
                  (_, i) => (it.min ?? 1) + i,
                ).map((n) => (
                  <label key={n} className="flex cursor-pointer flex-col items-center gap-1 text-xs">
                    <span>{n}</span>
                    <input
                      type="radio"
                      name={`scale-${it.id}`}
                      checked={value === String(n)}
                      disabled={disabled}
                      onChange={() => set(it.id, String(n))}
                    />
                  </label>
                ))}
                {it.maxLabel && <span className="text-xs text-muted-foreground">{it.maxLabel}</span>}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

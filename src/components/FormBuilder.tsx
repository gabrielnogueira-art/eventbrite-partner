import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowDown,
  ArrowUp,
  Copy,
  Image as ImageIcon,
  Plus,
  Trash2,
  Type,
  Video,
  Rows3,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  LAYOUT_TYPES,
  QUESTION_TYPES,
  TYPE_LABELS,
  embedUrl,
  isQuestion,
  newItem,
  type FormItem,
  type FormItemType,
} from "@/lib/form-schema";

export function FormBuilder({
  items,
  onChange,
}: {
  items: FormItem[];
  onChange: (next: FormItem[]) => void;
}) {
  const [uploading, setUploading] = useState<string | null>(null);

  const add = (type: FormItemType) => onChange([...items, newItem(type)]);
  const patch = (id: string, p: Partial<FormItem>) =>
    onChange(items.map((i) => (i.id === id ? { ...i, ...p } : i)));
  const remove = (id: string) => onChange(items.filter((i) => i.id !== id));
  const duplicate = (id: string) => {
    const idx = items.findIndex((i) => i.id === id);
    if (idx < 0) return;
    const copy = { ...items[idx], id: crypto.randomUUID() };
    onChange([...items.slice(0, idx + 1), copy, ...items.slice(idx + 1)]);
  };
  const move = (id: string, dir: -1 | 1) => {
    const idx = items.findIndex((i) => i.id === id);
    const target = idx + dir;
    if (idx < 0 || target < 0 || target >= items.length) return;
    const next = [...items];
    [next[idx], next[target]] = [next[target], next[idx]];
    onChange(next);
  };

  const uploadImage = async (id: string, file: File) => {
    setUploading(id);
    try {
      const ext = file.name.split(".").pop();
      const path = `form/${crypto.randomUUID()}.${ext}`;
      const up = await supabase.storage.from("event-covers").upload(path, file);
      if (up.error) throw up.error;
      const { data } = await supabase.storage
        .from("event-covers")
        .createSignedUrl(path, 60 * 60 * 24 * 365);
      patch(id, { url: data?.signedUrl ?? "" });
    } catch (e: any) {
      toast.error(e?.message ?? "Falha no upload");
    } finally {
      setUploading(null);
    }
  };

  return (
    <div className="space-y-3">
      {items.length === 0 && (
        <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
          Nenhum item ainda. Adicione perguntas, títulos, imagens, vídeos ou seções abaixo.
        </div>
      )}

      {items.map((it, idx) => (
        <div
          key={it.id}
          className={`rounded-lg border p-4 ${it.type === "section" ? "border-primary/50 bg-primary/5" : ""}`}
        >
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              #{idx + 1} · {TYPE_LABELS[it.type]}
            </div>
            <div className="flex items-center gap-1">
              <Button size="icon" variant="ghost" onClick={() => move(it.id, -1)} type="button">
                <ArrowUp className="h-4 w-4" />
              </Button>
              <Button size="icon" variant="ghost" onClick={() => move(it.id, 1)} type="button">
                <ArrowDown className="h-4 w-4" />
              </Button>
              <Button size="icon" variant="ghost" onClick={() => duplicate(it.id)} type="button">
                <Copy className="h-4 w-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="text-destructive"
                onClick={() => remove(it.id)}
                type="button"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="grid gap-3">
            <div className="grid gap-3 sm:grid-cols-[1fr_220px]">
              <div className="space-y-1">
                <Label className="text-xs">
                  {it.type === "image" || it.type === "video" ? "Legenda" : "Título"}
                </Label>
                <Input value={it.label} onChange={(e) => patch(it.id, { label: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Tipo</Label>
                <Select
                  value={it.type}
                  onValueChange={(v) => {
                    const base = newItem(v as FormItemType);
                    patch(it.id, {
                      type: v as FormItemType,
                      options: base.options ?? it.options,
                      min: base.min,
                      max: base.max,
                    });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[...QUESTION_TYPES, ...LAYOUT_TYPES].map((t) => (
                      <SelectItem key={t} value={t}>
                        {TYPE_LABELS[t]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Descrição (opcional)</Label>
              <Textarea
                rows={2}
                value={it.helpText ?? ""}
                onChange={(e) => patch(it.id, { helpText: e.target.value })}
              />
            </div>

            {["multiple_choice", "checkboxes", "dropdown"].includes(it.type) && (
              <div className="space-y-2">
                <Label className="text-xs">Opções</Label>
                {(it.options ?? []).map((op, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Input
                      value={op}
                      onChange={(e) => {
                        const opts = [...(it.options ?? [])];
                        opts[i] = e.target.value;
                        patch(it.id, { options: opts });
                      }}
                    />
                    <Button
                      size="icon"
                      variant="ghost"
                      type="button"
                      onClick={() =>
                        patch(it.id, { options: (it.options ?? []).filter((_, j) => j !== i) })
                      }
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <Button
                  size="sm"
                  variant="outline"
                  type="button"
                  onClick={() =>
                    patch(it.id, {
                      options: [...(it.options ?? []), `Opção ${(it.options?.length ?? 0) + 1}`],
                    })
                  }
                >
                  <Plus className="mr-2 h-4 w-4" /> Adicionar opção
                </Button>
              </div>
            )}

            {it.type === "linear_scale" && (
              <div className="grid gap-3 sm:grid-cols-4">
                <div className="space-y-1">
                  <Label className="text-xs">De</Label>
                  <Input
                    type="number"
                    value={it.min ?? 1}
                    onChange={(e) => patch(it.id, { min: Number(e.target.value) })}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Até</Label>
                  <Input
                    type="number"
                    value={it.max ?? 5}
                    onChange={(e) => patch(it.id, { max: Number(e.target.value) })}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Rótulo mínimo</Label>
                  <Input
                    value={it.minLabel ?? ""}
                    onChange={(e) => patch(it.id, { minLabel: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Rótulo máximo</Label>
                  <Input
                    value={it.maxLabel ?? ""}
                    onChange={(e) => patch(it.id, { maxLabel: e.target.value })}
                  />
                </div>
              </div>
            )}

            {(it.type === "image" || it.type === "video") && (
              <div className="space-y-2">
                <Label className="text-xs">
                  {it.type === "image" ? "URL da imagem" : "URL do vídeo (YouTube/Vimeo)"}
                </Label>
                <Input
                  value={it.url ?? ""}
                  placeholder={
                    it.type === "image"
                      ? "https://..."
                      : "https://www.youtube.com/watch?v=..."
                  }
                  onChange={(e) => patch(it.id, { url: e.target.value })}
                />
                {it.type === "image" && (
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-dashed px-3 py-2 text-sm hover:bg-accent">
                    <ImageIcon className="h-4 w-4" />
                    {uploading === it.id ? "Enviando..." : "Enviar imagem"}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) uploadImage(it.id, f);
                        e.currentTarget.value = "";
                      }}
                    />
                  </label>
                )}
                {it.type === "image" && it.url && (
                  <img src={it.url} alt={it.label} className="max-h-48 rounded-md border" />
                )}
                {it.type === "video" && embedUrl(it.url) && (
                  <iframe
                    src={embedUrl(it.url) as string}
                    title={it.label || "Vídeo"}
                    className="aspect-video w-full max-w-md rounded-md border"
                    allowFullScreen
                  />
                )}
              </div>
            )}

            {isQuestion(it.type) && (
              <label className="flex w-fit cursor-pointer items-center gap-2 text-sm">
                <Checkbox
                  checked={!!it.required}
                  onCheckedChange={(c) => patch(it.id, { required: c === true })}
                />
                Obrigatória
              </label>
            )}
          </div>
        </div>
      ))}

      <div className="flex flex-wrap gap-2 rounded-lg border border-dashed p-3">
        <Select onValueChange={(v) => add(v as FormItemType)}>
          <SelectTrigger className="w-[220px]">
            <SelectValue placeholder="Adicionar pergunta" />
          </SelectTrigger>
          <SelectContent>
            {QUESTION_TYPES.map((t) => (
              <SelectItem key={t} value={t}>
                {TYPE_LABELS[t]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button type="button" variant="outline" onClick={() => add("title")}>
          <Type className="mr-2 h-4 w-4" /> Título e descrição
        </Button>
        <Button type="button" variant="outline" onClick={() => add("image")}>
          <ImageIcon className="mr-2 h-4 w-4" /> Imagem
        </Button>
        <Button type="button" variant="outline" onClick={() => add("video")}>
          <Video className="mr-2 h-4 w-4" /> Vídeo
        </Button>
        <Button type="button" variant="outline" onClick={() => add("section")}>
          <Rows3 className="mr-2 h-4 w-4" /> Seção
        </Button>
      </div>
    </div>
  );
}

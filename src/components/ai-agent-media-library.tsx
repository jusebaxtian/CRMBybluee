"use client";

import { useActionState, useState } from "react";
import { Image as ImageIcon, Video, FileText, Trash2, Library } from "lucide-react";
import { addAiAgentMedia, deleteAiAgentMedia } from "@/app/actions/ai-agent";
import { Button } from "@/components/ui/button";

type MediaItem = {
  id: string;
  key: string;
  label: string;
  trigger_description: string;
  media_type: "image" | "video" | "document";
  media_url: string;
};

const typeIcon = { image: ImageIcon, video: Video, document: FileText };

function DeleteButton({ id }: { id: string }) {
  const [pending, setPending] = useState(false);
  return (
    <button
      type="button"
      disabled={pending}
      onClick={async () => {
        setPending(true);
        await deleteAiAgentMedia(id);
        setPending(false);
      }}
      className="text-muted hover:text-red-400 disabled:opacity-50"
      title="Eliminar"
    >
      <Trash2 size={14} />
    </button>
  );
}

export function AiAgentMediaLibrary({ items }: { items: MediaItem[] }) {
  const [state, action, pending] = useActionState(addAiAgentMedia, undefined);

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-border p-5">
      <div className="flex items-center gap-2">
        <Library size={16} className="text-primary" />
        <h3 className="text-sm font-semibold text-foreground">Biblioteca de medios</h3>
      </div>
      <p className="text-xs text-muted">
        Súbele al agente imágenes, videos o documentos (QR de pago, video demostrativo, catálogo...)
        y explícale en qué momento usar cada uno. Él decide solo cuándo enviarlo según lo que
        pregunte el cliente.
      </p>

      {items.length > 0 && (
        <ul className="flex flex-col gap-2">
          {items.map((item) => {
            const Icon = typeIcon[item.media_type];
            return (
              <li
                key={item.id}
                className="flex items-center gap-3 rounded-lg border border-border bg-background px-3 py-2"
              >
                <Icon size={16} className="shrink-0 text-muted" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">
                    {item.label} <span className="text-muted">({item.key})</span>
                  </p>
                  <p className="truncate text-xs text-muted">
                    Se envía cuando {item.trigger_description}
                  </p>
                </div>
                <DeleteButton id={item.id} />
              </li>
            );
          })}
        </ul>
      )}

      <form action={action} className="flex flex-col gap-3 border-t border-border pt-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">
              Clave (sin espacios)
            </label>
            <input
              name="key"
              type="text"
              required
              placeholder="qr_pago"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">Nombre</label>
            <input
              name="label"
              type="text"
              required
              placeholder="QR de pago"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
            />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-muted">
            ¿Cuándo debe enviarlo?
          </label>
          <input
            name="triggerDescription"
            type="text"
            required
            placeholder="pregunten cómo pagar o pidan el QR"
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-muted">Archivo</label>
          <input
            name="file"
            type="file"
            required
            accept="image/jpeg,image/png,video/mp4,video/quicktime,application/pdf"
            className="w-full text-sm text-foreground file:mr-3 file:rounded-md file:border-0 file:bg-surface-hover file:px-3 file:py-1.5 file:text-xs file:text-foreground"
          />
        </div>

        {state && "error" in state && <p className="text-sm text-red-400">{state.error}</p>}

        <Button type="submit" disabled={pending} className="self-start">
          {pending ? "Subiendo..." : "Agregar medio"}
        </Button>
      </form>
    </div>
  );
}

"use client";

import { Trash2, X } from "lucide-react";
import {
  BLOQUES,
  DISPARADORES,
  MAX_BOTONES,
  type DatosBloque,
  type Disparador,
  type TipoBloque,
  type TipoDisparador,
} from "@/lib/flujos/bloques";

/**
 * Panel lateral para editar el bloque seleccionado.
 *
 * Va al lado del lienzo y no en una ventana emergente a proposito: al cambiar
 * un texto se quiere ver como queda el bloque y a donde van sus lineas.
 */
export function PanelBloque({
  tipo,
  datos,
  etiquetas = [],
  onCambiar,
  onBorrar,
  onCerrar,
}: {
  tipo: TipoBloque;
  datos: DatosBloque;
  etiquetas?: { id: string; name: string }[];
  onCambiar: (datos: DatosBloque) => void;
  onBorrar: () => void;
  onCerrar: () => void;
}) {
  const def = BLOQUES[tipo];
  const botones = datos.botones ?? [];
  const disparadores = datos.disparadores ?? [];

  const cambiarDisparador = (i: number, cambios: Partial<Disparador>) => {
    const copia = [...disparadores];
    copia[i] = { ...copia[i], ...cambios };
    onCambiar({ ...datos, disparadores: copia });
  };

  return (
    <aside className="flex w-[300px] shrink-0 flex-col gap-4 border-l border-border bg-surface p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-foreground">{def.nombre}</p>
          <p className="mt-0.5 text-[11.5px] leading-relaxed text-muted">{def.descripcion}</p>
        </div>
        <button type="button" onClick={onCerrar} className="text-muted hover:text-foreground" title="Cerrar">
          <X size={15} />
        </button>
      </div>

      {tipo === "inicio" && (
        <div>
          <label className="mb-1 block text-xs font-medium text-muted">¿Cuándo entra un contacto?</label>

          {disparadores.length === 0 && (
            <p className="mb-2 rounded-[9px] border border-warning/40 bg-warning/10 px-3 py-2 text-[11.5px] leading-relaxed text-foreground">
              Sin disparador el flujo no arranca nunca. Agrega al menos uno.
            </p>
          )}

          <div className="flex flex-col gap-3">
            {disparadores.map((d, i) => {
              const def = DISPARADORES.find((o) => o.tipo === d.tipo);
              return (
                <div key={i} className="rounded-[9px] border border-border bg-background p-2.5">
                  <div className="flex items-start gap-1.5">
                    <select
                      value={d.tipo}
                      onChange={(e) => cambiarDisparador(i, { tipo: e.target.value as TipoDisparador })}
                      className="min-w-0 flex-1 rounded-[8px] border border-border bg-surface px-2 py-1.5 text-[12.5px] text-foreground outline-none focus:border-primary"
                    >
                      {DISPARADORES.map((o) => (
                        <option key={o.tipo} value={o.tipo}>
                          {o.nombre}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => onCambiar({ ...datos, disparadores: disparadores.filter((_, j) => j !== i) })}
                      className="shrink-0 pt-1.5 text-muted hover:text-red-400"
                      title="Quitar"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>

                  {def?.pideValor && (
                    <input
                      value={d.valor ?? ""}
                      onChange={(e) => cambiarDisparador(i, { valor: e.target.value })}
                      placeholder="precio, cotización, info…"
                      className="mt-2 w-full rounded-[8px] border border-border bg-surface px-2 py-1.5 text-[12.5px] text-foreground outline-none focus:border-primary"
                    />
                  )}

                  {d.tipo === "tag" && (
                    <select
                      value={d.tagId ?? ""}
                      onChange={(e) => cambiarDisparador(i, { tagId: e.target.value })}
                      className="mt-2 w-full rounded-[8px] border border-border bg-surface px-2 py-1.5 text-[12.5px] text-foreground outline-none focus:border-primary"
                    >
                      <option value="">Elige la etiqueta…</option>
                      {etiquetas.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                  )}

                  <p className="mt-1.5 text-[10.5px] leading-relaxed text-muted">{def?.ayuda}</p>
                </div>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() =>
              onCambiar({ ...datos, disparadores: [...disparadores, { tipo: "keyword", valor: "" }] })
            }
            className="mt-2 text-xs font-medium text-primary hover:underline"
          >
            + Agregar disparador
          </button>

          <p className="mt-2 text-[11px] leading-relaxed text-muted">
            Si pones varios, entra cuando se cumpla cualquiera de ellos. Un contacto que ya está dentro no vuelve
            a entrar hasta que termine.
          </p>
        </div>
      )}

      {(tipo === "mensaje" || tipo === "botones") && (
        <div>
          <label className="mb-1 block text-xs font-medium text-muted">
            {tipo === "botones" ? "Pregunta" : "Mensaje"}
          </label>
          <textarea
            rows={5}
            value={datos.texto ?? ""}
            onChange={(e) => onCambiar({ ...datos, texto: e.target.value })}
            placeholder={tipo === "botones" ? "¿En qué te podemos ayudar?" : "Escribe el mensaje…"}
            className="w-full rounded-[9px] border border-border bg-background px-3 py-2 text-[13px] text-foreground outline-none focus:border-primary"
          />
        </div>
      )}

      {tipo === "botones" && (
        <div>
          <label className="mb-1 block text-xs font-medium text-muted">
            Botones ({botones.length} de {MAX_BOTONES})
          </label>
          <div className="flex flex-col gap-2">
            {botones.map((b, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <input
                  value={b}
                  maxLength={20}
                  onChange={(e) => {
                    const copia = [...botones];
                    copia[i] = e.target.value;
                    onCambiar({ ...datos, botones: copia });
                  }}
                  placeholder={`Botón ${i + 1}`}
                  className="min-w-0 flex-1 rounded-[9px] border border-border bg-background px-2 py-1.5 text-[13px] text-foreground outline-none focus:border-primary"
                />
                <button
                  type="button"
                  onClick={() => onCambiar({ ...datos, botones: botones.filter((_, j) => j !== i) })}
                  className="shrink-0 text-muted hover:text-red-400"
                  title="Quitar botón"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
          {botones.length < MAX_BOTONES && (
            <button
              type="button"
              onClick={() => onCambiar({ ...datos, botones: [...botones, ""] })}
              className="mt-2 text-xs font-medium text-primary hover:underline"
            >
              + Agregar botón
            </button>
          )}
          <p className="mt-2 text-[11px] leading-relaxed text-muted">
            Máximo {MAX_BOTONES} botones y 20 caracteres cada uno: es límite de WhatsApp. Los botones solo se
            pueden enviar dentro de las 24 horas siguientes al último mensaje del contacto.
          </p>
        </div>
      )}

      {tipo === "esperar" && (
        <div>
          <label className="mb-1 block text-xs font-medium text-muted">Esperar respuesta durante</label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={1}
              max={10080}
              value={datos.minutos ?? 5}
              onChange={(e) => onCambiar({ ...datos, minutos: Number(e.target.value) })}
              className="w-24 rounded-[9px] border border-border bg-background px-2 py-1.5 text-[13px] text-foreground outline-none focus:border-primary"
            />
            <span className="text-[13px] text-muted">minutos</span>
          </div>
          <p className="mt-2 text-[11px] leading-relaxed text-muted">
            Si el contacto responde antes, sigue por &ldquo;Respondió&rdquo;. Si se cumple el tiempo, sigue por
            &ldquo;No respondió&rdquo;.
          </p>
        </div>
      )}

      {tipo === "ia" && (
        <>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">Nombre del agente (opcional)</label>
            <input
              value={datos.nombreAgente ?? ""}
              onChange={(e) => onCambiar({ ...datos, nombreAgente: e.target.value })}
              placeholder="Como se presenta ante el cliente"
              className="w-full rounded-[9px] border border-border bg-background px-2 py-1.5 text-[13px] text-foreground outline-none focus:border-primary"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">Objetivo en este flujo (opcional)</label>
            <textarea
              rows={5}
              value={datos.objetivo ?? ""}
              onChange={(e) => onCambiar({ ...datos, objetivo: e.target.value })}
              placeholder="Qué debe lograr al tomar la conversación…"
              className="w-full rounded-[9px] border border-border bg-background px-3 py-2 text-[13px] text-foreground outline-none focus:border-primary"
            />
            <p className="mt-2 text-[11px] leading-relaxed text-muted">
              Si lo dejas vacío responde el agente de la línea, con su configuración de siempre. La IA recibe el
              historial del chat, así que llega sabiendo qué botones tocó el contacto.
            </p>
          </div>
        </>
      )}

      {tipo === "fin" && (
        <p className="rounded-[9px] border border-border bg-background px-3 py-2 text-[11.5px] leading-relaxed text-muted">
          El contacto sale del flujo y vuelve a lo de siempre: palabras clave, seguimientos y agente de IA.
        </p>
      )}

      {tipo !== "inicio" && (
        <button
          type="button"
          onClick={onBorrar}
          className="mt-auto flex items-center justify-center gap-1.5 rounded-[9px] border border-red-400/40 px-3 py-2 text-[13px] font-medium text-red-400 hover:bg-red-400/10"
        >
          <Trash2 size={13} />
          Eliminar bloque
        </button>
      )}
    </aside>
  );
}

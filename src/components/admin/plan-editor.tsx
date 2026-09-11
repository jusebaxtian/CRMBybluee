"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updatePlan } from "@/app/actions/plans";

type Module = { key: string; name: string };

// Campo vacio = "sin limite" (se guarda null), igual que lo leen agents.ts y
// el flujo de conexion de WhatsApp.
function toValue(n: number | null): string {
  return n === null ? "" : String(n);
}
function toLimit(v: string): number | null {
  if (v.trim() === "") return null;
  const n = Math.max(0, Math.floor(Number(v)));
  return Number.isFinite(n) ? n : null;
}

export function PlanEditor({
  planId,
  initialName,
  initialPriceCents,
  initialComparePriceCents,
  initialBadgeLabel,
  initialIsActive,
  initialDescription,
  initialMaxAgents,
  initialMaxWhatsappNumbers,
  modules,
  initialModuleKeys,
}: {
  planId: string;
  initialName: string;
  initialPriceCents: number;
  initialComparePriceCents: number | null;
  initialBadgeLabel: string | null;
  initialIsActive: boolean;
  initialDescription: string[];
  initialMaxAgents: number | null;
  initialMaxWhatsappNumbers: number | null;
  modules: Module[];
  initialModuleKeys: string[];
}) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [price, setPrice] = useState(String(initialPriceCents / 100));
  const [comparePrice, setComparePrice] = useState(
    initialComparePriceCents === null ? "" : String(initialComparePriceCents / 100)
  );
  const [badge, setBadge] = useState(initialBadgeLabel ?? "");
  const [isActive, setIsActive] = useState(initialIsActive);
  const [description, setDescription] = useState(initialDescription.join("\n"));
  const [maxAgents, setMaxAgents] = useState(toValue(initialMaxAgents));
  const [maxNumbers, setMaxNumbers] = useState(toValue(initialMaxWhatsappNumbers));
  const [moduleKeys, setModuleKeys] = useState<Set<string>>(new Set(initialModuleKeys));

  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);

  function toggleModule(key: string, checked: boolean) {
    setModuleKeys((prev) => {
      const next = new Set(prev);
      if (checked) next.add(key);
      else next.delete(key);
      return next;
    });
  }

  async function handleSave() {
    setPending(true);
    setMessage(null);

    const result = await updatePlan(planId, {
      name,
      priceCop: Number(price),
      comparePriceCop: comparePrice.trim() === "" ? null : Number(comparePrice),
      badgeLabel: badge,
      isActive,
      description: description.split("\n"),
      maxAgents: toLimit(maxAgents),
      maxWhatsappNumbers: toLimit(maxNumbers),
      moduleKeys: [...moduleKeys],
    });

    setPending(false);

    if (result?.error) {
      setMessage({ text: result.error, error: true });
      return;
    }

    setMessage({ text: "Cambios guardados.", error: false });
    router.refresh();
  }

  const trimmedBadge = badge.trim();

  // Vista previa del bloque de precio tal como lo vera el cliente.
  const priceNum = Number(price);
  const compareNum = comparePrice.trim() === "" ? null : Number(comparePrice);

  const comparePriceError =
    compareNum !== null && Number.isFinite(compareNum) && Number.isFinite(priceNum) && compareNum <= priceNum
      ? "El precio de comparación debe ser mayor al precio actual."
      : null;

  const showsSavings =
    compareNum !== null &&
    !comparePriceError &&
    Number.isFinite(compareNum) &&
    Number.isFinite(priceNum) &&
    compareNum > priceNum;

  const fmt = (n: number) => n.toLocaleString("es-CO");
  const savings = showsSavings ? fmt(compareNum! - priceNum) : null;
  const comparePreview = showsSavings ? fmt(compareNum!) : "";
  const pricePreview = Number.isFinite(priceNum) ? fmt(priceNum) : price;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-[220px] flex-1">
          <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted">
            Nombre del plan
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full max-w-sm rounded-md border border-border bg-background px-3 py-2 text-base font-semibold text-foreground outline-none focus:border-primary"
          />
        </div>
        <button
          type="button"
          onClick={() => setIsActive((v) => !v)}
          className={`rounded-full border px-3 py-1 text-xs font-medium ${
            isActive
              ? "border-success text-success hover:bg-success/10"
              : "border-border text-muted hover:bg-surface-hover"
          }`}
        >
          {isActive ? "Activo" : "Inactivo"}
        </button>
      </div>

      <div className="mb-4 rounded-lg border border-border bg-background p-3">
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">Precio</p>
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">Precio actual (COP)</label>
            <input
              type="number"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className="w-32 rounded-md border border-border bg-background px-2 py-1 text-sm text-foreground outline-none focus:border-primary"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">
              Precio de comparación (COP)
            </label>
            <input
              type="number"
              value={comparePrice}
              onChange={(e) => setComparePrice(e.target.value)}
              placeholder="Opcional"
              className="w-32 rounded-md border border-border bg-background px-2 py-1 text-sm text-foreground outline-none focus:border-primary"
            />
          </div>
        </div>
        <div className="mt-2 text-[11px] text-muted">
          {comparePriceError ? (
            <span className="text-red-400">{comparePriceError}</span>
          ) : savings !== null ? (
            <span className="flex flex-wrap items-center gap-2">
              Se verá así en la web:
              <span className="text-muted line-through">${comparePreview}</span>
              <span className="font-semibold text-foreground">${pricePreview}</span>
              <span className="rounded-full bg-success/15 px-2 py-0.5 font-semibold text-success">
                Ahorras ${savings}
              </span>
            </span>
          ) : (
            "Deja la comparación vacía para mostrar únicamente el precio normal."
          )}
        </div>
      </div>

      <div className="mb-4">
        <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted">
          Insignia (ej. &quot;Más popular&quot;)
        </label>
        <input
          type="text"
          value={badge}
          onChange={(e) => setBadge(e.target.value)}
          placeholder="Vacío = el plan se muestra sin insignia"
          className="w-full max-w-sm rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
        />
        <p className="mt-1 flex items-center gap-2 text-[11px] text-muted">
          {trimmedBadge ? (
            <>
              Se verá así en la web:
              <span className="rounded-full bg-primary px-2.5 py-0.5 text-[10px] font-semibold text-white">
                {trimmedBadge}
              </span>
            </>
          ) : (
            "Sin insignia. Escribe un texto para que aparezca sobre el plan en la web."
          )}
        </p>
      </div>

      <div className="mb-4">
        <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted">
          Beneficios (uno por línea, se muestran al cliente)
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={4}
          placeholder={"Ej: Hasta 5.000 contactos\nSoporte prioritario\nAgente de IA incluido"}
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
        />
      </div>

      <div className="mb-4 rounded-lg border border-border bg-background p-3">
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">
          Límites del plan
        </p>
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">Agentes de respuesta</label>
            <input
              type="number"
              min={0}
              value={maxAgents}
              onChange={(e) => setMaxAgents(e.target.value)}
              placeholder="Sin límite"
              className="w-28 rounded-md border border-border bg-background px-2 py-1 text-sm text-foreground outline-none focus:border-primary"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">Números de WhatsApp</label>
            <input
              type="number"
              min={0}
              value={maxNumbers}
              onChange={(e) => setMaxNumbers(e.target.value)}
              placeholder="Sin límite"
              className="w-28 rounded-md border border-border bg-background px-2 py-1 text-sm text-foreground outline-none focus:border-primary"
            />
          </div>
          <p className="w-full text-[11px] text-muted">
            Deja el campo vacío para &quot;sin límite&quot;.
          </p>
        </div>
      </div>

      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">
        Módulos incluidos
      </p>
      <div className="flex flex-wrap gap-4">
        {modules.map((m) => (
          <label
            key={m.key}
            className="flex cursor-pointer items-center gap-2 text-sm text-foreground"
          >
            <input
              type="checkbox"
              checked={moduleKeys.has(m.key)}
              onChange={(e) => toggleModule(m.key, e.target.checked)}
            />
            {m.name}
          </label>
        ))}
      </div>

      <div className="mt-5 flex items-center gap-3 border-t border-border pt-4">
        <button
          type="button"
          onClick={handleSave}
          disabled={pending}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover disabled:opacity-50"
        >
          {pending ? "Guardando..." : "Guardar cambios"}
        </button>
        {message && (
          <p className={`text-xs ${message.error ? "text-red-400" : "text-success"}`}>
            {message.text}
          </p>
        )}
      </div>
    </div>
  );
}

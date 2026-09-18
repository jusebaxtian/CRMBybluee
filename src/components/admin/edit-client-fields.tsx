"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import {
  updateWorkspaceName,
  updateOwnerEmail,
  updateOwnerPassword,
  updateWorkspacePhone,
  updateWorkspaceExtraNumbers,
  updateWorkspaceExtraAgents,
  updateWorkspaceRenewalDate,
} from "@/app/actions/admin";

const INPUT =
  "w-full min-w-0 rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground outline-none focus:border-primary";

type Valores = {
  name: string;
  phone: string;
  extraNumbers: string;
  extraAgents: string;
  email: string;
  password: string;
  /** Vencimiento (AAAA-MM-DD) del plan o de la prueba. */
  venceEl: string;
};

/**
 * Datos del cliente en Admin: rejilla compacta y UN solo boton "Guardar
 * cambios" que aplica solo lo que cambio (cada dato sigue teniendo su
 * accion de servidor). Los errores se muestran bajo el campo que fallo.
 */
export function EditClientFields({
  workspaceId,
  workspaceName,
  workspacePhone,
  extraNumbers,
  planAgents,
  extraAgents,
  planNumbers,
  ownerId,
  ownerEmail,
  createdAt,
  venceEl,
}: {
  workspaceId: string;
  workspaceName: string;
  workspacePhone: string | null;
  extraNumbers: number;
  /** Agentes que trae el plan: null = ilimitado. */
  planAgents: number | null;
  extraAgents: number;
  planNumbers: number;
  ownerId: string | null;
  ownerEmail: string | null;
  /** Fecha de registro del espacio (solo lectura). */
  createdAt: string;
  /** Vencimiento actual (AAAA-MM-DD) o vacio si no tiene. */
  venceEl: string;
}) {
  const router = useRouter();
  const inicial: Valores = {
    name: workspaceName,
    phone: workspacePhone ?? "",
    extraNumbers: String(extraNumbers),
    extraAgents: String(extraAgents),
    email: ownerEmail ?? "",
    password: "",
    venceEl,
  };
  const [v, setV] = useState<Valores>(inicial);
  const [guardado, setGuardado] = useState<Valores>(inicial);
  const [errores, setErrores] = useState<Partial<Record<keyof Valores, string>>>({});
  const [pending, setPending] = useState(false);
  const [ok, setOk] = useState<string | null>(null);

  const cambio = (k: keyof Valores) => v[k] !== guardado[k] && !(k === "password" && !v.password);
  const hayCambios = (Object.keys(v) as (keyof Valores)[]).some(cambio);

  function set(k: keyof Valores, valor: string) {
    setV((p) => ({ ...p, [k]: valor }));
    setOk(null);
  }

  async function guardar() {
    setPending(true);
    setErrores({});
    setOk(null);
    const tareas: [keyof Valores, () => Promise<{ error?: string } | undefined>][] = [];
    if (cambio("name")) tareas.push(["name", () => updateWorkspaceName(workspaceId, v.name)]);
    if (cambio("phone")) tareas.push(["phone", () => updateWorkspacePhone(workspaceId, v.phone)]);
    if (cambio("extraNumbers")) tareas.push(["extraNumbers", () => updateWorkspaceExtraNumbers(workspaceId, v.extraNumbers)]);
    if (cambio("extraAgents")) tareas.push(["extraAgents", () => updateWorkspaceExtraAgents(workspaceId, v.extraAgents)]);
    if (ownerId && cambio("email")) tareas.push(["email", () => updateOwnerEmail(ownerId, v.email, workspaceId)]);
    if (ownerId && cambio("password")) tareas.push(["password", () => updateOwnerPassword(ownerId, v.password, workspaceId)]);
    if (cambio("venceEl")) tareas.push(["venceEl", () => updateWorkspaceRenewalDate(workspaceId, v.venceEl)]);

    const nuevosErrores: Partial<Record<keyof Valores, string>> = {};
    const nuevoGuardado = { ...guardado };
    for (const [campo, accion] of tareas) {
      const r = await accion();
      if (r?.error) nuevosErrores[campo] = r.error;
      else nuevoGuardado[campo] = campo === "password" ? "" : v[campo];
    }
    setPending(false);
    setErrores(nuevosErrores);
    setGuardado(nuevoGuardado);
    if (Object.keys(nuevosErrores).length === 0) {
      setV((p) => ({ ...p, password: "" }));
      setOk(`Guardado (${tareas.length} ${tareas.length === 1 ? "cambio" : "cambios"}).`);
      router.refresh();
    }
  }

  const campo = (k: keyof Valores, label: string, type = "text", placeholder?: string) => (
    <div key={k}>
      <label className="mb-1 block text-xs font-medium text-muted">{label}</label>
      <input
        type={type}
        value={v[k]}
        placeholder={placeholder}
        onChange={(e) => set(k, e.target.value)}
        className={`${INPUT} ${cambio(k) ? "border-primary/60" : ""}`}
      />
      {errores[k] && <p className="mt-1 text-xs text-error">{errores[k]}</p>}
    </div>
  );

  return (
    <div>
      <div className="grid gap-x-6 gap-y-3 sm:grid-cols-2 xl:grid-cols-3">
        {campo("name", "Nombre del cliente / negocio")}
        {campo("phone", "Número de WhatsApp", "tel", "Ej: 573001234567")}
        {campo("extraNumbers", `Números de WhatsApp adicionales (el plan incluye ${planNumbers})`, "number", "0")}
        {campo(
          "extraAgents",
          `Agentes de respuesta adicionales (el plan incluye ${planAgents === null ? "ilimitados" : planAgents})`,
          "number",
          "0"
        )}
        {ownerId ? (
          <>
            {campo("email", "Correo de acceso", "email")}
            {campo("password", "Nueva contraseña", "password", "Mínimo 8 caracteres (vacío = no cambiar)")}
          </>
        ) : (
          <p className="text-xs text-muted">Este workspace no tiene un usuario propietario.</p>
        )}
        <div>
          <label className="mb-1 block text-xs font-medium text-muted">Fecha de registro</label>
          <p className={`${INPUT} cursor-default border-dashed text-muted`}>
            {new Date(createdAt).toLocaleDateString("es-CO", { day: "2-digit", month: "long", year: "numeric", timeZone: "America/Bogota" })}
          </p>
        </div>
        {campo("venceEl", "Vence el (plan o prueba)", "date")}
      </div>

      <div className="mt-4 flex items-center gap-3">
        <button
          type="button"
          onClick={guardar}
          disabled={!hayCambios || pending}
          className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-xs font-bold text-white hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending && <Loader2 size={13} className="animate-spin" />}
          {pending ? "Guardando…" : "Guardar cambios"}
        </button>
        {ok && <p className="text-xs text-success">{ok}</p>}
        {!ok && !hayCambios && <p className="text-xs text-muted">Sin cambios pendientes.</p>}
      </div>
    </div>
  );
}

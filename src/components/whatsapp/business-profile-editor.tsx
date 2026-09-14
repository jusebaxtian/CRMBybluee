"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Camera, Loader2, Pencil, X } from "lucide-react";
import { leerPerfilWhatsApp, guardarPerfilWhatsApp } from "@/app/actions/whatsapp-profile";
import type { BusinessProfile } from "@/lib/whatsapp/graph";

/**
 * Perfil de negocio del numero (foto, descripcion, info, direccion, correo,
 * sitios web, categoria): lo que ve el cliente en WhatsApp al abrir el perfil.
 * Se lee de Meta al abrir el editor y se guarda directo en Meta.
 */

const CATEGORIAS: { valor: string; nombre: string }[] = [
  { valor: "UNDEFINED", nombre: "Sin categoría" },
  { valor: "RETAIL", nombre: "Comercio / tienda" },
  { valor: "APPAREL", nombre: "Ropa y accesorios" },
  { valor: "BEAUTY", nombre: "Belleza, spa y salón" },
  { valor: "HEALTH", nombre: "Salud" },
  { valor: "RESTAURANT", nombre: "Restaurante" },
  { valor: "GROCERY", nombre: "Alimentos / mercado" },
  { valor: "HOTEL", nombre: "Hotel y alojamiento" },
  { valor: "TRAVEL", nombre: "Viajes y transporte" },
  { valor: "AUTO", nombre: "Automotriz" },
  { valor: "EDU", nombre: "Educación" },
  { valor: "FINANCE", nombre: "Finanzas" },
  { valor: "PROF_SERVICES", nombre: "Servicios profesionales" },
  { valor: "ENTERTAIN", nombre: "Entretenimiento" },
  { valor: "EVENT_PLAN", nombre: "Eventos" },
  { valor: "NONPROFIT", nombre: "Organización sin ánimo de lucro" },
  { valor: "GOVT", nombre: "Gobierno" },
  { valor: "OTHER", nombre: "Otro" },
];

const INPUT =
  "w-full rounded-[9px] border border-border bg-background px-3 py-2 text-[13px] text-foreground outline-none focus:border-primary disabled:opacity-50";

export function BusinessProfileEditor({ accountId }: { accountId: string }) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [perfil, setPerfil] = useState<BusinessProfile | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [previa, setPrevia] = useState<string | null>(null);
  const [guardando, startGuardar] = useTransition();
  const fotoRef = useRef<HTMLInputElement>(null);

  async function cargarPerfil() {
    setCargando(true);
    setError(null);
    const r = await leerPerfilWhatsApp(accountId);
    setCargando(false);
    if ("error" in r) setError(r.error);
    else setPerfil(r.perfil);
  }

  function abrir() {
    setAbierto(true);
    if (!perfil) void cargarPerfil();
  }

  function enviar(formData: FormData) {
    setError(null);
    setOk(false);
    startGuardar(async () => {
      const r = await guardarPerfilWhatsApp(formData);
      if ("error" in r) {
        setError(r.error);
        return;
      }
      setOk(true);
      setPrevia(null);
      router.refresh();
      void cargarPerfil(); // se vuelve a leer de Meta con lo guardado
    });
  }

  if (!abierto) {
    return (
      <button
        type="button"
        onClick={abrir}
        className="flex items-center gap-1.5 rounded-[9px] border border-border px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-surface-hover"
      >
        <Pencil size={13} />
        Editar perfil de WhatsApp
      </button>
    );
  }

  const foto = previa ?? perfil?.profile_picture_url ?? null;

  return (
    <div className="rounded-[12px] border border-border bg-background p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-semibold text-foreground">Perfil de WhatsApp</p>
        <button
          type="button"
          onClick={() => setAbierto(false)}
          aria-label="Cerrar"
          className="flex h-7 w-7 items-center justify-center rounded-md text-muted hover:bg-surface-hover hover:text-foreground"
        >
          <X size={14} />
        </button>
      </div>
      <p className="mb-4 text-xs text-muted">
        Es lo que ven tus clientes al abrir tu perfil en WhatsApp. Los cambios se aplican en Meta al guardar. El nombre
        visible no se edita aquí: lo aprueba Meta en WhatsApp Manager.
      </p>

      {cargando ? (
        <p className="flex items-center gap-2 py-6 text-sm text-muted">
          <Loader2 size={15} className="animate-spin" /> Leyendo el perfil desde Meta…
        </p>
      ) : (
        <form action={enviar} className="flex flex-col gap-3" key={perfil ? "cargado" : "vacio"}>
          <input type="hidden" name="accountId" value={accountId} />

          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => fotoRef.current?.click()}
              className="group relative h-20 w-20 shrink-0 overflow-hidden rounded-full border border-border bg-surface"
              title="Cambiar foto"
            >
              {foto ? (
                // eslint-disable-next-line @next/next/no-img-element -- foto servida por Meta
                <img src={foto} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="flex h-full w-full items-center justify-center text-muted">
                  <Camera size={22} />
                </span>
              )}
              <span className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
                <Camera size={18} className="text-white" />
              </span>
            </button>
            <div className="text-xs text-muted">
              <p className="font-medium text-foreground">Foto de perfil</p>
              <p>JPG o PNG, cuadrada, mínimo 192×192 px, máximo 5 MB.</p>
              <input
                ref={fotoRef}
                type="file"
                name="photo"
                accept="image/jpeg,image/png"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  setPrevia(f ? URL.createObjectURL(f) : null);
                }}
              />
            </div>
          </div>

          <label className="text-xs font-medium text-muted">
            Descripción corta (&quot;Sobre nosotros&quot;, máx. 139)
            <input name="about" maxLength={139} defaultValue={perfil?.about ?? ""} className={`${INPUT} mt-1`} />
          </label>
          <label className="text-xs font-medium text-muted">
            Información del negocio (máx. 512)
            <textarea
              name="description"
              maxLength={512}
              rows={3}
              defaultValue={perfil?.description ?? ""}
              className={`${INPUT} mt-1 resize-y`}
            />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-xs font-medium text-muted">
              Categoría
              <select name="vertical" defaultValue={perfil?.vertical ?? "UNDEFINED"} className={`${INPUT} mt-1`}>
                {CATEGORIAS.map((c) => (
                  <option key={c.valor} value={c.valor}>
                    {c.nombre}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs font-medium text-muted">
              Correo de contacto
              <input name="email" type="email" defaultValue={perfil?.email ?? ""} className={`${INPUT} mt-1`} />
            </label>
          </div>
          <label className="text-xs font-medium text-muted">
            Dirección
            <input name="address" maxLength={256} defaultValue={perfil?.address ?? ""} className={`${INPUT} mt-1`} />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-xs font-medium text-muted">
              Sitio web 1
              <input
                name="website1"
                type="url"
                placeholder="https://"
                defaultValue={perfil?.websites?.[0] ?? ""}
                className={`${INPUT} mt-1`}
              />
            </label>
            <label className="text-xs font-medium text-muted">
              Sitio web 2
              <input
                name="website2"
                type="url"
                placeholder="https://"
                defaultValue={perfil?.websites?.[1] ?? ""}
                className={`${INPUT} mt-1`}
              />
            </label>
          </div>

          {error && <p className="text-xs text-error">{error}</p>}
          {ok && <p className="text-xs text-success">Perfil actualizado en WhatsApp.</p>}

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => setAbierto(false)}
              className="rounded-[9px] border border-border px-3 py-2 text-xs font-medium text-muted hover:text-foreground"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={guardando}
              className="flex items-center gap-1.5 rounded-[9px] bg-primary px-4 py-2 text-xs font-bold text-white hover:bg-primary-hover disabled:opacity-50"
            >
              {guardando && <Loader2 size={13} className="animate-spin" />}
              {guardando ? "Guardando en Meta…" : "Guardar perfil"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

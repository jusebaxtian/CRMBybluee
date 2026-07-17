"use client";

import { useActionState, useState } from "react";
import { createTemplate } from "@/app/actions/templates";

export function CreateTemplateForm() {
  const [state, action, pending] = useActionState(createTemplate, undefined);
  const [bodyText, setBodyText] = useState("");

  return (
    <form action={action} className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div>
          <label htmlFor="name" className="mb-1 block text-sm font-medium text-muted">
            Nombre (interno)
          </label>
          <input
            id="name"
            name="name"
            type="text"
            required
            placeholder="promo_verano"
            pattern="[a-z0-9_]+"
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
          />
          <p className="mt-1 text-xs text-muted">minúsculas, números y _</p>
        </div>
        <div>
          <label htmlFor="category" className="mb-1 block text-sm font-medium text-muted">
            Categoría
          </label>
          <select
            id="category"
            name="category"
            defaultValue="UTILITY"
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
          >
            <option value="UTILITY">Utilidad</option>
            <option value="MARKETING">Marketing</option>
            <option value="AUTHENTICATION">Autenticación</option>
          </select>
        </div>
        <div>
          <label htmlFor="language" className="mb-1 block text-sm font-medium text-muted">
            Idioma
          </label>
          <select
            id="language"
            name="language"
            defaultValue="es"
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
          >
            <option value="es">Español</option>
            <option value="es_CO">Español (Colombia)</option>
            <option value="en_US">Inglés (EE.UU.)</option>
          </select>
        </div>
      </div>

      <div>
        <label htmlFor="headerText" className="mb-1 block text-sm font-medium text-muted">
          Encabezado (opcional)
        </label>
        <input
          id="headerText"
          name="headerText"
          type="text"
          maxLength={60}
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
        />
      </div>

      <div>
        <label htmlFor="bodyText" className="mb-1 block text-sm font-medium text-muted">
          Cuerpo del mensaje
        </label>
        <textarea
          id="bodyText"
          name="bodyText"
          required
          rows={4}
          value={bodyText}
          onChange={(e) => setBodyText(e.target.value)}
          placeholder="Hola {{1}}, tenemos una promoción especial para ti..."
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
        />
        <p className="mt-1 text-xs text-muted">
          Usa {"{{1}}"}, {"{{2}}"}, etc. para variables (ej. nombre del contacto).
        </p>
      </div>

      <div>
        <label htmlFor="footerText" className="mb-1 block text-sm font-medium text-muted">
          Pie de página (opcional)
        </label>
        <input
          id="footerText"
          name="footerText"
          type="text"
          maxLength={60}
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
        />
      </div>

      {state && "error" in state && <p className="text-sm text-red-400">{state.error}</p>}
      {state && "success" in state && (
        <p className="text-sm text-success">
          Plantilla enviada a Meta para aprobación. Puede tardar minutos u horas en revisarse.
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover disabled:opacity-50"
      >
        {pending ? "Enviando a Meta..." : "Enviar plantilla a aprobación"}
      </button>
    </form>
  );
}

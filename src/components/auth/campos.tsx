"use client";

import { useId, useState, type InputHTMLAttributes, type ReactNode } from "react";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { cn } from "@/lib/cn";
import { Button, type ButtonProps } from "@/components/ui/button";

/** Clases base de los inputs de autenticacion (sin ancho): mismas que el resto del panel, con alto comodo para tactil. */
export const INPUT_AUTH_BASE =
  "h-12 rounded-[10px] border border-border bg-surface px-3.5 text-[14px] text-foreground outline-none transition-colors placeholder:text-muted/70 hover:border-muted/40 focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-50 aria-[invalid=true]:border-error aria-[invalid=true]:focus:ring-error/20";
export const INPUT_AUTH = `w-full ${INPUT_AUTH_BASE}`;

export function Campo({
  etiqueta,
  error,
  icono,
  accesorio,
  className,
  id: idProp,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & {
  etiqueta: string;
  error?: string | null;
  /** Icono a la izquierda dentro del campo. */
  icono?: ReactNode;
  /** Control a la derecha dentro del campo (p. ej. el ojo de la contraseña). */
  accesorio?: ReactNode;
}) {
  const generado = useId();
  const id = idProp ?? generado;
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-[13px] font-medium text-foreground">
        {etiqueta}
      </label>
      <div className="relative">
        {icono && (
          <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted">{icono}</span>
        )}
        <input
          id={id}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          className={cn(INPUT_AUTH, icono ? "pl-10" : null, accesorio ? "pr-11" : null, className)}
          {...props}
        />
        {accesorio && <span className="absolute right-2 top-1/2 -translate-y-1/2">{accesorio}</span>}
      </div>
      {error && (
        <p id={`${id}-error`} className="mt-1.5 text-[12.5px] text-error">
          {error}
        </p>
      )}
    </div>
  );
}

export function CampoContrasena(
  props: Omit<Parameters<typeof Campo>[0], "type" | "accesorio">
) {
  const [visible, setVisible] = useState(false);
  return (
    <Campo
      type={visible ? "text" : "password"}
      accesorio={
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Ocultar contraseña" : "Mostrar contraseña"}
          className="flex h-8 w-8 items-center justify-center rounded-md text-muted transition-colors hover:bg-surface-hover hover:text-foreground"
        >
          {visible ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      }
      {...props}
    />
  );
}

/** Boton principal de los formularios: bloquea mientras envia y muestra el estado. */
export function BotonEnviar({
  cargando,
  textoCargando,
  children,
  className,
  ...props
}: ButtonProps & { cargando: boolean; textoCargando: string }) {
  return (
    <Button
      type="submit"
      variant="primary"
      disabled={cargando || props.disabled}
      aria-busy={cargando}
      className={cn(
        "h-12 w-full rounded-[10px] text-[14px] font-bold transition-[background-color,transform] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background active:scale-[0.99] disabled:cursor-not-allowed",
        className
      )}
      {...props}
    >
      {cargando ? (
        <span className="inline-flex items-center justify-center gap-2">
          <Loader2 size={16} className="animate-spin" />
          {textoCargando}
        </span>
      ) : (
        children
      )}
    </Button>
  );
}

/** Error general del formulario (no ligado a un campo). */
export function ErrorFormulario({ children }: { children?: string | null }) {
  if (!children) return null;
  return (
    <p role="alert" className="rounded-[10px] border border-error/30 bg-error/10 px-3.5 py-2.5 text-[13px] text-error">
      {children}
    </p>
  );
}

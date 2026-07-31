"use client";

import { useState, useTransition } from "react";
import { X, Send } from "lucide-react";
import { sendActivationNotification } from "@/app/actions/admin-whatsapp";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function plusDaysIso(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function NotifyActivationButton({
  workspaceId,
  phone,
  planName,
  username,
  email,
  hasTemplateConfig,
}: {
  workspaceId: string;
  phone: string | null;
  planName: string;
  username: string;
  email: string;
  hasTemplateConfig: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [form, setForm] = useState({
    phone: phone ?? "",
    planName,
    activationDate: todayIso(),
    expiryDate: plusDaysIso(30),
    username,
    email,
    password: "",
  });

  function close() {
    setOpen(false);
    setError(null);
    setSuccess(false);
  }

  function handleSend() {
    setError(null);
    startTransition(async () => {
      const result = await sendActivationNotification({
        workspaceId,
        phone: form.phone,
        planName: form.planName,
        activationDate: form.activationDate,
        expiryDate: form.expiryDate,
        username: form.username,
        email: form.email,
        password: form.password,
      });
      if (result?.error) {
        setError(result.error);
        return;
      }
      setSuccess(true);
    });
  }

  if (!hasTemplateConfig) {
    return (
      <p className="text-xs text-muted">
        Configura la plantilla de activación en /admin/whatsapp para poder notificar.
      </p>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded-lg border border-primary px-4 py-2 text-sm font-medium text-primary hover:bg-primary/10"
      >
        <Send size={14} />
        Notificar activación
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-xl border border-border bg-surface p-5">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">Notificar activación</h3>
              <button type="button" onClick={close} className="text-muted hover:text-foreground">
                <X size={16} />
              </button>
            </div>

            {success ? (
              <p className="text-sm text-success">Notificación enviada correctamente.</p>
            ) : (
              <div className="flex flex-col gap-3">
                <Field
                  label="Número de WhatsApp"
                  value={form.phone}
                  onChange={(v) => setForm((f) => ({ ...f, phone: v }))}
                />
                <Field
                  label="Nombre del plan"
                  value={form.planName}
                  onChange={(v) => setForm((f) => ({ ...f, planName: v }))}
                />
                <Field
                  label="Fecha de activación"
                  type="date"
                  value={form.activationDate}
                  onChange={(v) => setForm((f) => ({ ...f, activationDate: v }))}
                />
                <Field
                  label="Fecha de vencimiento"
                  type="date"
                  value={form.expiryDate}
                  onChange={(v) => setForm((f) => ({ ...f, expiryDate: v }))}
                />
                <Field
                  label="Usuario"
                  value={form.username}
                  onChange={(v) => setForm((f) => ({ ...f, username: v }))}
                />
                <Field
                  label="Correo"
                  value={form.email}
                  onChange={(v) => setForm((f) => ({ ...f, email: v }))}
                />
                <Field
                  label="Clave de acceso"
                  value={form.password}
                  onChange={(v) => setForm((f) => ({ ...f, password: v }))}
                />
                <p className="-mt-2 text-[11px] text-muted">
                  Escríbela solo si tu plantilla la incluye — no se guarda, se envía tal cual la
                  escribas aquí.
                </p>

                {error && <p className="text-xs text-red-400">{error}</p>}

                <div className="mt-2 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={close}
                    disabled={pending}
                    className="rounded-md border border-border px-3 py-1.5 text-sm text-foreground hover:bg-surface-hover disabled:opacity-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleSend}
                    disabled={pending}
                    className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-white hover:bg-primary-hover disabled:opacity-50"
                  >
                    {pending ? "Enviando..." : "Enviar"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-muted">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
      />
    </div>
  );
}

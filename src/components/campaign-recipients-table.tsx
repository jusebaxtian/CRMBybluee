"use client";

import { useMemo, useState } from "react";

type Recipient = {
  id: string;
  status: string;
  error_message: string | null;
  contacts: { name: string | null; wa_id: string };
};

const recipientStatusColor: Record<string, string> = {
  pending: "text-muted border-border",
  sent: "text-primary border-primary",
  delivered: "text-success border-success",
  read: "text-success border-success",
  failed: "text-red-400 border-red-400",
};

const recipientStatusLabel: Record<string, string> = {
  pending: "Pendiente",
  sent: "Enviado",
  delivered: "Entregado",
  read: "Leído",
  failed: "Falló",
};

const PAGE_SIZE = 100;

export function CampaignRecipientsTable({ recipients }: { recipients: Recipient[] }) {
  const [page, setPage] = useState(1);
  const pageCount = Math.max(1, Math.ceil(recipients.length / PAGE_SIZE));
  const paged = useMemo(
    () => recipients.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [recipients, page]
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-hidden rounded-xl border border-border bg-surface">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border text-muted">
              <th className="px-5 py-3 font-medium">Contacto</th>
              <th className="px-5 py-3 font-medium">Número</th>
              <th className="px-5 py-3 font-medium">Estado</th>
            </tr>
          </thead>
          <tbody>
            {paged.map((r) => {
              const contact = r.contacts;
              return (
                <tr key={r.id} className="border-b border-border last:border-b-0">
                  <td className="px-5 py-3 text-foreground">{contact.name ?? "—"}</td>
                  <td className="px-5 py-3 text-foreground">{contact.wa_id}</td>
                  <td className="px-5 py-3">
                    <span
                      className={`rounded-full border px-2 py-0.5 text-xs ${recipientStatusColor[r.status]}`}
                      title={r.error_message ?? undefined}
                    >
                      {recipientStatusLabel[r.status] ?? r.status}
                    </span>
                  </td>
                </tr>
              );
            })}
            {recipients.length === 0 && (
              <tr>
                <td colSpan={3} className="px-5 py-6 text-center text-muted">
                  Esta campaña no tiene destinatarios.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {recipients.length > 0 && (
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-muted">
            Mostrando {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, recipients.length)} de{" "}
            {recipients.length}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-40"
            >
              Anterior
            </button>
            <span className="text-xs text-muted">
              Página {page} de {pageCount}
            </span>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
              disabled={page >= pageCount}
              className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-40"
            >
              Siguiente
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

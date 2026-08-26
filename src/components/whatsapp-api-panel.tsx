import { BadgeCheck, Gauge, MessageSquareOff, Snowflake } from "lucide-react";
import { WhatsAppIcon } from "@/components/whatsapp-icon";
import { ConnectWhatsAppButton } from "@/components/connect-whatsapp-button";
import { DisconnectWhatsAppButton } from "@/components/disconnect-whatsapp-button";
import { RenameWhatsAppAccount } from "@/components/rename-whatsapp-account";
import type { PhoneNumberStatus } from "@/lib/whatsapp/graph";

const qualityLabel: Record<string, string> = {
  GREEN: "Buena",
  YELLOW: "Media",
  RED: "Baja",
  UNKNOWN: "Desconocida",
};
const qualityColor: Record<string, string> = {
  GREEN: "text-success border-success",
  YELLOW: "text-warning border-warning",
  RED: "text-red-400 border-red-400",
  UNKNOWN: "text-muted border-border",
};
const messagingLimitLabel: Record<string, string> = {
  TIER_50: "50 conversaciones/día",
  TIER_250: "250 conversaciones/día",
  TIER_1K: "1.000 conversaciones/día",
  TIER_10K: "10.000 conversaciones/día",
  TIER_100K: "100.000 conversaciones/día",
  UNLIMITED: "Sin límite",
};

export type WhatsAppAccount = {
  id: string;
  waba_id: string;
  phone_number_id: string;
  display_phone_number: string;
  status: string;
  label: string | null;
};

function AccountCard({
  account,
  phoneStatus,
}: {
  account: WhatsAppAccount;
  phoneStatus: PhoneNumberStatus | null;
}) {
  const frozen = account.status === "frozen";

  return (
    <div className={`rounded-xl border p-6 ${frozen ? "border-warning/40 bg-warning/5" : "border-border bg-surface"}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div
            className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${
              frozen ? "bg-warning/15 text-warning" : "bg-success/15 text-success"
            }`}
          >
            {frozen ? <Snowflake size={20} /> : <WhatsAppIcon size={22} />}
          </div>
          <div>
            <RenameWhatsAppAccount
              accountId={account.id}
              label={account.label}
              fallback={account.display_phone_number}
            />
            <p className="text-sm text-muted">{account.display_phone_number}</p>
          </div>
        </div>
        {frozen ? (
          <span className="rounded-full border border-warning px-2.5 py-1 text-xs font-medium text-warning">
            Congelado — mejora tu plan para reactivar
          </span>
        ) : (
          <DisconnectWhatsAppButton accountId={account.id} />
        )}
      </div>

      {!frozen && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-xs text-foreground">
            {phoneStatus?.verified_name ?? "—"}
          </span>
          <span
            className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs ${
              phoneStatus?.code_verification_status === "VERIFIED"
                ? "border-success text-success"
                : "border-border text-muted"
            }`}
          >
            <BadgeCheck size={13} />
            {phoneStatus?.code_verification_status === "VERIFIED" ? "Negocio verificado" : "No verificado"}
          </span>
          {phoneStatus?.quality_rating && (
            <span
              className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs ${
                qualityColor[phoneStatus.quality_rating] ?? qualityColor.UNKNOWN
              }`}
            >
              <Gauge size={13} />
              Calidad: {qualityLabel[phoneStatus.quality_rating] ?? phoneStatus.quality_rating}
            </span>
          )}
          {phoneStatus?.messaging_limit_tier && (
            <span className="flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-xs text-foreground">
              Límite: {messagingLimitLabel[phoneStatus.messaging_limit_tier] ?? phoneStatus.messaging_limit_tier}
            </span>
          )}
        </div>
      )}

      <div className="mt-5 grid grid-cols-1 gap-3 border-t border-border pt-4 sm:grid-cols-2">
        <div>
          <p className="text-xs text-muted">ID de cuenta de WhatsApp Business (WABA)</p>
          <p className="truncate text-sm text-foreground">{account.waba_id}</p>
        </div>
        <div>
          <p className="text-xs text-muted">ID del número de teléfono</p>
          <p className="truncate text-sm text-foreground">{account.phone_number_id}</p>
        </div>
      </div>
    </div>
  );
}

export function WhatsAppApiPanel({
  accounts,
  phoneStatuses,
  maxNumbers,
}: {
  accounts: WhatsAppAccount[];
  phoneStatuses: Record<string, PhoneNumberStatus | null>;
  maxNumbers: number;
}) {
  const activeCount = accounts.filter((a) => a.status !== "frozen").length;
  const atLimit = activeCount >= maxNumbers;

  if (accounts.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-surface p-6">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-surface-hover text-muted">
          <MessageSquareOff size={22} />
        </div>
        <h2 className="text-center text-lg font-semibold text-foreground">
          WhatsApp no está conectado
        </h2>
        <p className="mx-auto mt-1 max-w-md text-center text-sm text-muted">
          Sigue estos pasos para conectar tu número de WhatsApp Business y empezar a usar la
          bandeja, campañas y automatizaciones.
        </p>

        <ol className="mx-auto mt-5 flex max-w-md flex-col gap-3 text-sm text-foreground">
          <li className="flex gap-3">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[11px] font-medium text-primary">
              1
            </span>
            Haz clic en &quot;Conectar WhatsApp&quot; abajo.
          </li>
          <li className="flex gap-3">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[11px] font-medium text-primary">
              2
            </span>
            Inicia sesión con tu cuenta de Facebook Business Manager.
          </li>
          <li className="flex gap-3">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[11px] font-medium text-primary">
              3
            </span>
            Selecciona o crea tu cuenta de WhatsApp Business y tu número de teléfono.
          </li>
          <li className="flex gap-3">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[11px] font-medium text-primary">
              4
            </span>
            Confirma el código de verificación que llega por SMS o llamada.
          </li>
        </ol>

        <div className="mt-5 flex justify-center">
          <ConnectWhatsAppButton />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground">Números de WhatsApp</h2>
        <span className="text-xs text-muted">
          <span className="font-medium text-foreground">{activeCount}</span> / {maxNumbers} conectados
        </span>
      </div>

      {accounts.map((account) => (
        <AccountCard key={account.id} account={account} phoneStatus={phoneStatuses[account.id] ?? null} />
      ))}

      <div className="rounded-xl border border-dashed border-border p-5">
        {atLimit ? (
          <p className="text-sm text-muted">
            Alcanzaste el límite de números de tu plan.{" "}
            <a href="/dashboard/billing" className="font-medium text-primary hover:underline">
              Mejora tu plan
            </a>{" "}
            para conectar más.
          </p>
        ) : (
          <ConnectWhatsAppButton label="Conectar otro número" askLabel />
        )}
      </div>
    </div>
  );
}

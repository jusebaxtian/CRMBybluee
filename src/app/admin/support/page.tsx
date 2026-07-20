import { createClient } from "@/lib/supabase/server";
import { SupportWhatsappForm } from "@/components/support-whatsapp-form";

export default async function AdminSupportPage() {
  const supabase = await createClient();

  const { data: settings } = await supabase
    .from("platform_settings")
    .select("key, value")
    .in("key", ["support_whatsapp_number", "support_whatsapp_message"]);

  const number = settings?.find((s) => s.key === "support_whatsapp_number")?.value ?? "";
  const message = settings?.find((s) => s.key === "support_whatsapp_message")?.value ?? "";

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Botón de ayuda / soporte</h1>
        <p className="text-sm text-muted">
          Configura el número de WhatsApp y el mensaje que se envía cuando un cliente hace clic
          en &quot;Ayuda&quot; desde su panel.
        </p>
      </div>

      <div className="rounded-xl border border-border bg-surface p-6">
        <SupportWhatsappForm currentNumber={number} currentMessage={message} />
      </div>
    </div>
  );
}

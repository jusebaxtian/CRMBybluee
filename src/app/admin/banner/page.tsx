import { createClient } from "@/lib/supabase/server";
import { DashboardBannerUploader } from "@/components/dashboard-banner-uploader";

export default async function AdminBannerPage() {
  const supabase = await createClient();

  const { data: setting } = await supabase
    .from("platform_settings")
    .select("value")
    .eq("key", "dashboard_banner_url")
    .maybeSingle();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Banner del dashboard</h1>
        <p className="text-sm text-muted">
          Esta imagen se muestra a todos los clientes en su dashboard, junto a la tarjeta de
          conexión de WhatsApp.
        </p>
      </div>

      <div className="rounded-xl border border-border bg-surface p-6">
        <DashboardBannerUploader currentUrl={setting?.value ?? null} />
      </div>
    </div>
  );
}

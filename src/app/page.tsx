import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  const supabase = await createClient();
  const { data: plans } = await supabase
    .from("plans")
    .select("*")
    .eq("is_active", true);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 bg-background p-16 text-center">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo.png" alt="ByBluee" className="h-28 w-28 rounded-full" />

      <div>
        <h1 className="text-4xl font-semibold text-foreground">
          CRM Bybluee
        </h1>
        <p className="mt-2 text-muted">
          WhatsApp Business oficial para tu equipo de ventas.
        </p>
      </div>

      <div className="flex gap-4">
        <Link
          href="/signup"
          className="rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary-hover"
        >
          Empezar prueba gratis (7 días)
        </Link>
        <Link
          href="/login"
          className="rounded-md border border-border px-5 py-2.5 text-sm font-medium text-foreground hover:bg-surface"
        >
          Iniciar sesión
        </Link>
      </div>

      {plans && plans.length > 0 && (
        <div className="flex flex-col gap-2">
          {plans.map((plan) => (
            <p key={plan.id} className="text-sm text-muted">
              {plan.name} — ${(plan.price_cents / 100).toLocaleString("es-CO")}{" "}
              {plan.currency}/mes
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

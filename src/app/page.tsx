import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  const supabase = await createClient();
  const { data: plans } = await supabase
    .from("plans")
    .select("*")
    .eq("is_active", true);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 bg-zinc-50 p-16 text-center font-sans dark:bg-black">
      <div>
        <h1 className="text-4xl font-semibold text-black dark:text-white">
          CRM Bybluee
        </h1>
        <p className="mt-2 text-zinc-600 dark:text-zinc-400">
          WhatsApp Business oficial para tu equipo de ventas.
        </p>
      </div>

      <div className="flex gap-4">
        <Link
          href="/signup"
          className="rounded-md bg-black px-5 py-2.5 text-sm font-medium text-white dark:bg-white dark:text-black"
        >
          Empezar prueba gratis (7 días)
        </Link>
        <Link
          href="/login"
          className="rounded-md border border-zinc-300 px-5 py-2.5 text-sm font-medium text-black dark:border-zinc-700 dark:text-white"
        >
          Iniciar sesión
        </Link>
      </div>

      {plans && plans.length > 0 && (
        <div className="flex flex-col gap-2">
          {plans.map((plan) => (
            <p key={plan.id} className="text-sm text-zinc-500">
              {plan.name} — ${(plan.price_cents / 100).toLocaleString("es-CO")}{" "}
              {plan.currency}/mes
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

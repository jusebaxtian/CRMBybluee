import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  const supabase = await createClient();
  const { data: plans, error } = await supabase.from("plans").select("*");

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-zinc-50 p-16 font-sans dark:bg-black">
      <h1 className="text-3xl font-semibold text-black dark:text-zinc-50">
        CRM Bybluee
      </h1>
      {error ? (
        <p className="text-red-600">Error conectando a Supabase: {error.message}</p>
      ) : (
        <div className="flex flex-col gap-2">
          <p className="text-zinc-600 dark:text-zinc-400">
            Conexión a Supabase OK. Planes disponibles:
          </p>
          <ul className="list-disc pl-6">
            {plans?.map((plan) => (
              <li key={plan.id} className="text-black dark:text-zinc-50">
                {plan.name} — ${(plan.price_cents / 100).toLocaleString("es-CO")}{" "}
                {plan.currency}/{plan.billing_cycle === "monthly" ? "mes" : "año"}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

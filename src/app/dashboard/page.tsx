import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { logout } from "@/app/actions/auth";

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: membership } = await supabase
    .from("workspace_members")
    .select("role, workspaces(name, status, trial_ends_at)")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  const workspace = membership?.workspaces as unknown as
    | { name: string; status: string; trial_ends_at: string }
    | undefined;

  const trialDaysLeft = workspace
    ? Math.max(
        0,
        Math.ceil(
          (new Date(workspace.trial_ends_at).getTime() - Date.now()) /
            (1000 * 60 * 60 * 24)
        )
      )
    : null;

  return (
    <div className="min-h-screen bg-zinc-50 p-8 dark:bg-black">
      <div className="mx-auto flex max-w-2xl flex-col gap-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-black dark:text-white">
            {workspace?.name ?? "Tu workspace"}
          </h1>
          <form action={logout}>
            <button
              type="submit"
              className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-700"
            >
              Cerrar sesión
            </button>
          </form>
        </div>

        <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
          <p className="text-sm text-zinc-500">Sesión iniciada como</p>
          <p className="text-black dark:text-white">{user.email}</p>
        </div>

        {workspace && (
          <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
            <p className="text-sm text-zinc-500">Estado del workspace</p>
            <p className="text-black dark:text-white">
              {workspace.status === "trialing"
                ? `Periodo de prueba — ${trialDaysLeft} día(s) restante(s)`
                : workspace.status}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

import { redirect } from "next/navigation";
import Link from "next/link";
import { LayoutDashboard, Bell } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { isPlatformAdmin } from "@/lib/admin";
import { logout } from "@/app/actions/auth";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const isAdmin = await isPlatformAdmin(supabase);
  if (!isAdmin) redirect("/dashboard");

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="flex w-64 shrink-0 flex-col border-r border-border bg-surface">
        <div className="flex items-center gap-2 px-6 py-6">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary font-bold text-white">
            B
          </div>
          <div>
            <p className="text-lg font-semibold text-foreground">ByBluee</p>
            <p className="text-xs text-muted">Panel admin</p>
          </div>
        </div>
        <nav className="flex-1 px-3">
          <Link
            href="/admin"
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted hover:bg-surface-hover hover:text-foreground"
          >
            <LayoutDashboard size={18} />
            Workspaces
          </Link>
          <Link
            href="/admin/notifications"
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted hover:bg-surface-hover hover:text-foreground"
          >
            <Bell size={18} />
            Notificaciones
          </Link>
        </nav>
        <div className="border-t border-border p-4">
          <p className="mb-2 truncate text-xs text-muted">{user.email}</p>
          <form action={logout}>
            <button
              type="submit"
              className="w-full rounded-md border border-border px-3 py-1.5 text-sm text-foreground hover:bg-surface-hover"
            >
              Cerrar sesión
            </button>
          </form>
        </div>
      </aside>
      <main className="flex-1 p-8">{children}</main>
    </div>
  );
}

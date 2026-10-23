import { DIAS_ACTIVO, usuariosActivosYSinAvisos } from "@/lib/push/sin-avisos";

/**
 * Admin → Avisos del celular: quien entro en las ultimas dos semanas y NO tiene
 * notificaciones activadas en ningun dispositivo, con un boton para escribirle.
 */

const ROL: Record<string, string> = { owner: "Dueño", admin: "Administrador", agent: "Agente" };

const MENSAJE =
  "Hola, soy de ByBluee CRM. Vimos que aún no tienes activadas las notificaciones del celular. Así te enteras al instante de cada mensaje nuevo, aunque la app esté cerrada: entra al CRM y toca «Activar avisos» (arriba a la derecha).";

function numeroParaWhatsApp(tel: string | null): string | null {
  const d = (tel ?? "").replace(/\D/g, "");
  if (d.length === 10 && d.startsWith("3")) return `57${d}`;
  return d.length >= 11 && d.length <= 15 ? d : null;
}

export default async function AvisosCelularPage() {
  const { activos, sinAvisos: sin } = await usuariosActivosYSinAvisos();

  const porRol = (rol: string) => {
    const todos = activos.filter((f) => f.rol === rol);
    return { total: todos.length, sin: sin.filter((f) => f.rol === rol).length };
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Avisos del celular</h1>
        <p className="text-sm text-muted">
          Usuarios que entraron en los últimos {DIAS_ACTIVO} días y no tienen las notificaciones activadas.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {(["owner", "admin", "agent"] as const).map((rol) => {
          const r = porRol(rol);
          if (r.total === 0) return null;
          return (
            <div key={rol} className="rounded-[11px] border border-border bg-surface px-4 py-3">
              <p className="text-xs text-muted">{ROL[rol]}s activos</p>
              <p className="text-lg font-semibold text-foreground">
                {r.total - r.sin} de {r.total} con avisos
              </p>
              <p className={`text-xs ${r.sin > 0 ? "text-warning" : "text-success"}`}>{r.sin > 0 ? `${r.sin} sin activar` : "Todos activados"}</p>
            </div>
          );
        })}
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-surface">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead>
            <tr className="border-b border-border text-muted">
              <th className="px-3 py-3 font-medium">Usuario</th>
              <th className="px-3 py-3 font-medium">Cuenta</th>
              <th className="px-3 py-3 font-medium">Rol</th>
              <th className="px-3 py-3 font-medium">Última entrada</th>
              <th className="w-px px-3 py-3 font-medium">Avisarle</th>
            </tr>
          </thead>
          <tbody>
            {sin.map((f) => {
              const numero = numeroParaWhatsApp(f.tel);
              return (
                <tr key={f.id} className="border-b border-border last:border-b-0">
                  <td className="px-3 py-3 text-foreground [overflow-wrap:anywhere]">{f.correo}</td>
                  <td className="px-3 py-3 text-muted">{f.espacio}</td>
                  <td className="px-3 py-3 text-muted">{ROL[f.rol] ?? f.rol}</td>
                  <td className="px-3 py-3 text-muted">
                    {new Date(f.ultimo).toLocaleString("es-CO", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3">
                    {numero ? (
                      <a
                        href={`https://wa.me/${numero}?text=${encodeURIComponent(MENSAJE)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-md border border-border px-2.5 py-1 text-xs text-primary hover:bg-surface-hover"
                      >
                        Escribir por WhatsApp
                      </a>
                    ) : (
                      <span className="text-xs text-muted">Sin teléfono</span>
                    )}
                  </td>
                </tr>
              );
            })}
            {sin.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-muted">
                  Todos los usuarios activos tienen las notificaciones activadas.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-muted">
        El teléfono es el de la cuenta (el del dueño), también para sus agentes. Un usuario cuenta como activado si al menos uno de sus dispositivos lo está.
      </p>
    </div>
  );
}

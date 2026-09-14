"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Search, SlidersHorizontal, X, Clock, Megaphone, ShieldAlert, Bot, Check, Pin, PinOff } from "lucide-react";
import { setConversationPinned, cargarConversaciones } from "@/app/actions/conversations";
import { NewMessageButton } from "@/components/inbox/new-message-button";
import { PullToRefresh } from "@/components/ui/pull-to-refresh";
import { useMessageWindow } from "@/lib/use-message-window";
import { isWindowExpiringSoon, msRemainingInWindow } from "@/lib/whatsapp/message-window";


type Tag = { id: string; name: string; color: string };
type Agent = { id: string; name: string | null; email: string };
type Channel = { id: string; label: string | null; display_phone_number: string };
type Conversation = {
  id: string;
  last_message_at: string;
  pinnedAt: string | null;
  whatsappAccountId: string | null;
  lastMessagePreview: string | null;
  answered: boolean;
  unreadCount: number;
  assignedAgentId: string | null;
  lastInboundAt: string | null;
  fromAds: boolean;
  adHeadline: string | null;
  likelyBlocked: boolean;
  needsHuman: boolean;
  contact: { name: string | null; wa_id: string };
  tags: Tag[];
};

// Cycled by channel index — same order every render since `channels` comes
// from a stable, ordered query (connected_at).
const CHANNEL_COLORS = ["#1ba84a", "#4a9eff", "#f59e0b", "#a855f7"];

// Small red "24h" flag next to the timestamp when the WhatsApp free-form
// window has expired for that contact — same rule as the chat's own gate.
function WindowExpiredBadge({ lastInboundAt }: { lastInboundAt: string | null }) {
  const { open } = useMessageWindow(lastInboundAt);
  if (!lastInboundAt || open) return null;
  return (
    <span
      title="Ventana de 24h vencida — solo se pueden enviar plantillas"
      className="shrink-0 rounded px-1 py-0.5 text-[9px] font-semibold text-red-400"
    >
      24h
    </span>
  );
}
// Orange flag when the window is about to close (between 10s and 2h left)
// — an agent still has time to send a quick follow-up before it locks.
function WindowExpiringSoonBadge({
  lastInboundAt,
  now,
}: {
  lastInboundAt: string | null;
  now: number;
}) {
  if (!isWindowExpiringSoon(lastInboundAt, now)) return null;
  const m = Math.floor(msRemainingInWindow(lastInboundAt, now) / 60_000);
  return (
    <span
      title="La ventana de 24h está por vencer"
      className="flex shrink-0 items-center gap-0.5 rounded px-1 py-0.5 text-[9px] font-semibold text-warning"
    >
      <Clock size={10} />
      {m}m
    </span>
  );
}

type Contact = { id: string; name: string | null; wa_id: string };

export function ConversationListPanel({
  conversations: primeraPagina,
  contacts,
  allTags,
  agents,
  channels,
  hayMas,
  unreadConversationsCount,
}: {
  conversations: Conversation[];
  contacts: Contact[];
  allTags: Tag[];
  agents: Agent[];
  channels: Channel[];
  hayMas: boolean;
  unreadConversationsCount: number;
}) {
  const pathname = usePathname();

  // La primera pagina llega renderizada del servidor. En cuanto se toca un
  // filtro o la busqueda, la lista pasa a pedirse por accion: filtrar en el
  // navegador mostraria resultados de las cuarenta cargadas y no de las miles
  // que existen.
  const [filtradas, setFiltradas] = useState<Conversation[] | null>(null);
  const [quedanMas, setQuedanMas] = useState(hayMas);
  const [cargando, setCargando] = useState(false);
  const [errorCarga, setErrorCarga] = useState<string | null>(null);
  const ultimosFiltrosRef = useRef<typeof filtros | null>(null);

  const [query, setQuery] = useState("");
  // La bandeja siempre abre en "Todos" y con el panel de filtros cerrado
  // (decision del 14 sep 2026): los filtros los elige la persona. Los
  // enlaces del dashboard llevan a la bandeja sin preseleccionar nada.
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [assignedFilter, setAssignedFilter] = useState<string>(""); // "" = all, "unassigned", or agent id
  const [channelFilter, setChannelFilter] = useState<string>(""); // "" = all channels
  const [unreadOnly, setUnreadOnly] = useState(false);
  // "Sin responder" (el cliente hablo de ultimo) no es "no leido" (hay
  // entrantes desde que se abrio el chat): un chat abierto y no contestado es
  // lo primero y no lo segundo.
  const [unansweredOnly, setUnansweredOnly] = useState(false);
  const [expiringSoon, setExpiringSoon] = useState(false);
  const [needsHumanOnly, setNeedsHumanOnly] = useState(false);
  // Los filtros activos, en la forma que espera el servidor.
  const filtros = useMemo(
    () => ({
      query,
      channel: channelFilter || null,
      tagIds: selectedTagIds,
      assigned: assignedFilter || null,
      unreadOnly,
      unansweredOnly,
      needsHuman: needsHumanOnly,
      expiringSoon,
    }),
    [query, channelFilter, selectedTagIds, assignedFilter, unreadOnly, unansweredOnly, expiringSoon, needsHumanOnly]
  );

  const hayFiltros =
    query.trim() !== "" ||
    channelFilter !== "" ||
    selectedTagIds.length > 0 ||
    assignedFilter !== "" ||
    unreadOnly ||
    unansweredOnly ||
    expiringSoon ||
    needsHumanOnly;

  // Se espera un momento antes de consultar: sin esto, escribir "maria"
  // lanzaria cinco peticiones y pintaria la que llegara ultima, que no tiene
  // por que ser la del texto completo.
  useEffect(() => {
    if (!hayFiltros) {
      setFiltradas(null);
      setQuedanMas(hayMas);
      return;
    }
    let vigente = true;
    // Solo se atenua la lista cuando cambian los filtros. Un refresco de
    // fondo (realtime, volver de un chat) re-consulta en silencio: si
    // atenuara, la lista parpadearia con cada mensaje que entra.
    const cambiaronFiltros = ultimosFiltrosRef.current !== filtros;
    ultimosFiltrosRef.current = filtros;
    if (cambiaronFiltros) setCargando(true);
    const id = setTimeout(async () => {
      const resultado = await cargarConversaciones({ filters: filtros });
      if (!vigente) return;
      setCargando(false);
      if ("error" in resultado) {
        setErrorCarga(resultado.error ?? "No se pudo buscar.");
        return;
      }
      setErrorCarga(null);
      setFiltradas(resultado.conversations);
      setQuedanMas(resultado.hayMas);
    }, 300);
    return () => {
      vigente = false;
      clearTimeout(id);
    };
    // `primeraPagina` entra en las dependencias a proposito: cambia cada vez
    // que el servidor vuelve a renderizar (RealtimeRefresh dispara
    // router.refresh() con cualquier cambio en `conversations`, incluido
    // marcarla como leida al abrirla). Sin esto, la lista filtrada se pedia
    // una sola vez y un chat ya leido o respondido seguia apareciendo en
    // "No leidos" hasta tocar un filtro.
  }, [filtros, hayFiltros, hayMas, primeraPagina]);

  // Sin filtros manda el servidor; con filtros, lo ultimo que se pidio.
  const lista = filtradas ?? primeraPagina;

  async function cargarMas() {
    const ultima = lista[lista.length - 1];
    if (!ultima || cargando) return;
    setCargando(true);
    setErrorCarga(null);
    const resultado = await cargarConversaciones({
      cursor: { pinnedAt: ultima.pinnedAt, lastMessageAt: ultima.last_message_at },
      filters: hayFiltros ? filtros : undefined,
    });
    setCargando(false);
    if ("error" in resultado) {
      setErrorCarga(resultado.error ?? "No se pudieron cargar más chats.");
      return;
    }
    setFiltradas([...lista, ...resultado.conversations]);
    setQuedanMas(resultado.hayMas);
  }

  const [, startTransition] = useTransition();
  const [pinError, setPinError] = useState<string | null>(null);

  // El fijado es del espacio, no de quien lo pulsa: si el dueno fija un chat,
  // sus agentes tambien lo ven arriba. El orden ya viene del servidor
  // (pinned_at primero), asi que aqui solo se dispara la accion.
  function handleTogglePin(conversationId: string, pinned: boolean) {
    setPinError(null);
    startTransition(async () => {
      const result = await setConversationPinned(conversationId, pinned);
      if (result?.error) setPinError(result.error);
    });
  }

  const channelColor = new Map(channels.map((c, i) => [c.id, CHANNEL_COLORS[i % CHANNEL_COLORS.length]]));
  const channelName = (c: Channel) => c.label || c.display_phone_number;

  // Only needed to keep the "por vencer" filter and its badges live —
  // ticks once a second so a conversation drops out of the list the moment
  // it crosses the 2h or 10s edge, without a manual refresh.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // El filtrado ocurre en la base: `lista` ya viene filtrada y ordenada.
  const filtered = lista;

  // Panel flotante: se cierra al hacer clic fuera o con Escape; los filtros
  // ya quedaron aplicados (cada cambio de estado re-consulta al servidor).
  const panelFiltrosRef = useRef<HTMLDivElement>(null);
  const botonFiltrosRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!filtersOpen) return;
    function fuera(e: MouseEvent | TouchEvent) {
      const t = e.target as Node;
      if (panelFiltrosRef.current?.contains(t) || botonFiltrosRef.current?.contains(t)) return;
      setFiltersOpen(false);
    }
    function tecla(e: KeyboardEvent) {
      if (e.key === "Escape") setFiltersOpen(false);
    }
    document.addEventListener("mousedown", fuera);
    document.addEventListener("touchstart", fuera);
    document.addEventListener("keydown", tecla);
    return () => {
      document.removeEventListener("mousedown", fuera);
      document.removeEventListener("touchstart", fuera);
      document.removeEventListener("keydown", tecla);
    };
  }, [filtersOpen]);

  // Solo los filtros que viven dentro del panel (los rapidos se ven solos).
  const otrosFiltrosActivos =
    selectedTagIds.length + (assignedFilter ? 1 : 0) + (unansweredOnly ? 1 : 0) + (needsHumanOnly ? 1 : 0);

  // Llega contado desde la base. Contarlo sobre la lista daria el numero de
  // la pagina cargada, no el del espacio, y diria de menos sin avisar.

  function toggleTag(id: string) {
    setSelectedTagIds((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]
    );
  }

  function clearFilters() {
    setSelectedTagIds([]);
    setAssignedFilter("");
    setUnreadOnly(false);
    setUnansweredOnly(false);
    setExpiringSoon(false);
    setNeedsHumanOnly(false);
  }

  return (
    <aside className="flex h-full w-full shrink-0 flex-col border-r border-border bg-surface lg:w-80">
      <div className="flex items-center justify-between border-b border-border px-4 py-4">
        <div className="flex items-center gap-2">
          <h2 className="font-dash-ui text-[15px] font-semibold text-foreground">Conversaciones</h2>
          {unreadConversationsCount > 0 && (
            <span
              title="Chats sin abrir"
              className="rounded-full bg-primary/15 px-2 py-0.5 text-xs text-primary"
            >
              {unreadConversationsCount}
            </span>
          )}
        </div>
        <NewMessageButton contacts={contacts} compact />
      </div>

      <div className="flex items-center gap-2 border-b border-border p-3">
        <div className="flex flex-1 items-center gap-2 rounded-lg border border-border bg-background px-3 py-2">
          <Search size={14} className="text-muted" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar..."
            className="w-full bg-transparent text-sm text-foreground outline-none"
          />
        </div>
      </div>

      {/* Filtros rapidos (excluyentes entre si) + el resto en un panel flotante
          que se cierra al hacer clic fuera. Todo aplica al instante. */}
      <div className="relative border-b border-border px-3 py-2.5">
        <div className="flex items-center gap-1 overflow-x-auto [scrollbar-width:none]">
          <button
            type="button"
            onClick={() => {
              setUnreadOnly(false);
              setExpiringSoon(false);
            }}
            className={pill(!unreadOnly && !expiringSoon)}
          >
            Todos
          </button>
          <button
            type="button"
            onClick={() => {
              setUnreadOnly(true);
              setExpiringSoon(false);
            }}
            className={pill(unreadOnly)}
          >
            No leídos
            {unreadConversationsCount > 0 && !unreadOnly && (
              <span className="ml-0.5 rounded-full bg-primary/15 px-1.5 text-[10px] text-primary">{unreadConversationsCount}</span>
            )}
          </button>
          <button
            type="button"
            onClick={() => {
              setExpiringSoon(true);
              setUnreadOnly(false);
            }}
            title="Ventana de 24h por vencer (menos de 2 horas)"
            className={pill(expiringSoon, "warning")}
          >
            <Clock size={11} />
            Por vencer 2h
          </button>
          <button
            ref={botonFiltrosRef}
            type="button"
            onClick={() => setFiltersOpen((v) => !v)}
            aria-expanded={filtersOpen}
            aria-label="Más filtros"
            title="Más filtros"
            className={`relative ml-auto flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border transition-colors ${
              filtersOpen || otrosFiltrosActivos > 0
                ? "border-primary text-primary"
                : "border-border text-muted hover:text-foreground"
            }`}
          >
            <SlidersHorizontal size={15} />
            {otrosFiltrosActivos > 0 && (
              <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-medium text-white">
                {otrosFiltrosActivos}
              </span>
            )}
          </button>
        </div>

      {channels.length > 1 && (
        <div className="flex flex-wrap gap-1.5 border-b border-border px-3 py-2.5">
          <button
            type="button"
            onClick={() => setChannelFilter("")}
            className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
              channelFilter === ""
                ? "border-primary bg-primary/15 text-primary"
                : "border-border text-muted hover:text-foreground"
            }`}
          >
            Todos
          </button>
          {channels.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setChannelFilter(c.id)}
              className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                channelFilter === c.id
                  ? "border-primary bg-primary/15 text-primary"
                  : "border-border text-muted hover:text-foreground"
              }`}
            >
              <span
                className="h-1.5 w-1.5 shrink-0 rounded-full"
                style={{ backgroundColor: channelColor.get(c.id) }}
              />
              {channelName(c)}
            </button>
          ))}
        </div>
      )}

        {filtersOpen && (
        <div
          ref={panelFiltrosRef}
          role="dialog"
          aria-label="Más filtros"
          className="absolute left-3 right-3 top-[calc(100%-4px)] z-30 flex flex-col gap-3 rounded-[12px] border border-border bg-surface p-3 shadow-[0_18px_40px_rgba(0,0,0,0.45)] animate-[filtros-in_0.15s_ease-out]"
        >
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setUnansweredOnly((v) => !v)}
              title="El cliente escribió de último y nadie ha contestado"
              className={`self-start rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                unansweredOnly
                  ? "border-primary bg-primary text-white"
                  : "border-border text-muted hover:text-foreground"
              }`}
            >
              Sin responder
            </button>
            <button
              type="button"
              onClick={() => setNeedsHumanOnly((v) => !v)}
              title="Chats donde la IA pidió que un humano tome el control"
              className={`flex items-center gap-1 self-start rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                needsHumanOnly
                  ? "border-red-400 bg-red-400 text-white"
                  : "border-border text-muted hover:text-foreground"
              }`}
            >
              <Bot size={12} />
              Necesita humano
            </button>
          </div>

          {allTags.length > 0 && (
            <div>
              <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted">
                Etiquetas
              </p>
              <div className="flex flex-wrap gap-1.5">
                {allTags.map((tag) => {
                  const active = selectedTagIds.includes(tag.id);
                  return (
                    <button
                      key={tag.id}
                      type="button"
                      onClick={() => toggleTag(tag.id)}
                      className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors ${
                        active
                          ? "border-transparent text-white"
                          : "border-border text-muted hover:text-foreground"
                      }`}
                      style={active ? { backgroundColor: tag.color } : undefined}
                    >
                      <span
                        className="h-1.5 w-1.5 shrink-0 rounded-full"
                        style={{ backgroundColor: active ? "#fff" : tag.color }}
                      />
                      {tag.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {agents.length > 0 && (
            <div>
              <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted">
                Asignado a
              </p>
              <select
                value={assignedFilter}
                onChange={(e) => setAssignedFilter(e.target.value)}
                className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-xs text-foreground outline-none focus:border-primary"
              >
                <option value="">Todos</option>
                <option value="unassigned">Sin asignar</option>
                {agents.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name ?? a.email}
                  </option>
                ))}
              </select>
            </div>
          )}

          {otrosFiltrosActivos > 0 && (
            <button
              type="button"
              onClick={() => {
                clearFilters();
                setFiltersOpen(false);
              }}
              className="flex items-center gap-1 self-start text-xs text-muted hover:text-foreground"
            >
              <X size={12} />
              Limpiar filtros
            </button>
          )}
        </div>
        )}
      </div>

      <PullToRefresh className="flex-1">
        {pinError && (
          <p className="border-b border-border bg-warning/10 px-4 py-2 text-xs text-warning">
            {pinError}
          </p>
        )}
        {filtered.length === 0 && (
          <p className="p-6 text-center text-sm text-muted">Sin resultados.</p>
        )}
        {filtered.map((conv) => {
          const active = pathname === `/dashboard/inbox/${conv.id}`;
          return (
            <Link
              key={conv.id}
              href={`/dashboard/inbox/${conv.id}`}
              className={`group flex items-center gap-3 border-b border-border px-4 py-3 ${
                active
                  ? "bg-surface-hover"
                  : conv.pinnedAt
                    ? "bg-primary/5 hover:bg-surface-hover"
                    : "hover:bg-surface-hover"
              }`}
            >
              <div className="relative shrink-0">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-success/15 text-sm font-semibold text-success">
                  {(conv.contact.name ?? conv.contact.wa_id).charAt(0).toUpperCase()}
                </div>
                {!conv.answered && (
                  <span
                    title="Sin responder"
                    className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-surface bg-warning"
                  />
                )}
                {channels.length > 1 && conv.whatsappAccountId && channelColor.has(conv.whatsappAccountId) && (
                  <span
                    title={channelName(channels.find((c) => c.id === conv.whatsappAccountId)!)}
                    className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-surface"
                    style={{ backgroundColor: channelColor.get(conv.whatsappAccountId) }}
                  />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <p className="flex min-w-0 items-center gap-1 truncate text-sm font-medium text-foreground">
                    <span className="truncate">{conv.contact.name || conv.contact.wa_id}</span>
                    {conv.fromAds && (
                      <span
                        title={
                          conv.adHeadline
                            ? `Desde anuncio de Meta Ads: ${conv.adHeadline}`
                            : "Desde un anuncio de Meta Ads"
                        }
                      >
                        <Megaphone size={11} className="shrink-0 text-primary" />
                      </span>
                    )}
                    {conv.likelyBlocked && (
                      <span title="Posible bloqueo — no recibe seguimientos ni mensajes masivos">
                        <ShieldAlert size={11} className="shrink-0 text-red-400" />
                      </span>
                    )}
                    {conv.needsHuman && (
                      <span
                        title="El cliente pidió hablar con una persona — la IA se pausó en este chat"
                        className="flex shrink-0 items-center gap-0.5 rounded-full bg-red-400/15 px-1.5 py-0.5 text-[9px] font-semibold text-red-400"
                      >
                        <Bot size={9} />
                        Humano
                      </span>
                    )}
                  </p>
                  <span className="flex shrink-0 items-center gap-1">
                    <WindowExpiredBadge lastInboundAt={conv.lastInboundAt} />
                    <WindowExpiringSoonBadge lastInboundAt={conv.lastInboundAt} now={now} />
                    <button
                      type="button"
                      // La fila entera es un <Link>: sin esto, fijar navegaria
                      // al chat en vez de quedarse en la lista.
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleTogglePin(conv.id, !conv.pinnedAt);
                      }}
                      title={conv.pinnedAt ? "Quitar de fijados" : "Fijar arriba"}
                      aria-label={conv.pinnedAt ? "Quitar de fijados" : "Fijar arriba"}
                      // Siempre visible y con area de toque de 32px: en el
                      // celular no hay "pasar el cursor" que lo revele.
                      className={`-my-1 flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${
                        conv.pinnedAt
                          ? "text-primary hover:bg-primary/10"
                          : "text-muted/60 hover:bg-surface-hover hover:text-foreground"
                      }`}
                    >
                      {conv.pinnedAt ? <Pin size={16} /> : <PinOff size={16} />}
                    </button>
                    <span className="text-[10px] text-muted">
                      {new Date(conv.last_message_at).toLocaleTimeString("es-CO", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </span>
                </div>
                {conv.contact.name && (
                  <p className="truncate text-xs text-muted">{conv.contact.wa_id}</p>
                )}
                {conv.tags.length > 0 && (
                  <div className="mt-0.5 flex flex-wrap gap-1">
                    {conv.tags.map((tag) => (
                      <span
                        key={tag.id}
                        title={tag.name}
                        className="rounded-full px-1.5 py-0.5 text-[10px] font-medium leading-none text-white"
                        style={{ backgroundColor: tag.color }}
                      >
                        {tag.name}
                      </span>
                    ))}
                  </div>
                )}
                <div className="flex items-center justify-between gap-2">
                  <p className="flex min-w-0 items-center gap-1 truncate text-xs text-muted">
                    {conv.answered && (
                      <Check
                        size={12}
                        className="shrink-0 text-primary"
                        aria-label="Último mensaje enviado por ti"
                      />
                    )}
                    <span className="truncate">{conv.lastMessagePreview ?? "Sin mensajes"}</span>
                  </p>
                  {conv.unreadCount > 0 && (
                    <span className="flex h-4 min-w-4 shrink-0 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-medium text-white">
                      {conv.unreadCount > 99 ? "99+" : conv.unreadCount}
                    </span>
                  )}
                </div>
              </div>
            </Link>
          );
        })}

        {quedanMas && (
          <div className="p-3">
            <button
              type="button"
              onClick={cargarMas}
              disabled={cargando}
              className="w-full rounded-lg border border-border py-2.5 text-sm text-muted transition-colors hover:bg-surface hover:text-foreground disabled:opacity-50"
            >
              {cargando ? "Cargando…" : "Cargar más chats"}
            </button>
            {errorCarga && (
              <p className="mt-2 text-center text-xs text-red-400">{errorCarga}</p>
            )}
          </div>
        )}

        {/* Los filtros y la busqueda corren sobre lo que ya se cargo. Con la
            bandeja paginada eso puede confundir -- "no aparece" y "todavia no
            se ha traido" se ven igual -- asi que se dice. */}
        {!quedanMas && lista.length > 0 && (
          <p className="p-4 text-center text-xs text-muted">
            {lista.length} {lista.length === 1 ? "chat" : "chats"}
            {hayFiltros ? " encontrados" : " · no hay más"}
          </p>
        )}
      </PullToRefresh>
    </aside>
  );
}

/** Pastilla de filtro rapido: mismo look que las de canal, con variante ambar para "Por vencer". */
function pill(activa: boolean, tono: "primary" | "warning" = "primary"): string {
  const base = "flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full border px-2 py-1 text-[11.5px] font-medium transition-colors";
  if (!activa) return `${base} border-border text-muted hover:text-foreground`;
  return tono === "warning"
    ? `${base} border-warning bg-warning/15 text-warning`
    : `${base} border-primary bg-primary/15 text-primary`;
}

"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { MessageSquarePlus, MoreHorizontal, MoreVertical, UserPlus, Mail, MailOpen, Pencil, Trash2, Pin, PinOff, X } from "lucide-react";
import {
  eliminarContactoDesdeChat,
  editarContactoDesdeChat,
  guardarContactoDesdeChat,
  marcarChatNoLeido,
  setConversationPinned,
} from "@/app/actions/conversations";

/**
 * Acciones del chat (diseno A aprobado el 23 nov 2026): nueva conversacion,
 * agregar/editar/eliminar contacto y marcar como no leido, desde la lista y
 * desde el encabezado del chat.
 */

const CAMPO =
  "w-full rounded-[9px] border border-border bg-background px-3 py-2 text-[13px] text-foreground outline-none focus:border-primary";
const BOTON_SECUNDARIO =
  "rounded-lg border border-border px-3 py-2 text-sm text-foreground hover:bg-surface-hover disabled:opacity-50";
const BOTON_PRIMARIO =
  "rounded-lg bg-primary px-3 py-2 text-sm font-medium text-white hover:bg-primary-hover disabled:opacity-50";

function Modal({ titulo, onClose, children }: { titulo: string; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", tecla);
    return () => document.removeEventListener("keydown", tecla);
  }, [onClose]);
  // En un portal: el menu de la fila vive dentro de un enlace, y un "fixed"
  // dentro de un contenedor con transform no cubriria la pantalla.
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
      role="dialog"
      aria-modal="true"
      aria-label={titulo}
    >
      <div className="w-full max-w-sm rounded-xl border border-border bg-surface p-5 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <p className="text-sm font-semibold text-foreground">{titulo}</p>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="text-muted hover:text-foreground">
            <X size={16} />
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body
  );
}

/** Nuevo contacto o nueva conversacion: mismo formulario, cambia el boton principal. */
export function ContactoDialog({
  modo,
  contactId,
  inicial,
  onClose,
}: {
  modo: "nuevo" | "conversacion" | "editar";
  contactId?: string;
  inicial?: { nombre: string; telefono: string };
  onClose: () => void;
}) {
  const router = useRouter();
  const [nombre, setNombre] = useState(inicial?.nombre ?? "");
  const [telefono, setTelefono] = useState(inicial?.telefono ?? "");
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();

  function guardar(abrirChat: boolean) {
    setError(null);
    setAviso(null);
    if (!telefono.replace(/\D/g, "")) {
      setError("Escribe el número de WhatsApp.");
      return;
    }
    startTransition(async () => {
      if (modo === "editar" && contactId) {
        const r = await editarContactoDesdeChat(contactId, nombre, telefono);
        if ("error" in r) return setError(r.error ?? "No se pudo guardar.");
        router.refresh();
        onClose();
        return;
      }
      const r = await guardarContactoDesdeChat({ nombre, telefono, abrirChat });
      if ("error" in r) return setError(r.error ?? "No se pudo guardar.");
      if (r.conversationId) {
        onClose();
        router.push(`/dashboard/inbox/${r.conversationId}`);
        return;
      }
      setAviso(r.yaExistia ? "Ese número ya era un contacto: quedó actualizado." : "Contacto guardado.");
      setNombre("");
      setTelefono("");
    });
  }

  const titulo = modo === "editar" ? "Editar contacto" : modo === "conversacion" ? "Nueva conversación" : "Agregar contacto";
  return (
    <Modal titulo={titulo} onClose={onClose}>
      <label className="mb-1 block text-xs font-medium text-muted" htmlFor="contacto-telefono">
        Número de WhatsApp
      </label>
      <input
        id="contacto-telefono"
        value={telefono}
        onChange={(e) => setTelefono(e.target.value)}
        placeholder="57 300 123 4567"
        inputMode="tel"
        autoFocus
        className={`${CAMPO} mb-3`}
      />
      <label className="mb-1 block text-xs font-medium text-muted" htmlFor="contacto-nombre">
        Nombre (opcional)
      </label>
      <input
        id="contacto-nombre"
        value={nombre}
        onChange={(e) => setNombre(e.target.value)}
        placeholder="María Gómez"
        className={CAMPO}
      />
      {modo === "conversacion" && (
        <p className="mt-2 text-[11.5px] text-muted">
          Si el contacto no te ha escrito en las últimas 24 horas, el primer mensaje tiene que ser una plantilla aprobada.
        </p>
      )}
      {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
      {aviso && <p className="mt-2 text-xs text-success">{aviso}</p>}
      <div className="mt-4 flex justify-end gap-2">
        {modo === "nuevo" && (
          <button type="button" disabled={pendiente} onClick={() => guardar(true)} className={BOTON_SECUNDARIO}>
            Guardar y abrir chat
          </button>
        )}
        <button type="button" disabled={pendiente} onClick={() => guardar(modo === "conversacion")} className={BOTON_PRIMARIO}>
          {pendiente ? "Guardando…" : modo === "conversacion" ? "Abrir chat" : "Guardar"}
        </button>
      </div>
    </Modal>
  );
}

/** Confirmacion antes de borrar: el contacto se va con todos sus chats. */
function EliminarContactoDialog({
  contactId,
  nombre,
  onClose,
  onEliminado,
}: {
  contactId: string;
  nombre: string;
  onClose: () => void;
  onEliminado: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();
  return (
    <Modal titulo="Eliminar contacto" onClose={onClose}>
      <p className="text-sm text-foreground">
        Se eliminará <span className="font-semibold">{nombre}</span> con todos sus chats y mensajes. No se puede deshacer.
      </p>
      {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
      <div className="mt-4 flex justify-end gap-2">
        <button type="button" onClick={onClose} className={BOTON_SECUNDARIO}>
          Cancelar
        </button>
        <button
          type="button"
          disabled={pendiente}
          onClick={() =>
            startTransition(async () => {
              const r = await eliminarContactoDesdeChat(contactId);
              if ("error" in r) return setError(r.error ?? "No se pudo eliminar.");
              onEliminado();
            })
          }
          className="rounded-lg bg-red-500 px-3 py-2 text-sm font-medium text-white hover:bg-red-600 disabled:opacity-50"
        >
          {pendiente ? "Eliminando…" : "Eliminar"}
        </button>
      </div>
    </Modal>
  );
}

/** Menu flotante que se cierra al hacer clic fuera o con Escape. */
function useMenu() {
  const [abierto, setAbierto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!abierto) return;
    const fuera = (e: MouseEvent | TouchEvent) => {
      if (!ref.current?.contains(e.target as Node)) setAbierto(false);
    };
    const tecla = (e: KeyboardEvent) => e.key === "Escape" && setAbierto(false);
    document.addEventListener("mousedown", fuera);
    document.addEventListener("touchstart", fuera);
    document.addEventListener("keydown", tecla);
    return () => {
      document.removeEventListener("mousedown", fuera);
      document.removeEventListener("touchstart", fuera);
      document.removeEventListener("keydown", tecla);
    };
  }, [abierto]);
  return { abierto, setAbierto, ref };
}

const ITEM = "flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-[13px] text-foreground hover:bg-surface-hover";
const ITEM_PELIGRO = "flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-[13px] text-red-400 hover:bg-red-500/10";
const MENU = "absolute right-0 top-full z-40 mt-1 w-52 rounded-lg border border-border bg-surface p-1 shadow-xl";

/** Boton de la lista: abre un chat con un numero nuevo o con un contacto. */
export function NuevaConversacionBoton() {
  const [abierto, setAbierto] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setAbierto(true)}
        title="Nueva conversación"
        aria-label="Nueva conversación"
        className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-white hover:bg-primary-hover"
      >
        <MessageSquarePlus size={16} />
      </button>
      {abierto && <ContactoDialog modo="conversacion" onClose={() => setAbierto(false)} />}
    </>
  );
}

/** Encabezado del chat: agregar contacto y menu de tres puntos. */
export function AccionesDelChat({
  conversationId,
  contactId,
  nombre,
  telefono,
}: {
  conversationId: string;
  contactId: string;
  nombre: string | null;
  telefono: string;
}) {
  const router = useRouter();
  const { abierto: menuAbierto, setAbierto: setMenuAbierto, ref: menuRef } = useMenu();
  const [dialogo, setDialogo] = useState<"nuevo" | "conversacion" | "editar" | "eliminar" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function noLeido() {
    setMenuAbierto(false);
    startTransition(async () => {
      const r = await marcarChatNoLeido(conversationId, true);
      if ("error" in r) return setError(r.error ?? "No se pudo marcar.");
      // Si se queda en el chat, abrirlo lo volveria a dejar leido.
      router.push("/dashboard/inbox");
    });
  }

  const elegir = (d: typeof dialogo) => {
    setMenuAbierto(false);
    setDialogo(d);
  };

  return (
    <div className="flex shrink-0 items-center gap-1.5">
      <button
        type="button"
        onClick={() => setDialogo("nuevo")}
        title="Agregar contacto"
        aria-label="Agregar contacto"
        className="flex h-9 w-9 items-center justify-center rounded-lg border border-border text-muted hover:bg-surface-hover hover:text-foreground"
      >
        <UserPlus size={16} />
      </button>
      <div className="relative" ref={menuRef}>
        <button
          type="button"
          onClick={() => setMenuAbierto((v) => !v)}
          title="Más acciones"
          aria-label="Más acciones"
          aria-expanded={menuAbierto}
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-border text-muted hover:bg-surface-hover hover:text-foreground"
        >
          <MoreHorizontal size={16} />
        </button>
        {menuAbierto && (
          <div className={MENU} role="menu">
            <button type="button" role="menuitem" className={ITEM} onClick={() => elegir("conversacion")}>
              <MessageSquarePlus size={15} /> Nueva conversación
            </button>
            <button type="button" role="menuitem" className={ITEM} onClick={noLeido}>
              <Mail size={15} /> Marcar como no leído
            </button>
            <button type="button" role="menuitem" className={ITEM} onClick={() => elegir("editar")}>
              <Pencil size={15} /> Editar contacto
            </button>
            <button type="button" role="menuitem" className={ITEM_PELIGRO} onClick={() => elegir("eliminar")}>
              <Trash2 size={15} /> Eliminar contacto
            </button>
          </div>
        )}
      </div>
      {error && <span className="text-xs text-red-400">{error}</span>}
      {(dialogo === "nuevo" || dialogo === "conversacion") && (
        <ContactoDialog modo={dialogo} onClose={() => setDialogo(null)} />
      )}
      {dialogo === "editar" && (
        <ContactoDialog
          modo="editar"
          contactId={contactId}
          inicial={{ nombre: nombre ?? "", telefono }}
          onClose={() => setDialogo(null)}
        />
      )}
      {dialogo === "eliminar" && (
        <EliminarContactoDialog
          contactId={contactId}
          nombre={nombre || telefono}
          onClose={() => setDialogo(null)}
          onEliminado={() => {
            setDialogo(null);
            router.push("/dashboard/inbox");
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

/** Tres puntos de cada fila de la lista: no leido, fijar y eliminar. */
export function MenuDeFila({
  conversationId,
  contactId,
  nombre,
  noLeido,
  fijado,
  onError,
}: {
  conversationId: string;
  contactId: string;
  nombre: string;
  noLeido: boolean;
  fijado: boolean;
  onError: (mensaje: string) => void;
}) {
  const router = useRouter();
  const { abierto: menuAbierto, setAbierto: setMenuAbierto, ref: menuRef } = useMenu();
  const [eliminando, setEliminando] = useState(false);
  const [, startTransition] = useTransition();

  // La fila entera es un enlace: sin esto, cada clic abriria el chat.
  const detener = (e: React.SyntheticEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  function accion(fn: () => Promise<{ error?: string } | { success: true }>) {
    setMenuAbierto(false);
    startTransition(async () => {
      const r = await fn();
      if (r && "error" in r && r.error) onError(r.error);
      router.refresh();
    });
  }

  return (
    <div className="relative" ref={menuRef} onClick={detener}>
      <button
        type="button"
        onClick={(e) => {
          detener(e);
          setMenuAbierto((v) => !v);
        }}
        title="Más acciones"
        aria-label="Más acciones"
        aria-expanded={menuAbierto}
        // Siempre visible y con area de toque de 32px: en el celular no hay
        // "pasar el cursor" que lo revele.
        className="-my-1 flex h-8 w-7 items-center justify-center rounded-lg text-muted hover:bg-surface-hover hover:text-foreground"
      >
        <MoreVertical size={16} />
      </button>
      {menuAbierto && (
        <div className={MENU} role="menu">
          <button
            type="button"
            role="menuitem"
            className={ITEM}
            onClick={(e) => {
              detener(e);
              accion(() => marcarChatNoLeido(conversationId, !noLeido));
            }}
          >
            {noLeido ? <MailOpen size={15} /> : <Mail size={15} />}
            {noLeido ? "Marcar como leído" : "Marcar como no leído"}
          </button>
          <button
            type="button"
            role="menuitem"
            className={ITEM}
            onClick={(e) => {
              detener(e);
              accion(() => setConversationPinned(conversationId, !fijado));
            }}
          >
            {fijado ? <PinOff size={15} /> : <Pin size={15} />}
            {fijado ? "Quitar de fijados" : "Fijar arriba"}
          </button>
          <button
            type="button"
            role="menuitem"
            className={ITEM_PELIGRO}
            onClick={(e) => {
              detener(e);
              setMenuAbierto(false);
              setEliminando(true);
            }}
          >
            <Trash2 size={15} /> Eliminar contacto
          </button>
        </div>
      )}
      {eliminando && (
        <EliminarContactoDialog
          contactId={contactId}
          nombre={nombre}
          onClose={() => setEliminando(false)}
          onEliminado={() => {
            setEliminando(false);
            router.push("/dashboard/inbox");
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

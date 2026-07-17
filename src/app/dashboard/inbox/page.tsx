import { MessageSquare } from "lucide-react";

export default function InboxIndexPage() {
  return (
    <div className="flex h-full flex-col items-center justify-center text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-surface-hover text-muted">
        <MessageSquare size={22} />
      </div>
      <h2 className="text-lg font-semibold text-foreground">
        Selecciona una conversación
      </h2>
      <p className="mt-1 max-w-md text-sm text-muted">
        Elige un contacto de la lista para ver el historial de mensajes.
      </p>
    </div>
  );
}

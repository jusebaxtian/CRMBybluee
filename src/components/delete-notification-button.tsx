"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { deleteNotification } from "@/app/actions/notifications";

export function DeleteNotificationButton({ notificationId }: { notificationId: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);

  async function handleConfirm() {
    setPending(true);
    await deleteNotification(notificationId);
    setPending(false);
    setConfirming(false);
    router.refresh();
  }

  if (confirming) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted">¿Eliminar?</span>
        <button
          type="button"
          onClick={handleConfirm}
          disabled={pending}
          className="rounded-md bg-red-500 px-2 py-0.5 text-xs font-medium text-white hover:bg-red-600 disabled:opacity-50"
        >
          {pending ? "..." : "Sí"}
        </button>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          disabled={pending}
          className="text-xs text-muted hover:text-foreground"
        >
          No
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setConfirming(true)}
      className="text-muted hover:text-red-400"
      title="Eliminar notificación"
    >
      <Trash2 size={14} />
    </button>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateDashboardBanner } from "@/app/actions/admin";

export function DashboardBannerUploader({ currentUrl }: { currentUrl: string | null }) {
  const router = useRouter();
  const [preview, setPreview] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(formData: FormData) {
    setPending(true);
    setError(null);
    const result = await updateDashboardBanner(formData);
    setPending(false);
    if (result?.error) {
      setError(result.error);
      return;
    }
    setPreview(null);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex h-40 w-40 items-center justify-center overflow-hidden rounded-xl border border-border bg-background">
        {preview || currentUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={preview ?? currentUrl ?? ""}
            alt="Banner del dashboard"
            className="h-full w-full object-cover"
          />
        ) : (
          <p className="px-3 text-center text-xs text-muted">Sin imagen cargada</p>
        )}
      </div>

      <form action={handleSubmit} className="flex items-center gap-2">
        <input
          type="file"
          name="banner"
          accept="image/*"
          required
          onChange={(e) => {
            const file = e.target.files?.[0];
            setPreview(file ? URL.createObjectURL(file) : null);
          }}
          className="text-sm text-foreground file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-2 file:text-xs file:font-medium file:text-white hover:file:bg-primary-hover"
        />
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-primary px-3 py-2 text-xs font-medium text-white hover:bg-primary-hover disabled:opacity-50"
        >
          {pending ? "Subiendo..." : "Guardar"}
        </button>
      </form>
      {error && <p className="text-xs text-red-400">{error}</p>}
      <p className="text-xs text-muted">
        Se recomienda una imagen cuadrada (1:1). Se muestra en el dashboard de todos los clientes.
      </p>
    </div>
  );
}

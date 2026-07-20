"use client";

import { useActionState } from "react";
import Link from "next/link";
import { signup, type AuthFormState } from "@/app/actions/auth";

export default function SignupPage() {
  const [state, action, pending] = useActionState<AuthFormState, FormData>(
    signup,
    undefined
  );

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-sm rounded-xl border border-border bg-surface p-8 shadow-sm">
        <div className="mb-6 flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="ByBluee" className="h-8 w-8 rounded-lg" />
          <span className="text-lg font-semibold text-foreground">ByBluee</span>
        </div>
        <h1 className="mb-1 text-2xl font-semibold text-foreground">
          Crea tu cuenta
        </h1>
        <p className="mb-6 text-sm text-muted">
          7 días de prueba gratis, sin tarjeta.
        </p>
        <form action={action} className="flex flex-col gap-4">
          <div>
            <label htmlFor="companyName" className="mb-1 block text-sm font-medium text-muted">
              Nombre de tu empresa
            </label>
            <input
              id="companyName"
              name="companyName"
              type="text"
              required
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
            />
          </div>
          <div>
            <label htmlFor="email" className="mb-1 block text-sm font-medium text-muted">
              Correo
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
            />
          </div>
          <div>
            <label htmlFor="password" className="mb-1 block text-sm font-medium text-muted">
              Contraseña
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              minLength={8}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
            />
          </div>
          {state?.error && (
            <p className="text-sm text-red-400">{state.error}</p>
          )}
          <button
            type="submit"
            disabled={pending}
            className="mt-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-hover disabled:opacity-50"
          >
            {pending ? "Creando cuenta..." : "Empezar prueba gratis"}
          </button>
        </form>
        <p className="mt-4 text-center text-sm text-muted">
          ¿Ya tienes cuenta?{" "}
          <Link href="/login" className="font-medium text-primary hover:underline">
            Inicia sesión
          </Link>
        </p>
      </div>
    </div>
  );
}

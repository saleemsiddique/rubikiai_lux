// app/admin/AdminLoginClient.tsx
"use client";

import React, { useEffect, useState } from "react";
import { clientAuth } from "@/lib/firebase-auth";
import { signInWithEmailAndPassword } from "firebase/auth";
import { useRouter, useSearchParams } from "next/navigation";

async function readErrorResponse(res: Response) {
  const text = await res.text();
  try {
    const json = JSON.parse(text);
    if (json?.error) return json.error;
    return JSON.stringify(json);
  } catch {
    return text || `${res.status} ${res.statusText}`;
  }
}

function friendly(r?: string | null) {
  if (r === "login") return "Inicia sesión para continuar.";
  if (r === "forbidden") return "Acceso denegado. Tu usuario no es administrador.";
  if (r === "expired") return "Sesión expirada. Vuelve a iniciar sesión.";
  return null;
}

export default function AdminLoginClient() {
  const router = useRouter();
  const search = useSearchParams();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Mover la lógica del reason a useEffect para evitar hidratación
  useEffect(() => {
    const reason = search?.get("reason");
    if (reason) {
      setErr(friendly(reason));
    }
  }, [search]);

  useEffect(() => {
    let abort = false;
    const check = async () => {
      try {
        const res = await fetch("/api/auth/session-check", { 
          method: "GET", 
          credentials: "same-origin" 
        });
        if (!res.ok) return;
        const data = await res.json().catch(() => ({}));
        if (!abort && data?.isAuthenticated && data?.isAdmin) {
          router.replace("/admin/menu");
        }
      } catch {
        /* noop */
      }
    };
    check();
    return () => {
      abort = true;
    };
  }, [router]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    try {
      const cred = await signInWithEmailAndPassword(clientAuth, email, password);
      const idToken = await cred.user.getIdToken(true);

      const resp = await fetch("/api/auth/session-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken, remember }),
      });

      if (!resp.ok) {
        const detail = await readErrorResponse(resp);
        setErr(`Login failed (${resp.status}): ${detail}`);
        return;
      }

      router.replace("/admin/menu");
    } catch (e: any) {
      setErr(e?.message ?? "Error de acceso");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <h1 className="text-2xl font-bold text-[var(--color-primary-dark)]">Admin Login</h1>
      <p className="mt-2 text-sm text-neutral-600">Acceso restringido a administradores.</p>

      <form onSubmit={onSubmit} className="mt-6 space-y-4 bg-white rounded-2xl border p-6 shadow-sm">
        <div>
          <label className="text-sm text-neutral-700">Email</label>
          <input
            type="email"
            className="mt-1 w-full rounded-md border px-3 py-2"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
        </div>
        <div>
          <label className="text-sm text-neutral-700">Password</label>
          <input
            type="password"
            className="mt-1 w-full rounded-md border px-3 py-2"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
          />
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
          Recordarme (14 días)
        </label>

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-md bg-[var(--color-primary)] py-2 text-white font-semibold disabled:opacity-60"
        >
          {loading ? "Accediendo…" : "Entrar"}
        </button>

        {err && <div className="text-sm text-red-600">{err}</div>}
      </form>
    </>
  );
}
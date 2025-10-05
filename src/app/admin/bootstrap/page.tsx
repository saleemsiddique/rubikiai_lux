// app/admin/bootstrap/page.tsx
"use client";

import React, { useState } from "react";

export default function AdminBootstrapPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    setLoading(true);
    try {
      const res = await fetch("/api/admin/bootstrap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, token }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || data || "Error");
      setMsg("Admin creado correctamente. Ya puedes iniciar sesión en /admin.");
    } catch (err: any) {
      setMsg(err?.message ?? "Error creando admin");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen pt-24 bg-[var(--color-background-main)]">
      <section className="max-w-md mx-auto px-6 py-16">
        <h1 className="text-2xl font-bold text-[var(--color-primary-dark)]">Bootstrap Admin</h1>
        <p className="mt-2 text-sm text-neutral-600">Solo para crear el primer usuario administrador (requiere token).</p>

        <form onSubmit={onSubmit} className="mt-6 space-y-4 bg-white rounded-2xl border p-6 shadow-sm">
          <div>
            <label className="text-sm text-neutral-700">Email</label>
            <input type="email" className="mt-1 w-full rounded-md border px-3 py-2" value={email}
              onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
          </div>
          <div>
            <label className="text-sm text-neutral-700">Password (min. 8)</label>
            <input type="password" className="mt-1 w-full rounded-md border px-3 py-2" value={password}
              onChange={(e) => setPassword(e.target.value)} required minLength={8} autoComplete="new-password" />
          </div>
          <div>
            <label className="text-sm text-neutral-700">Bootstrap Token</label>
            <input type="password" className="mt-1 w-full rounded-md border px-3 py-2" value={token}
              onChange={(e) => setToken(e.target.value)} required />
          </div>
          <button type="submit" disabled={loading}
            className="w-full rounded-md bg-[var(--color-primary)] py-2 text-white font-semibold disabled:opacity-60">
            {loading ? "Creando…" : "Crear admin"}
          </button>
          {msg && <div className="text-sm mt-2">{msg}</div>}
        </form>
      </section>
    </main>
  );
}

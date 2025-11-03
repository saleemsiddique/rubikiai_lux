// app/house-rules/HouseRulesClient.tsx
"use client";

import React, { useState } from "react";

type Tab = "ezero" | "dupleksas";

interface Props {
  ezeroText: string;
  dupleksText: string;
}

export default function HouseRulesClient({ ezeroText, dupleksText }: Props) {
  const [tab, setTab] = useState<Tab>("ezero");

  const renderParagraphs = (text: string) =>
    text.split("\n\n").map((p, i) => (
      <p key={i} className="mb-4 leading-relaxed whitespace-pre-wrap">
        {p}
      </p>
    ));

  return (
    <div className="bg-white shadow-sm rounded-2xl p-6">
      <div role="tablist" aria-label="House rules tabs" className="mb-6 flex gap-3">
        <button
          role="tab"
          aria-pressed={tab === "ezero"}
          onClick={() => setTab("ezero")}
          className={`px-4 py-2 rounded-2xl font-medium focus:outline-none ${
            tab === "ezero" ? "bg-[var(--color-primary-dark)] text-white shadow" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
          }`}
        >
          Ežero Namelis
        </button>

        <button
          role="tab"
          aria-pressed={tab === "dupleksas"}
          onClick={() => setTab("dupleksas")}
          className={`px-4 py-2 rounded-2xl font-medium focus:outline-none ${
            tab === "dupleksas" ? "bg-[var(--color-primary-dark)] text-white shadow" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
          }`}
        >
          Dupleksas
        </button>
      </div>

      <article className="prose max-w-none">
        {tab === "ezero" ? (
          <>
            <h2 className="text-xl font-semibold mb-4">Ežero Namelis — Taisyklės</h2>
            <div>{renderParagraphs(ezeroText)}</div>
          </>
        ) : (
          <>
            <h2 className="text-xl font-semibold mb-4">Dupleksas — Taisyklės</h2>
            <div>{renderParagraphs(dupleksText)}</div>
          </>
        )}
      </article>
    </div>
  );
}

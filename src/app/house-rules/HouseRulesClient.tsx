// app/house-rules/HouseRulesClient.tsx
"use client";

import React, { useState } from "react";

type Tab = "ezero" | "dupleksas";

interface Props {
  introText: string;
  ezeroText: string;
  dupleksText: string;
}

export default function HouseRulesClient({ introText, ezeroText, dupleksText }: Props) {
  const [tab, setTab] = useState<Tab>("ezero");

  const renderRules = (text: string) => {
    const sections = text.split("---JACUZZI---");
    const generalRules = sections[0].trim().split("\n\n");
    const jacuzziRules = sections[1]?.trim().split("\n\n") || [];

    return (
      <div className="space-y-12">
        {/* Reglas Generales */}
        <div>
          <div className="mb-8 pb-4 border-b-2 border-[var(--color-primary)]">
            <h3 className="text-2xl  text-[var(--color-primary-dark)]">
              Bendrosios Taisyklės
            </h3>
            <p className="text-sm text-neutral-500 mt-1">General House Rules</p>
          </div>
          
          <div className="space-y-6">
            {generalRules.map((rule, i) => (
              <div key={i} className="flex gap-5 items-start group">
                <div className="flex-shrink-0 w-10 h-10 flex items-center justify-center">
                  <span className="text-lg font-bold text-[var(--color-primary)]">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                </div>
                <p className="text-neutral-700 leading-relaxed pt-1.5 text-[15px]">{rule}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Reglas Jacuzzi */}
        {jacuzziRules.length > 0 && (
          <div>
            <div className="mb-8 pb-4 border-b-2 border-[var(--color-secondary)]">
              <h3 className="text-2xl  text-[var(--color-primary-dark)]">
                Jacuzzi Taisyklės
              </h3>
              <p className="text-sm text-neutral-500 mt-1">Jacuzzi Usage Rules</p>
            </div>
            
            <div className="space-y-6">
              {jacuzziRules.map((rule, i) => (
                <div key={i} className="flex gap-5 items-start group">
                  <div className="flex-shrink-0 w-10 h-10 flex items-center justify-center">
                    <span className="text-lg font-bold text-[var(--color-secondary)]">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                  </div>
                  <p className="text-neutral-700 leading-relaxed pt-1.5 text-[15px]">{rule}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="bg-white shadow-2xl rounded-2xl overflow-hidden">
      {/* Tabs */}
      <div className="bg-[var(--color-primary-dark)] px-8 py-6">
        <div role="tablist" aria-label="House rules tabs" className="flex gap-4 justify-center flex-wrap">
          <button
            role="tab"
            aria-selected={tab === "ezero"}
            onClick={() => setTab("ezero")}
            className={`px-10 py-3 font-sans text-sm tracking-wide uppercase transition-all duration-300 ${
              tab === "ezero"
                ? "bg-white text-[var(--color-primary-dark)] font-bold shadow-lg"
                : "bg-transparent text-white/80 font-semibold hover:text-white border-b-2 border-transparent hover:border-white/50"
            }`}
          >
            Ežero Namelis
          </button>

          <button
            role="tab"
            aria-selected={tab === "dupleksas"}
            onClick={() => setTab("dupleksas")}
            className={`px-10 py-3 font-sans text-sm tracking-wide uppercase transition-all duration-300 ${
              tab === "dupleksas"
                ? "bg-white text-[var(--color-primary-dark)] font-bold shadow-lg"
                : "bg-transparent text-white/80 font-semibold hover:text-white border-b-2 border-transparent hover:border-white/50"
            }`}
          >
            Dupleksas
          </button>
        </div>
      </div>

      {/* Intro Text */}
      <div className="px-8 md:px-12 pt-10">
        <div className="border border-[var(--color-primary)]/30 bg-[var(--color-background-main)] rounded-xl p-8">
          <h3 className="text-lg  font-bold text-[var(--color-primary-dark)] mb-4 tracking-wide">
            Svarbi Informacija
          </h3>
          <p className="text-neutral-700 leading-relaxed text-[15px]">
            {introText}
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="px-8 md:px-12 py-12">
        {tab === "ezero" ? renderRules(ezeroText) : renderRules(dupleksText)}
        
        {/* Nota final */}
        <div className="mt-12 border-2 border-red-200 bg-red-50/50 rounded-xl p-8">
          <h3 className="text-lg  font-bold text-red-800 mb-4 tracking-wide">
            Įspėjimas
          </h3>
          <p className="text-red-800/90 leading-relaxed text-[15px]">
            Rubikiai LUX darbuotojai turi teisę iškeldinti iš apartamentų anksčiau nustatyto termino asmenis (be pinigų grąžinimo), kurie nesilaiko ir šiurkščiai pažeidžia vidaus tvarkos ir elgesio taisykles, taip pat reikalauti atlyginti padarytą žalą ir nuostolius pagal LR įstatymus.
          </p>
        </div>
      </div>
    </div>
  );
}
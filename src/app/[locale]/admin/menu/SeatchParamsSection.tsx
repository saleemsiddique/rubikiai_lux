"use client";

import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";

export default function SearchParamsSection() {
  const params = useSearchParams();
  const reason = params.get("reason");
  const t = useTranslations("admin");

  if (!reason) return null;

  // Opcional: puedes mapear reason a traducciones si quieres
  const messages: Record<string, string> = {
    login: t("common.loginRequired") || "Login required",
    forbidden: t("common.forbidden") || "Access forbidden",
    expired: t("common.sessionExpired") || "Session expired",
  };

  return (
    <div className="mb-4 text-xs text-neutral-700 bg-white border px-3 py-2 rounded-md shadow-sm">
      {messages[reason] ?? `Query param → ${reason}`}
    </div>
  );
}

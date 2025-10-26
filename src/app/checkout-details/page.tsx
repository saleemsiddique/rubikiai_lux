import { Suspense } from "react";
import CheckoutDetailsClient from "./CheckoutDetailsClient";

export default function CheckoutDetailsPage() {
  return (
    <Suspense fallback={<div className="mt-12 p-8 text-center text-sm text-gray-500">Cargando…</div>}>
      <CheckoutDetailsClient />
    </Suspense>
  );
}

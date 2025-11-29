// File: app/coupons/success/page.tsx
import React, { Suspense } from "react";
import SuccessClient from "./SuccessClient";


export const metadata = {
    title: "Coupon purchase",
};


export default function SuccessPage() {
    return (
        <main className="min-h-screen mt-16 sm:mt-0 flex items-center justify-center" style={{ background: "var(--color-background-main)" }}>
            <div className="max-w-3xl w-full mx-4 p-10 rounded-2xl shadow-lg" style={{ background: "white", borderRadius: 18 }}>
                <Suspense
                    fallback={
                        <div className="flex flex-col items-center text-center gap-6 p-8">
                            <div>Checking order status…</div>
                        </div>
                    }
                >
                    <SuccessClient />
                </Suspense>
            </div>
        </main>
    );
}
'use client';

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

export default function Page() {
    const router = useRouter();
    const searchParams = useSearchParams();

    const orderId = searchParams.get("orderId") ?? undefined;
    const sessionId = searchParams.get("session_id") ?? undefined; // optional, for debugging/links if needed

    const [loading, setLoading] = useState(true);
    const [orderStatus, setOrderStatus] = useState<string | null>(null);

    useEffect(() => {
        (async () => {
            if (!orderId) {
                router.replace(`/coupons/cancel?reason=missing_order`);
                return;
            }
            try {
                const res = await fetch(`/api/coupon-order-status?orderId=${encodeURIComponent(orderId)}`);
                if (!res.ok) {
                    router.replace(`/coupons/cancel?orderId=${orderId}&reason=not_found`);
                    return;
                }
                const json = await res.json();
                const order = json.order as { status: 'pending' | 'completed' | 'expired' | 'error'; expiresAtIso?: string };

                setOrderStatus(order.status);

                if (order.status === 'expired') {
                    router.replace(`/coupons/cancel?orderId=${orderId}&reason=expired`);
                    return;
                }
                if (order.status === 'error') {
                    router.replace(`/coupons/cancel?orderId=${orderId}&reason=error`);
                    return;
                }

                setLoading(false);
            } catch (err) {
                console.error("Error checking order status:", err);
                router.replace(`/coupons/cancel?orderId=${orderId}&reason=server_error`);
            }
        })();
        // depend on orderId only
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [orderId]);

    if (loading) {
        return (
            <main className="min-h-screen flex items-center justify-center" style={{ background: "var(--color-background-main)" }}>
                <div className="max-w-3xl w-full mx-4 p-10 rounded-2xl shadow-lg" style={{ background: "white", borderRadius: 18 }}>
                    <div className="flex flex-col items-center text-center gap-6">
                        <div>Checking order status…</div>
                    </div>
                </div>
            </main>
        );
    }

    const idToShow = orderId ?? "";

    return (
        <main className="min-h-screen flex items-center justify-center" style={{ background: "var(--color-background-main)" }}>
            <div className="max-w-3xl w-full mx-4 p-10 rounded-2xl shadow-lg" style={{ background: "white", borderRadius: 18 }}>
                <div className="flex flex-col items-center text-center gap-6">
                    <div
                        className="w-28 h-28 rounded-full flex items-center justify-center"
                        style={{ background: "linear-gradient(180deg, var(--color-primary)/12, transparent)" }}
                    >
                        <svg width="56" height="56" viewBox="0 0 24 24" fill="none" aria-hidden>
                            <circle cx="12" cy="12" r="11" stroke="var(--color-primary)" strokeWidth="1.5" fill="none" />
                            <path d="M7 13l3 3 7-8" stroke="var(--color-primary-dark)" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                    </div>

                    <h1 className="text-3xl md:text-4xl font-extrabold" style={{ color: "var(--color-text)" }}>
                        {orderStatus === 'completed' ? 'Purchase confirmed!' : 'Purchase in progress'}
                    </h1>

                    <p className="max-w-xl text-sm md:text-base" style={{ color: "var(--color-text)" }}>
                        {orderStatus === 'completed'
                            ? `Thanks for your purchase at Rubikiai. We have received your payment and your coupon(s) are ready.`
                            : `Your payment is being processed. You will receive an email as soon as your coupon(s) are ready.`}
                        {idToShow ? ' — Order ID: ' : ''}
                        <span className="font-mono ml-1" style={{ color: "var(--color-highlight)" }}>{idToShow}</span>
                    </p>

                    <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
                        <Link href={`/coupons?orderId=${encodeURIComponent(idToShow)}`} className="block">
                            <button
                                className="w-full py-3 rounded-lg font-semibold"
                                style={{
                                    background: "var(--color-primary)",
                                    color: "white",
                                    boxShadow: "0 6px 18px rgba(143,110,82,0.12)",
                                }}
                            >
                                View my coupons
                            </button>
                        </Link>

                        <Link href="/" className="block">
                            <button
                                className="w-full py-3 rounded-lg border font-semibold"
                                style={{ borderColor: "var(--color-primary)", color: "var(--color-primary-dark)", background: "transparent" }}
                            >
                                Back to home
                            </button>
                        </Link>
                    </div>

                    <div className="text-xs text-gray-500 mt-3">
                        <p style={{ color: 'var(--color-text)' }}>
                            Need help?{" "}
                            <Link
                                href="/contact"
                                className="inline-block"
                                style={{ color: 'var(--color-primary-dark)', fontWeight: 600 }}
                            >
                                Contact us
                            </Link>
                        </p>
                    </div>


                    <div className="mt-4 w-full text-center text-xs text-gray-400">
                        <p>You will receive an email with your coupon codes. Please keep your Order ID for any support request.</p>
                    </div>
                </div>
            </div>
        </main>
    );
}
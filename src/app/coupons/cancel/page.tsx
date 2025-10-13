'use client';

import React from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

export default function CancelPage() {
    const searchParams = useSearchParams();
    const orderId = searchParams.get('orderId') ?? undefined;
    const reason = (searchParams.get('reason') ?? 'cancelled').toLowerCase();

    const { title, message } = getCopy(reason, orderId);

    return (
        <main className="min-h-screen flex items-center justify-center" style={{ background: 'var(--color-background-main)' }}>
            <div className="max-w-3xl w-full mx-4 p-10 rounded-2xl shadow-lg" style={{ background: 'white', borderRadius: 18 }}>
                <div className="flex flex-col items-center text-center gap-6">
                    <div
                        className="w-28 h-28 rounded-full flex items-center justify-center"
                        style={{ background: 'linear-gradient(180deg, var(--color-primary)/12, transparent)' }}
                    >
                        <svg width="56" height="56" viewBox="0 0 24 24" fill="none" aria-hidden>
                            <circle cx="12" cy="12" r="11" stroke="var(--color-primary)" strokeWidth="1.5" fill="none" />
                            <path d="M8 8l8 8M16 8l-8 8" stroke="var(--color-primary-dark)" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                    </div>

                    <h1 className="text-3xl md:text-4xl font-extrabold" style={{ color: 'var(--color-text)' }}>
                        {title}
                    </h1>

                    <p className="max-w-xl text-sm md:text-base" style={{ color: 'var(--color-text)' }}>
                        {message}
                        {orderId ? ' — Order ID: ' : ''}
                        {orderId && (
                            <span className="font-mono ml-1" style={{ color: 'var(--color-highlight)' }}>{orderId}</span>
                        )}
                    </p>

                    <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
                        <Link href="/coupons" className="block">
                            <button
                                className="w-full py-3 rounded-lg font-semibold"
                                style={{
                                    background: 'var(--color-primary)',
                                    color: 'white',
                                    boxShadow: '0 6px 18px rgba(143,110,82,0.12)',
                                }}
                            >
                                Try again
                            </button>
                        </Link>

                        <Link href="/" className="block">
                            <button
                                className="w-full py-3 rounded-lg border font-semibold"
                                style={{ borderColor: 'var(--color-primary)', color: 'var(--color-primary-dark)', background: 'transparent' }}
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
                        <p>If a charge was created, it will not be captured. If you have questions about a pending authorization on your card, please contact support.</p>
                    </div>
                </div>
            </div>
        </main>
    );
}

function getCopy(reason: string) {
    switch (reason) {
        case 'missing_order':
            return {
                title: 'Order not found',
                message: 'We could not locate your order information.'
            };
        case 'not_found':
            return {
                title: 'Order not found',
                message: 'The order you tried to access does not exist or has been removed.'
            };
        case 'expired':
            return {
                title: 'Checkout session expired',
                message: 'Your payment session expired before completion. No charge was made.'
            };
        case 'no_payment_intent':
            return {
                title: 'Payment could not be verified',
                message: 'We were unable to verify the payment with Stripe. No charge was made.'
            };
        case 'pi_status':
            return {
                title: 'Payment not completed',
                message: 'Your payment did not reach a completed state. Please try again.'
            };
        case 'error':
            return {
                title: 'There was a problem',
                message: 'Something went wrong while processing your purchase.'
            };
        case 'server_error':
            return {
                title: 'Server error',
                message: 'Unexpected error while finalizing your purchase. Please try again.'
            };
        case 'cancelled':
        default:
            return {
                title: 'Payment canceled',
                message: 'You have canceled the payment. No charge was made.'
            };
    }
}
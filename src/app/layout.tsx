// app/layout.tsx
import React from "react";
import type { Metadata } from "next";
import "./globals.css";
import Header from "../components/Header";
import Footer from "../components/Footer";
import { HouseProvider } from "@/context/HouseContext"; // <-- wrap app with provider

export const metadata: Metadata = {
  title: "Rubikiai Lux - Alojamientos vacacionales",
  description: "Escapadas con estética de cine. Alojamientos exclusivos en entornos naturales.",
  icons: {
    icon: "/Logotipas.PNG",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="min-h-screen flex flex-col">
        <HouseProvider>
          <Header />
          <main className="flex-1 pt-6">{children}</main>
          <Footer />
        </HouseProvider>
      </body>
    </html>
  );
}

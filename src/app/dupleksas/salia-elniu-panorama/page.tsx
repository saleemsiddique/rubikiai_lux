// server component - validates guests and redirects if overflow
import React from "react";
import { redirect } from "next/navigation";
import HousePage from "@/components/HousePage";

const panoramaImages = [
  "/dupleksas/dupleksas2.png",
  "/dupleksas/2-dupleksas-n1.jpeg",
  "/dupleksas/2-dupleksas-n2.jpeg",
  "/dupleksas/2-dupleksas-n3.jpeg",
  "/dupleksas/dupleksas-n4.JPG",
  "/dupleksas/dupleksas-n5.JPG",
  "/dupleksas/dupleksas-n6.jpeg",
  "/dupleksas/dupleksas-n7.jpeg",
  "/dupleksas/dupleksas-n8.jpeg",
  "/dupleksas/dupleksas-n9.jpeg",
  "/dupleksas/dupleksas-n10.jpeg",
  "/dupleksas/dupleksas-n11.jpeg",
];

const ACCOMMODATES = 4;
const DEFAULT_GUESTS = "4";

export default function Page({
  searchParams,
}: {
  searchParams?: { [key: string]: string | string[] | undefined };
}) {
  // obtiene el valor guests (si viene como array toma el primero)
  const guestsRaw = Array.isArray(searchParams?.guests)
    ? searchParams!.guests[0]
    : searchParams?.guests ?? DEFAULT_GUESTS;

  const guests = parseInt(String(guestsRaw), 10);

  // si guests es número válido y excede accommodates -> redirige en server
  if (!Number.isNaN(guests) && Number.isFinite(guests) && guests > ACCOMMODATES) {
    // redirige al error page (asegúrate de tener app/error-page/page.tsx o similar)
    redirect("/error-page");
  }

  return (
    <HousePage
      heroSrc="/dupleksas/dupleksas2.png"
      title="N°2 - Elnių Panorama"
      subtitle="Experience magical moments by the Rubikiai lake."
      accommodates={ACCOMMODATES}
      size="40 sq m"
      beds="2 Singles, 1 Double"
      images={panoramaImages}
      houseSlug="salia-elniu-panorama"
      defaultGuests={DEFAULT_GUESTS}
      defaultType="dupleksas"
      amenitiesSections={[
        { title: "Amenities", items: ["A/C", "WiFi", "TV", "Shower", "Kitchen", "Towels", "Jacuzzi"] },
        { title: "Addons", items: ["Water bike rental", "Boat rental", "Canoe rental"] },
        { title: "Special features", items: ["Romantic fireplace for cozy evenings."] },
      ]}
    />
  );
}

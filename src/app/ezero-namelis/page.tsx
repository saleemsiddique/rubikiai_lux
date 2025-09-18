// app/dupleksas/salia-elniu-panorama/page.tsx
// server component - valida guests en server y redirige si hay overflow
import React from "react";
import { redirect } from "next/navigation";
import HousePage from "@/components/HousePage";

const panoramaImages = [
  "/duplex-2/img1.avif",
  "/duplex-2/img2.avif",
  "/duplex-2/img3.avif",
  "/duplex-2/img4.avif",
  "/duplex-2/img5.avif",
  "/duplex-2/img6.avif",
  "/duplex-2/img7.avif",
  "/duplex-2/img8.avif",
];

const ACCOMMODATES = 4;
const DEFAULT_GUESTS = "4";

export default function Page({
  searchParams,
}: {
  searchParams?: { [key: string]: string | string[] | undefined };
}) {
  // lee guests (si viene en array toma el primero)
  const guestsRaw = Array.isArray(searchParams?.guests)
    ? searchParams!.guests[0]
    : searchParams?.guests ?? DEFAULT_GUESTS;

  const guests = parseInt(String(guestsRaw), 10);

  // si es un número válido y supera accommodates -> redirige en server
  if (!Number.isNaN(guests) && Number.isFinite(guests) && guests > ACCOMMODATES) {
    redirect("/error-page");
  }

  return (
    <HousePage
      heroSrc="/dupleksas2.png"
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

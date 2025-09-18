// server component - validates guests and redirects if overflow
import React from "react";
import { redirect } from "next/navigation";
import HousePage from "@/components/HousePage";

const aptvaroImages = [
  "/duplex-1/img1.avif",
  "/duplex-1/img2.avif",
  "/duplex-1/img3.avif",
  "/duplex-1/img4.avif",
  "/duplex-1/img5.avif",
  "/duplex-1/img6.avif",
  "/duplex-1/img7.avif",
  "/duplex-1/img8.avif",
];

const ACCOMMODATES = 4;
const DEFAULT_GUESTS = "4";

export default function Page({
  searchParams,
}: {
  searchParams?: { [key: string]: string | string[] | undefined };
}) {
  const guestsRaw = Array.isArray(searchParams?.guests)
    ? searchParams!.guests[0]
    : searchParams?.guests ?? DEFAULT_GUESTS;

  const guests = parseInt(String(guestsRaw), 10);

  if (!Number.isNaN(guests) && Number.isFinite(guests) && guests > ACCOMMODATES) {
    redirect("/error-page");
  }

  return (
    <HousePage
      heroSrc="/dupleksas1.png"
      title="N°1 - Šalia Elnių Aptvaro"
      subtitle="Experience magical moments by the Rubikiai lake."
      accommodates={ACCOMMODATES}
      size="40 sq m"
      beds="2 Singles, 1 Double"
      images={aptvaroImages}
      houseSlug="salia-elniu-aptvaro"
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

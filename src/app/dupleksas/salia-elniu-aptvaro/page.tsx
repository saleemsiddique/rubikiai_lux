// ----------------------------
// Example page: app/dupleksas/salia-elniu-aptvaro/page.tsx
// ----------------------------

"use client";

import React from "react";
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

export default function ElniuAptvaroPage() {
  return (
    <HousePage
      heroSrc="/dupleksas1.png"
      title="N°1 - Šalia Elnių Aptvaro"
      subtitle="Experience magical moments by the Rubikiai lake."
      accommodates={4}
      size="40 sq m"
      beds="2 Singles, 1 Double"
      images={aptvaroImages}
      houseSlug="salia-elniu-aptvaro"
      defaultGuests="4"
      defaultType="dupleksas"
      amenitiesSections={[
        { title: "Amenities", items: ["A/C", "WiFi", "TV", "Shower", "Kitchen", "Towels", "Jacuzzi"] },
        { title: "Addons", items: ["Water bike rental", "Boat rental", "Canoe rental"] },
        { title: "Special features", items: ["Romantic fireplace for cozy evenings."] },
      ]}
    />
  );
}

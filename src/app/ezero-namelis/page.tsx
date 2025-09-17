// ----------------------------
// Example page: app/dupleksas/salia-elniu-panorama/page.tsx
// ----------------------------

"use client";

import React from "react";
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

export default function ElniuPanoramaPage() {
  return (
    <HousePage
      heroSrc="/dupleksas2.png"
      title="N°2 - Elnių Panorama"
      subtitle="Experience magical moments by the Rubikiai lake."
      accommodates={4}
      size="40 sq m"
      beds="2 Singles, 1 Double"
      images={panoramaImages}
      houseSlug="salia-elniu-panorama"
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
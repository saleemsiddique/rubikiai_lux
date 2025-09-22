// ----------------------------
// Example page: app/ezero-namelis/page.tsx
// ----------------------------


// app/ezero-namelis/page.tsx
"use client";


import React from "react";
import HousePage from "@/components/HousePage";


const images = [
  "/lake-house/img1.avif",
  "/lake-house/img2.avif",
  "/lake-house/img3.avif",
  "/lake-house/img4.avif",
  "/lake-house/img5.avif",
  "/lake-house/img6.avif",
  "/lake-house/img7.avif",
  "/lake-house/img8.avif",
];


export default function EzeroNamelisPage() {
  return (
    <HousePage
      heroSrc="/lake-house1.png"
      title="EŽERO NAMELIS"
      subtitle="A private and romantic cottage for two."
      accommodates={2}
      beds="1 Double"
      images={images}
      houseSlug="lake-house"
      defaultGuests="2"
      defaultType="ezero namelis"
      amenitiesSections={[
        {
          title: "Kitchen",
          items: ["Refrigerator", "Microwave", "Electric stove", "Oven", "Coffee machine", "Electric kettle", "Dishes and cutlery"],
        },
        {
          title: "Bathroom",
          items: ["Bathtub", "Shower", "Toilet", "Electric towel dryer", "Towels", "Hair dryer", "Shampoo, shower gel"],
        },
        {
          title: "Features",
          items: ["Wi-Fi", "TV", "Heat pump", "Air conditioning", "Heated floors", "Terrace", "Luxury jacuzzi"],
        },
      ]}
    />
  );
}
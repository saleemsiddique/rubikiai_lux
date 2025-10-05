// ----------------------------
// Example page: app/ezero-namelis/page.tsx
// ----------------------------


// app/ezero-namelis/page.tsx
"use client";


import React from "react";
import HousePage from "@/components/HousePage";


const images = [
  "/ezero-namelis/lake-house1.png",
  "/ezero-namelis/ezero-n1.jpeg",
  "/ezero-namelis/ezero-n2.jpeg",
  "/ezero-namelis/ezero-n3.jpeg",
  "/ezero-namelis/ezero-n4.jpeg",
  "/ezero-namelis/ezero-n5.jpeg",
  "/ezero-namelis/ezero-n6.jpeg",
  "/ezero-namelis/ezero-n7.jpeg",
  "/ezero-namelis/ezero-n8.jpeg",
  "/ezero-namelis/ezero-n9.jpeg",
  "/ezero-namelis/ezero-n10.jpeg",
  "/ezero-namelis/ezero-n11.JPG",
  "/ezero-namelis/ezero-n12.jpeg",
  "/ezero-namelis/ezero-n13.jpg",
  "/ezero-namelis/ezero-n14.jpeg",
  "/ezero-namelis/ezero-n15.jpeg",
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
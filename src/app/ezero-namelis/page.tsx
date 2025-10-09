// ----------------------------
// Example page: app/ezero-namelis/page.tsx
// ----------------------------


// app/ezero-namelis/page.tsx
"use client";


import React from "react";
import HousePage from "@/components/HousePage";


const images = [
  "/ezero-namelis/ezero-namelis.png",
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
      heroSrc="/ezero-namelis/ezero-namelis.png"
      title="EŽERO NAMELIS"
      subtitle="A private and romantic cottage for two."
      accommodates={2}
      beds="1 Double"
      images={images}
      houseSlug="lake-house"
      defaultGuests="2"
      defaultType="ezero namelis"
      description={
        <>
          <p>
            A private and romantic Lake Cabin for two—just 10 steps to the lake and forest. Classic–Retro style.
            A luxurious terrace jacuzzi with a view of Lake Rubikiai and unforgettable sunsets... Time stands still here...
          </p>
          <p>
            The cabin has everything you might need: a fully equipped kitchen, lounge area, bathroom, a bedroom with a large,
            comfortable double bed, Wi-Fi, TV, a Kamado Picnic grill on the terrace, towels, bed linen, robes, etc.
          </p>
          <p>
            Heated floors for your comfort, a heat pump for warm evenings, and air conditioning for the hot summer...
          </p>
          <p>
            In the warm season, you can also enjoy a large private beach nearby. We offer kayak, pedal boat, or rowboat rentals
            so you can circle and discover as many as 16 islands of Lake Rubikiai—or watch the most beautiful red sunsets.
          </p>

          <br />

          <p>
            <strong>
              The Duplex Apartments and Lake Cabin are intended for guests seeking a peaceful stay, therefore please note:
            </strong>
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Minors are accepted only from 16 years of age, unless agreed in advance when booking both duplex apartments.</li>
            <li>
              The number of people in the apartments, their outdoor areas, or the jacuzzi may not exceed the number indicated in
              the reservation at any given time.
            </li>
            <li>Only the number of guests specified at the time of booking may stay without extra charge.</li>
            <li>
              Arriving with pets is strictly prohibited. Upon arrival with pets, you will be asked to leave. The reservation
              deposit will not be refunded.
            </li>
            <li>
              Parties, events, and fireworks are not allowed. Please respect your own and other guests’ peace. Quiet hours are
              from 00:00 to 09:00.
            </li>
          </ul>

          <p>
            Rubikiai Lux staff have the right to evict from the apartments before the agreed end of stay (without any refund)
            those who do not follow and seriously violate the internal rules and code of conduct, as well as to seek compensation
            for any damages and losses caused.
          </p>
          <p>
            Guests bear full material responsibility for any movable or immovable property and valuables damaged or destroyed in
            the homestead and its territory (material damage is subject to liability under the laws of the Republic of Lithuania).
          </p>
          <p>
            Guests are responsible for any accidents that may occur within or outside the homestead territory (inside the house,
            on the terrace, in the forest, in the yard, in the hot tub, while swimming in the lake, using paddleboards, etc.).
          </p>

          <p><strong>Guests must:</strong></p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Pay any outstanding balance of the reservation upon arrival (if applicable).</li>
            <li>Maintain cleanliness and order in the apartments.</li>
            <li>Refrain from moving items or placing them in areas where they don’t belong.</li>
            <li>Not use blankets, towels, or other room items at the beach or for outdoor picnics.</li>
            <li>Not cut directly on tables or countertops—use cutting boards.</li>
            <li>Use baking paper or foil in the oven.</li>
            <li>
              <strong>SMOKING INDOORS IS PROHIBITED.</strong> If smoking outdoors, discard cigarette butts only in the designated
              bins on the terrace.
            </li>
            <li>Not leave electrical appliances on unattended. Please turn off all lights and shut off water before leaving the apartments.</li>
            <li>Parents or guardians must ensure children’s safety.</li>
            <li>
              Use the room’s stove only with the host’s permission and after receiving instructions; do not place items on the
              stove; do not burn household waste; keep a safe distance from the heated stove to avoid burns.
            </li>
          </ul>

          <p><strong>JACUZZI RULES:</strong></p>
          <ul className="list-disc pl-5 space-y-1">
            <li>If the jacuzzi service has not been paid for, use is prohibited!</li>
            <li>You can reserve the jacuzzi upon arrival.</li>
            <li>The jacuzzi is not intended for washing—please shower before use.</li>
            <li>
              Do not wear jewelry or accessories (rings, bracelets, chains, watches, etc.) due to the risk of loss and potential damage to the jacuzzi pumps.
            </li>
            <li>Do not climb on or place any items on the jacuzzi cover.</li>
            <li>Do not jump into or out of the jacuzzi.</li>
            <li>Do not open the jacuzzi cover using the grill/barbecue.</li>
            <li>
              Do not eat or drink in the hot tub and do not pour any liquids into it, including shampoos or soaps—this may damage
              the filtration system.
            </li>
            <li>Do not leave minors unattended in the hot tub.</li>
            <li>After each use, close the hot tub cover.</li>
          </ul>

          <p><strong>Check-in and Check-out</strong></p>
          <p>Duplex Apartments: check-in from 16:00, check-out by 11:00.</p>
          <p>Lake Cabin: check-in from 16:00, check-out by 12:00.</p>

          <p><strong>Reservation Changes</strong></p>
          <p>
            You may change your reservation date once free of charge no later than 7 days before arrival. The deposit is
            non-refundable. Multiple date changes are subject to a €20 fee.
          </p>
        </>
      }
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
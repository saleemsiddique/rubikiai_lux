// server component - validates guests and redirects if overflow
import React from "react";
import { redirect } from "next/navigation";
import dynamic from "next/dynamic";

const HousePageClient = dynamic(() => import("@/components/HousePage"), { ssr: false });

const panoramaImages = [
  "/dupleksas/2-dupleksas-n1.jpeg",
  "/dupleksas/2-dupleksas-n2.jpg",
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
    <HousePageClient
      heroSrc="/dupleksas/1-dupleksas-n1.jpeg"
      title="N°2 - Elnių Panorama"
      subtitle="Experience magical moments by the Rubikiai lake."
      accommodates={ACCOMMODATES}
      size="40 sq m"
      beds="2 Singles, 1 Double"
      images={panoramaImages}
      houseSlug="salia-elniu-panorama"
      defaultGuests={DEFAULT_GUESTS}
      defaultType="dupleksas"
      description={
        <>
          <p>
            Relax in luxurious duplex apartments surrounded by nature near Lake Rubikiai in the Anykščiai district.
          </p>
          <p>
            The bright, classic–Scandinavian-style duplex is located just 100 m from Lake Rubikiai.
          </p>
          <p>
            The duplex is unique in that it borders a 2-hectare fallow deer enclosure (separated only by a transparent fence).
            The duplex consists of two 40 m² apartments with separate entrances, separate terraces, and private SPA hot tubs
            (Jacuzzi).
          </p>
          <p>
            One duplex apartment accommodates up to 4 guests; booking the entire duplex (both apartments) accommodates up to 8
            guests. You’ll find everything you need for a comfortable stay: a fully equipped kitchen, lounge area, bathroom,
            bedroom (2 single beds and 1 double bed), Wi-Fi, TV, towels, bed linen, robes, etc.
          </p>
          <p>
            Heated floors for your comfort, a heat pump to keep evenings warm, a stove for romantic coziness, and air
            conditioning to cool hot summer days...
          </p>
          <p>
            In the warm season, you can also enjoy a large private beach nearby. We offer kayak, pedal boat, or rowboat rentals
            so you can circle and discover as many as 16 islands of Lake Rubikiai—or bid farewell to the most stunning crimson
            sunsets.
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
        { title: "Amenities", items: ["A/C", "WiFi", "TV", "Shower", "Kitchen", "Towels", "Jacuzzi"] },
        { title: "Addons", items: ["Water bike rental", "Boat rental", "Canoe rental"] },
        { title: "Special features", items: ["Romantic fireplace for cozy evenings."] },
      ]}
    />
  );
}

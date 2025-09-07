// app/dupleksas/elniu-aptvaro/page.tsx
"use client";

import React from 'react';
import Image from 'next/image';
import ImageGallery from '@/components/ImageGallery';
import Link from 'next/link'; // Importa el componente Link
import { FaBed, FaUserFriends, FaRulerCombined, FaCheck, FaTimes, FaMapMarkerAlt } from 'react-icons/fa';
import OtherOptions from '@/components/OtherOptions';

const images = [
    '/duplex-1/img1.avif',
    '/duplex-1/img2.avif',
    '/duplex-1/img3.avif',
    '/duplex-1/img4.avif',
    '/duplex-1/img5.avif',
    '/duplex-1/img6.avif',
    '/duplex-1/img7.avif',
    '/duplex-1/img8.avif',
];

const ElniuAptvaroPage: React.FC = () => {
    return (
        <main className="bg-gray-100 text-[var(--color-text)]">
            {/* Hero Section */}
            <div className="relative h-screen">
                <Image
                    src="/dupleksas1.png"
                    alt="Šalia Elnių Aptvaro Duplex"
                    layout="fill"
                    objectFit="cover"
                    className="absolute inset-0 z-0"
                />
                <div className="absolute inset-0 bg-black opacity-40 z-10"></div>
                <div className="relative z-20 flex flex-col items-start justify-end h-full p-8 text-white">
                    <h1 className="text-4xl md:text-6xl font-extrabold font-header">N°1 - Šalia Elnių Aptvaro</h1>
                    <p className="text-lg md:text-xl font-light font-sans mt-2">
                        Experience magical moments by the Rubikiai lake.
                    </p>
                    <div className="mt-6 flex flex-wrap gap-4 text-sm font-sans">
                        <span className="flex items-center"><FaUserFriends className="mr-2" /> Accommodates: 4</span>
                        <span className="flex items-center"><FaRulerCombined className="mr-2" /> Size: 40 sq m</span>
                        <span className="flex items-center"><FaBed className="mr-2" /> Beds: 2 Singles, 1 Double</span>
                    </div>
                </div>
            </div>

            {/* Information Section */}
            <section className="py-16 px-4">
                <div className="container mx-auto">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
                        <div className="lg:col-span-2">
                            <h2 className="text-3xl font-bold mb-4 font-header text-[var(--color-primary-dark)]">About this place</h2>
                            <p className="mb-4 font-sans leading-relaxed">
                                Relax by Rubikiai lake, surrounded by deer, fallow deer, and wild nature! This bright, classic-Scandinavian style duplex is located on a 7-hectare homestead, just 100m from the Rubikiai lake. The homestead is in a completely secluded location with a private access road.
                            </p>
                            <p className="mb-4 font-sans leading-relaxed">
                                The duplex is unique because it borders a 2-hectare deer and fallow deer territory (only a transparent fence separates you). The house consists of two 40m² apartments, with separate entrances, separate terraces, and private hot tubs (Jacuzzi).
                            </p>
                            <p className="font-sans leading-relaxed">
                                In the apartments, you will find everything you may need: a fully equipped kitchen, a relaxation area, a bathroom, a bedroom (2 single and 1 double beds), WiFi... Heated floors for your comfort, a heat pump for warm evenings, a stove for a romantic cozy feel, and air conditioning to cool down in the hot summer. During the warm season, you can also enjoy the nearby large private beach. We offer rental of a water bike, boat, or canoe with which you can explore and get to know even 16 islands of the Rubikiai lake or watch the most wonderful red sunsets.
                            </p>
                        </div>
                        <div className="lg:col-span-1">
                            <div className="card-soft p-6">
                                <h3 className="text-2xl font-bold mb-4 font-header text-[var(--color-primary)]">Reservation</h3>
                                <div className="space-y-4 font-sans mb-6">
                                    <div>
                                        <h4 className="font-bold">Check-in:</h4>
                                        <p className="text-lg">04:00 PM</p>
                                    </div>
                                    <div>
                                        <h4 className="font-bold">Check-out:</h4>
                                        <p className="text-lg">11:00 AM</p>
                                    </div>
                                </div>
                                {/* Botón de reserva que redirige a la página de Reservas */}
                                <Link href="/Reservations" className="bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] text-white font-bold py-3 px-8 rounded-md transition-colors w-full text-center font-sans block">
                                    Reserve now
                                </Link>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Amenities & Addons */}
            <section className="bg-white py-12 px-4">
                <div className="container mx-auto">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
                        {/* Amenities Section */}
                        <div>
                            <h3 className="text-2xl font-bold mb-4 font-header text-[var(--color-primary-dark)]">Amenities</h3>
                            <ul className="space-y-2 font-sans">
                                <li className="flex items-center"><FaCheck className="text-green-500 mr-2" /> A/C</li>
                                <li className="flex items-center"><FaCheck className="text-green-500 mr-2" /> WiFi</li>
                                <li className="flex items-center"><FaCheck className="text-green-500 mr-2" /> TV</li>
                                <li className="flex items-center"><FaCheck className="text-green-500 mr-2" /> Shower</li>
                                <li className="flex items-center"><FaCheck className="text-green-500 mr-2" /> Kitchen</li>
                                <li className="flex items-center"><FaCheck className="text-green-500 mr-2" /> Towels</li>
                                <li className="flex items-center"><FaCheck className="text-green-500 mr-2" /> Jacuzzi</li>
                            </ul>
                        </div>

                        {/* Addons Section */}
                        <div>
                            <h3 className="text-2xl font-bold mb-4 font-header text-[var(--color-primary-dark)]">Addons</h3>
                            <p className="text-gray-600 mb-2 font-sans">
                                These services can be added to your reservation for an additional fee.
                            </p>
                            <ul className="space-y-2 font-sans">
                                <li className="flex items-center"><FaCheck className="text-green-500 mr-2" /> Water bike rental</li>
                                <li className="flex items-center"><FaCheck className="text-green-500 mr-2" /> Boat rental</li>
                                <li className="flex items-center"><FaCheck className="text-green-500 mr-2" /> Canoe rental</li>
                            </ul>
                        </div>

                        {/* A custom section for the fireplace */}
                        <div>
                            <h3 className="text-2xl font-bold mb-4 font-header text-[var(--color-primary-dark)]">Special features</h3>
                            <div className="flex items-center mb-2 font-sans">
                                <FaCheck className="text-green-500 mr-2" />
                                <span>Romantic fireplace for cozy evenings.</span>
                            </div>
                            <p className="text-gray-600 mb-4 font-sans">
                                Perfect for a cozy, intimate evening. Firewood is provided.
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            {/* Gallery Section */}
            <ImageGallery images={images} />

            {/* Map Section */}
            <section className="py-12 bg-white px-4">
                <div className="container mx-auto text-center">
                    <h2 className="text-3xl font-bold mb-4 font-header text-[var(--color-primary-dark)]">Location</h2>
                    <p className="text-gray-600 mb-6 font-sans">
                        Find us on Google Maps to plan your trip.
                    </p>
                    <div className="relative w-full h-96 rounded-lg overflow-hidden shadow-lg">
                        {/* Embedded Google Maps iframe */}
                        <iframe
                            src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d157835.4326558231!2d25.43715878297757!3d55.45785055042656!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x46e72c8f8d228c21%3A0x633d7c5b61a4c905!2sRubikiai%20lake!5e0!3m2!1sen!2ses!4v1698716301138!5m2!1sen!2ses"
                            width="100%"
                            height="100%"
                            style={{ border: 0 }}
                            allowFullScreen={true}
                            loading="lazy"
                            referrerPolicy="no-referrer-when-downgrade"
                            aria-label="Location of Rubikiai lake on Google Maps"
                        ></iframe>
                    </div>
                </div>
            </section>
            {/* Aquí se añade el componente OtherOptions */}
            <OtherOptions />
        </main>
    );
};

export default ElniuAptvaroPage;
// app/contact/page.tsx
"use client";

import React from 'react';
import Image from 'next/image';
import Link from 'next/link'; // Importar Link si lo vas a usar para llamadas/emails
import { FaPhone, FaEnvelope } from 'react-icons/fa'; // Mantengo los iconos por si quieres usarlos sutilmente

const ContactPage: React.FC = () => {
  return (
    <main className="min-h-screen bg-white text-[var(--color-text-dark)] flex flex-col lg:flex-row font-sans mt-4">
      {/* Left Section: Contact Form & Info */}
      <div className="w-full lg:w-1/2 flex flex-col justify-center items-center p-8 md:p-16 lg:p-24 xl:p-32">
        <div className="max-w-md mx-auto lg:mx-0 w-full">
          <h1 className="text-5xl md:text-6xl font-header mb-12 text-[var(--color-primary-dark)]">
            Escríbenos
          </h1>

          {/* Contact Form */}
          <form action="https://getform.io/f/bjjrddeb" method="POST" className="space-y-10">
            {/* Name Input */}
            <div>
              <label htmlFor="name" className="block text-base mb-2">
                Nombre <span className="text-[var(--color-primary)]">*</span>
              </label>
              <input
                type="text"
                id="name"
                name="name"
                required
                className="w-full pb-2 border-b border-gray-400 focus:outline-none focus:border-[var(--color-primary)] bg-transparent text-lg transition-colors duration-300"
                aria-label="Nombre completo"
              />
            </div>

            {/* Email Input */}
            <div>
              <label htmlFor="email" className="block text-base mb-2">
                Correo electrónico <span className="text-[var(--color-primary)]">*</span>
              </label>
              <input
                type="email"
                id="email"
                name="email"
                required
                className="w-full pb-2 border-b border-gray-400 focus:outline-none focus:border-[var(--color-primary)] bg-transparent text-lg transition-colors duration-300"
                aria-label="Dirección de correo electrónico"
              />
            </div>

            {/* Message Input */}
            <div>
              <label htmlFor="message" className="block text-base mb-2">
                Su mensaje, preguntas o preocupaciones... <span className="text-[var(--color-primary)]">*</span>
              </label>
              <textarea
                id="message"
                name="message"
                rows={4}
                required
                className="w-full pb-2 border-b border-gray-400 focus:outline-none focus:border-[var(--color-primary)] bg-transparent text-lg transition-colors duration-300 resize-none"
                aria-label="Su mensaje"
              ></textarea>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              className="mt-12 w-32 h-32 rounded-full border border-gray-500 text-lg hover:bg-[var(--color-primary)] hover:text-white hover:border-[var(--color-primary)] transition-all duration-300 flex items-center justify-center mx-auto"
            >
              Enviar
            </button>
          </form>

          {/* Additional Contact Info (Optional - Can be placed elsewhere if preferred) */}
          <div className="mt-20 flex flex-col justify-center items-center text-center lg:text-left text-gray-600">
            <p className="flex items-center justify-center lg:justify-start mb-2">
              <FaPhone className="mr-3 text-lg text-[var(--color-primary)]" />
              <Link href="tel:+37064632972" className="hover:text-[var(--color-primary-dark)] transition-colors">
                +370 646 32 972
              </Link>
            </p>
            <p className="flex items-center justify-center lg:justify-start">
              <FaEnvelope className="mr-3 text-lg text-[var(--color-primary)]" />
              <Link href="mailto:info@rubikiailux.lt" className="hover:text-[var(--color-primary-dark)] transition-colors">
                info@rubikiailux.lt
              </Link>
            </p>
          </div>
        </div>
      </div>

      {/* Right Section: Image */}
      <div className="w-full lg:w-1/2 relative h-96 lg:h-auto overflow-hidden">
        <Image
          src="/reno-contacto.avif" // Asegúrate de tener esta imagen en tu carpeta public
          alt="Contact Image"
          layout="fill"
          objectFit="cover"
          priority // Carga prioritaria
          className="lg:object-contain object-cover" // Ajuste para que la imagen se adapte mejor
        />
      </div>
    </main>
  );
};

export default ContactPage;
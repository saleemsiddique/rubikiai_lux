// app/contact/page.tsx
"use client";

import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { FaPhone, FaEnvelope } from 'react-icons/fa';
import { useTranslations } from 'next-intl';

const ContactPage: React.FC = () => {
  const t = useTranslations('contact');
  return (
    <main className="min-h-screen bg-white text-[var(--color-text-dark)] flex flex-col lg:flex-row font-sans mt-4 flex-col-reverse lg:flex-row">
      {/* Left Section: Contact Form & Info */}
      <div className="w-full lg:w-1/2 flex flex-col justify-center items-center p-8 md:p-16 lg:p-24 xl:p-32">
        <div className="max-w-md mx-auto lg:mx-0 w-full">
          <h1 className="text-5xl md:text-6xl font-header mb-12 text-[var(--color-primary-dark)]">
            {t('writeTo')}
          </h1>

          {/* Contact Form */}
          <form action="https://getform.io/f/bjjrddeb" method="POST" className="space-y-10">
            {/* Name Input */}
            <div>
              <label htmlFor="name" className="block text-base mb-2">
                {t('nameRequired')}
              </label>
              <input
                type="text"
                id="name"
                name="name"
                required
                className="w-full pb-2 border-b border-gray-400 focus:outline-none focus:border-[var(--color-primary)] bg-transparent text-lg transition-colors duration-300"
                aria-label={t('name')}
              />
            </div>

            {/* Email Input */}
            <div>
              <label htmlFor="email" className="block text-base mb-2">
                {t('emailRequired')}
              </label>
              <input
                type="email"
                id="email"
                name="email"
                required
                className="w-full pb-2 border-b border-gray-400 focus:outline-none focus:border-[var(--color-primary)] bg-transparent text-lg transition-colors duration-300"
                aria-label={t('email')}
              />
            </div>

            {/* Message Input */}
            <div>
              <label htmlFor="message" className="block text-base mb-2">
                {t('messageRequired')}
              </label>
              <textarea
                id="message"
                name="message"
                rows={4}
                required
                className="w-full pb-2 border-b border-gray-400 focus:outline-none focus:border-[var(--color-primary)] bg-transparent text-lg transition-colors duration-300 resize-none"
                aria-label={t('message')}
              ></textarea>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              className="mt-12 w-32 h-32 rounded-full border border-gray-500 text-lg hover:bg-[var(--color-primary)] hover:text-white hover:border-[var(--color-primary)] transition-all duration-300 flex items-center justify-center mx-auto"
            >
              {t('send')}
            </button>
          </form>

          {/* Additional Contact Info */}
          <div className="mt-20 flex flex-col justify-center items-center text-center lg:text-left text-gray-600">
            <p className="flex items-center justify-center lg:justify-start mb-2">
              <FaPhone className="mr-3 text-lg text-[var(--color-primary)]" />
              <Link href={`tel:${t('phone')}`} className="hover:text-[var(--color-primary-dark)] transition-colors">
                {t('phone')}
              </Link>
            </p>
            <p className="flex items-center justify-center lg:justify-start">
              <FaEnvelope className="mr-3 text-lg text-[var(--color-primary)]" />
              <Link href={`mailto:${t('emailAddress')}`} className="hover:text-[var(--color-primary-dark)] transition-colors">
                {t('emailAddress')}
              </Link>
            </p>
          </div>
        </div>
      </div>

      {/* Right Section: Image */}
      <div className="w-full lg:w-1/2 relative h-96 lg:h-auto overflow-hidden">
        <Image
          src="/contact/reno-contacto.avif"
          alt={t('contactImageAlt')}
          layout="fill"
          objectFit="cover"
          priority
          className="lg:object-contain object-cover"
        />
      </div>
    </main>
  );
};

export default ContactPage;
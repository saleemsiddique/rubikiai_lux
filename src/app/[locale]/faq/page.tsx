// app/faq/page.tsx
"use client";

import React, { useState } from 'react';
import { FaChevronDown, FaChevronUp } from 'react-icons/fa';
import { useTranslations } from 'next-intl';

interface FAQItemProps {
  question: string;
  answer: string;
}

const FAQItem: React.FC<FAQItemProps> = ({ question, answer }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="border-b border-gray-200 py-6">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex justify-between items-center w-full text-left focus:outline-none transition-colors duration-300 hover:text-[var(--color-primary)]"
      >
        <h3 className="text-lg md:text-xl font-semibold font-sans text-[var(--color-text-dark)]">
          {question}
        </h3>
        {isOpen ? (
          <FaChevronUp className="text-[var(--color-primary)] transition-transform duration-300" />
        ) : (
          <FaChevronDown className="text-gray-500 transition-transform duration-300" />
        )}
      </button>
      <div
        className={`overflow-hidden transition-all duration-500 ease-in-out ${
          isOpen ? 'max-h-96 opacity-100 mt-4' : 'max-h-0 opacity-0'
        }`}
      >
        <p className="text-[var(--color-text)] font-light leading-relaxed pr-6">
          {answer}
        </p>
      </div>
    </div>
  );
};

const FAQPage: React.FC = () => {
  const t = useTranslations('faq');

  const faqs = [
    { question: t('q1'), answer: t('a1') },
    { question: t('q2'), answer: t('a2') },
    { question: t('q3'), answer: t('a3') },
    { question: t('q4'), answer: t('a4') },
    { question: t('q5'), answer: t('a5') },
    { question: t('q6'), answer: t('a6') },
    { question: t('q7'), answer: t('a7') },
  ];

  return (
    <main className="bg-white min-h-screen pt-40 px-4">
      <div className="container mx-auto max-w-4xl">
        <h1 className="text-4xl md:text-5xl font-extrabold text-center mb-12 font-header text-[var(--color-primary-dark)]">
          {t('title')}
        </h1>
        <p className="text-center text-lg text-[var(--color-text)] mb-8 font-sans">
          {t('subtitle')}
        </p>
        <div className="mt-8">
          {faqs.map((faq, index) => (
            <FAQItem key={index} question={faq.question} answer={faq.answer} />
          ))}
        </div>
      </div>
    </main>
  );
};

export default FAQPage;
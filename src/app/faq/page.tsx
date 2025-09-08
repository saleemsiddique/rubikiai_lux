// app/faq/page.tsx
"use client";

import React, { useState } from 'react';
import { FaChevronDown, FaChevronUp } from 'react-icons/fa';

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
  const faqs = [
    {
      question: "What are the check-in and check-out times?",
      answer: "Check-in time is from 4:00 PM. Check-out time is until 11:00 AM.",
    },
    {
      question: "Can I bring my pets?",
      answer: "For the safety and tranquility of the fallow deer, pets are not allowed. If you arrive with a pet, you will be asked to leave, and the payment will not be refunded.",
    },
    {
      question: "Can I feed the fallow deer?",
      answer: "You can only feed the fallow deer with fruits and vegetables, which you can either bring yourself or purchase in a basket for a symbolic price upon arrival.",
    },
    {
      question: "Can I cancel my reservation and get a refund?",
      answer: "The reservation date can be changed no later than 7 days before arrival. The deposit (50% of the accommodation cost) is non-refundable.",
    },
    {
      question: "Is there Wi-Fi available in the apartments?",
      answer: "Yes, all our apartments offer free and stable Wi-Fi connectivity for all our guests.",
    },
    {
      question: "Do you have parking facilities?",
      answer: "Yes, we provide free on-site parking for all our guests during their stay.",
    },
  ];

  return (
    <main className="bg-white min-h-screen pt-40 px-4">
      <div className="container mx-auto max-w-4xl">
        <h1 className="text-4xl md:text-5xl font-extrabold text-center mb-12 font-header text-[var(--color-primary-dark)]">
          Frequently Asked Questions
        </h1>
        <p className="text-center text-lg text-[var(--color-text)] mb-8 font-sans">
          Find answers to the most common questions about your stay at our retreat.
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
"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const Header: React.FC = () => {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const pathname = usePathname();

  const toggleDrawer = () => {
    setIsDrawerOpen(!isDrawerOpen);
  };

  const navLinks = [
    { name: 'Home', href: '/' },
    { name: 'Duplex', href: '/duplex' },
    { name: 'Lake House', href: '/lake-house' },
    { name: 'Reservations', href: '/reservations' },
    { name: 'Coupons', href: '/coupons' },
    { name: 'FAQ', href: '/faq' },
    { name: 'Contacts', href: '/contacts' },
  ];

  return (
    <>
      <header className="fixed w-full z-50 py-6 px-8 flex justify-between items-center bg-[var(--color-background-main)] shadow-sm transition-colors duration-500">
        {/* Hamburger Menu Button (Left) */}
        <button
          onClick={toggleDrawer}
          className="text-[var(--color-highlight)] hover:text-[var(--color-primary-dark)] focus:outline-none transition-colors"
          aria-label="Toggle navigation menu"
        >
          <svg
            className="w-8 h-8"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M4 6h16M4 12h16m-7 6h7"
            ></path>
          </svg>
        </button>

        {/* Centered Logo */}
        <div className="absolute left-1/2 transform -translate-x-1/2">
          <Link href="/" className="font-header text-4xl text-[var(--color-highlight)] tracking-wide">
            Y O U R S T A Y
          </Link>
        </div>

        {/* Reservation Button (Right) */}
        <Link
          href="/reservations"
          className="font-sans border border-[var(--color-highlight)] text-[var(--color-highlight)] text-sm uppercase tracking-wider py-3 px-6 transition-colors duration-300 hover:bg-[var(--color-highlight)] hover:text-[var(--color-background-main)]"
        >
          Reservation
        </Link>
      </header>

      {/* Drawer (Sliding Menu) */}
      <div
        className={`fixed top-0 left-0 h-full w-full md:w-1/3 bg-[var(--color-background-main)] shadow-2xl transform transition-transform duration-500 ease-in-out z-40 overflow-y-auto ${
          isDrawerOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="p-12 h-full flex flex-col justify-between">
          {/* Close Button */}
          <div className="flex justify-end">
            <button
              onClick={toggleDrawer}
              className="text-[var(--color-highlight)] hover:text-[var(--color-primary-dark)] focus:outline-none"
              aria-label="Close menu"
            >
              <svg
                className="w-8 h-8"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M6 18L18 6M6 6l12 12"
                ></path>
              </svg>
            </button>
          </div>

          {/* Navigation Links */}
          <nav className="flex flex-col space-y-8 flex-1 justify-center">
            {navLinks.map((link) => (
              <React.Fragment key={link.name}>
                <NavLink href={link.href} onClick={toggleDrawer} isActive={pathname === link.href}>
                  {link.name}
                </NavLink>
                {link.name !== 'Contacts' && (
                  <hr className="w-12 mx-auto border-t border-[var(--color-highlight)] opacity-20" />
                )}
              </React.Fragment>
            ))}
          </nav>

          {/* Social Media Icons (Optional) */}
          <div className="flex items-center space-x-4 text-[var(--color-highlight)] mt-8 justify-center">
            <a href="#" aria-label="Facebook"><i className="fab fa-facebook-f text-lg hover:text-[var(--color-primary-dark)]"></i></a>
            <a href="#" aria-label="Instagram"><i className="fab fa-instagram text-lg hover:text-[var(--color-primary-dark)]"></i></a>
            <a href="#" aria-label="Pinterest"><i className="fab fa-pinterest text-lg hover:text-[var(--color-primary-dark)]"></i></a>
          </div>
        </div>
      </div>

      {/* Main Page Content */}
      <div
        className={`transform transition-transform duration-500 ease-in-out z-20 ${
          isDrawerOpen ? 'translate-x-full md:translate-x-[33.33%] pointer-events-none' : 'translate-x-0'
        }`}
      >
      {/* The rest of your page goes here (Hero, About, etc.) */}
      </div>
    </>
  );
};

// Helper component for navigation links
const NavLink: React.FC<{ href: string; children: React.ReactNode; onClick: () => void; isActive: boolean }> = ({ href, children, onClick, isActive }) => {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={`font-sans text-[var(--color-highlight)] text-3xl md:text-4xl font-light hover:text-[var(--color-primary-dark)] transition-colors duration-200 uppercase ${
        isActive ? 'text-[var(--color-primary-dark)] font-medium' : ''
      }`}
    >
      {children}
    </Link>
  );
};

export default Header;

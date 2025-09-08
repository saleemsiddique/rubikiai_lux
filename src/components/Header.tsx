"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Image from 'next/image';

const Header: React.FC = () => {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const pathname = usePathname();

  const pageTitles: Record<string, string> = {
    '/': 'INICIO',
    '/dupleksas': 'DUPLEKSAS',
    '/ezero-namelis': 'EŽERO NAMELIS',
    '/reservations': 'RESERVATIONS',
    '/coupons': 'COUPONS',
    '/faq': 'FAQ',
    '/contact': 'CONTACT',
  };

  const toggleDrawer = () => setIsDrawerOpen((v) => !v);

  const navLinks = [
    { name: 'Home', href: '/' },
    { name: 'Dupleksas', href: '/dupleksas' },
    { name: 'EŽERO NAMELIS', href: '/ezero-namelis' },
    { name: 'Reservations', href: '/reservations' },
    { name: 'Coupons', href: '/coupons' },
    { name: 'FAQ', href: '/faq' },
    { name: 'Contact', href: '/contact' },
  ];

  return (
    <>
      <header className="fixed w-full z-50 px-4 md:px-8 py-6 md:py-6 flex items-center justify-between bg-[var(--color-background-main)] shadow-sm transition-colors duration-500" style={{backdropFilter: 'saturate(120%) blur(6px)'}}>
        {/* Left: menu + page title (title hidden on very small screens) */}
        <div className="flex items-center gap-3 md:gap-4">
          <button
            onClick={toggleDrawer}
            aria-expanded={isDrawerOpen}
            aria-label="Toggle navigation menu"
            className="p-2 md:p-1 rounded focus:outline-none focus:ring-2 focus:ring-[var(--color-highlight)] cursor-pointer hover:scale-110 transition-transform"
          >
            <svg className="w-6 h-6 md:w-7 md:h-7 text-[var(--color-highlight)]" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16m-7 6h7"></path>
            </svg>
          </button>

          <span className="hidden sm:inline-block text-[var(--color-highlight)] text-sm md:text-base font-light tracking-wide max-w-[140px] truncate">
            {pageTitles[pathname] || ''}
          </span>
        </div>

        {/* Center logo: vertically centered and responsive size */}
        <div className="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 pointer-events-none">
          <Link href="/" className="flex items-center justify-center pointer-events-auto">
            <Image
              src="/rubikiai-logo.png"
              alt="Rubikiai Lux Logo"
              width={160}
              height={40}
              className="w-[110px] md:w-[160px] h-auto mt-4"
              priority
            />
          </Link>
        </div>

        {/* Right button - hidden on small screens */}
        <div className="min-w-[120px] flex justify-end hidden md:flex">
          <Link
            href="/reservations"
            className="font-sans border border-[var(--color-highlight)] text-[var(--color-highlight)] text-xs md:text-sm uppercase tracking-wider py-2 px-4 md:py-3 md:px-6 transition-colors duration-300 hover:bg-[var(--color-highlight)] hover:text-[var(--color-background-main)] rounded"
          >
            Reservation
          </Link>
        </div>
      </header>

      {/* Drawer */}
      <div className={`fixed top-0 left-0 h-full w-full md:w-1/2 lg:w-1/3 bg-[var(--color-background-main)] shadow-2xl transform transition-transform duration-400 ease-in-out z-40 overflow-y-auto ${isDrawerOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="relative p-8 md:p-12 h-full flex flex-col justify-between">
          {/* Close X (absolute so it stays visible on scroll) */}
          <button
            onClick={toggleDrawer}
            aria-label="Close menu"
            className="absolute top-28 right-4 p-2 rounded focus:outline-none focus:ring-2 focus:ring-[var(--color-highlight)] cursor-pointer hover:scale-110 transition-transform"
          >
            <svg className="w-7 h-7 md:w-8 md:h-8 text-[var(--color-text)]" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
            </svg>
          </button>

          <nav className="flex flex-col space-y-6 flex-1 justify-center px-2">
            {navLinks.map((link) => (
              <React.Fragment key={link.name}>
                <NavLink href={link.href} onClick={toggleDrawer} isActive={pathname === link.href}>
                  {link.name}
                </NavLink>
                {link.name !== 'Contact' && (
                  <hr className="w-10 mx-auto border-t border-[var(--color-highlight)] opacity-20" />
                )}
              </React.Fragment>
            ))}
          </nav>

          <div className="flex items-center space-x-4 text-[var(--color-highlight)] mt-6 justify-center">
            <a href="#" aria-label="Facebook"><i className="fab fa-facebook-f text-sm md:text-base hover:text-[var(--color-primary-dark)]"></i></a>
            <a href="#" aria-label="Instagram"><i className="fab fa-instagram text-sm md:text-base hover:text-[var(--color-primary-dark)]"></i></a>
            <a href="#" aria-label="Pinterest"><i className="fab fa-pinterest text-sm md:text-base hover:text-[var(--color-primary-dark)]"></i></a>
          </div>
        </div>
      </div>

      {/* Main content wrapper shifts when drawer is open on mobile/tablet */}
      <div className={`transform transition-transform duration-400 ease-in-out z-20 ${isDrawerOpen ? 'translate-x-full md:translate-x-[50%]' : 'translate-x-0'}`}>
        {/* Aquí va el contenido principal de la página */}
      </div>
    </>
  );
};

const NavLink: React.FC<{ href: string; children: React.ReactNode; onClick: () => void; isActive: boolean }> = ({ href, children, onClick, isActive }) => {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={`font-sans text-[var(--color-highlight)] text-xl md:text-2xl font-light hover:text-[var(--color-primary-dark)] transition-colors duration-200 uppercase ${isActive ? 'text-[var(--color-primary-dark)] font-medium' : ''}`}
    >
      {children}
    </Link>
  );
};

export default Header;

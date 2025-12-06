'use client';

import { useEffect } from 'react';

export default function PWAInstaller() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker
          .register('/sw.js')
          .then((registration) => {
            console.log('Service Worker registrado con éxito:', registration.scope);
          })
          .catch((error) => {
            console.log('Error al registrar Service Worker:', error);
          });
      });
    }
  }, []);

  return null;
}

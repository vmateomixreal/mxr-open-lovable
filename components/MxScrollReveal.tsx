'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

/**
 * Activa .is-visible en elementos .mx-entra al entrar en viewport,
 * con red de seguridad a 1.5s (según sistema Mixreal).
 */
export default function MxScrollReveal() {
  const pathname = usePathname();

  useEffect(() => {
    const nodes = Array.from(document.querySelectorAll('.mx-entra'));
    if (!nodes.length) return;

    const io = new IntersectionObserver(
      (entries, obs) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('is-visible');
          obs.unobserve(entry.target);
        });
      },
      { threshold: 0.18 }
    );

    nodes.forEach((node) => io.observe(node));

    const safety = window.setTimeout(() => {
      document
        .querySelectorAll('.mx-entra:not(.is-visible)')
        .forEach((node) => node.classList.add('is-visible'));
    }, 1500);

    return () => {
      io.disconnect();
      window.clearTimeout(safety);
    };
  }, [pathname]);

  return null;
}

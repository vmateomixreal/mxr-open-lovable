"use client";

import Link from "next/link";

/** Enlace mínimo a inicio — sin logo ni marca */
export default function HeaderBrandKit() {
  return (
    <Link
      href="/"
      className="text-[13px] text-[#666] hover:text-[#222] transition-colors"
    >
      Inicio
    </Link>
  );
}

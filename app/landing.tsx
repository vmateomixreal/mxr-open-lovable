"use client";

import { HeaderProvider } from "@/components/shared/header/HeaderContext";
import HomeHeroTitle from "@/components/app/(home)/sections/hero/Title/Title";
import HeroInput from "@/components/app/(home)/sections/hero-input/HeroInput";

export default function LandingPage() {
  return (
    <HeaderProvider>
      <div className="min-h-screen relative">
        <div className="meshBg" aria-hidden>
          <div className="meshTint" />
        </div>

        <section className="overflow-x-clip relative z-[1]" id="home-hero">
          <div className="pt-48 lg:pt-160 pb-115 relative" id="hero-content">
            <div className="relative container px-16">
              <HomeHeroTitle />
              <HeroInput />
            </div>
          </div>
        </section>
      </div>
    </HeaderProvider>
  );
}

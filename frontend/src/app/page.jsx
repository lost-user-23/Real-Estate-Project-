import { Suspense } from "react";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { ConsentBanner } from "@/components/ConsentBanner";
import { Hero } from "@/components/home/Hero";
import { SellBanner } from "@/components/home/SellBanner";
import { FeaturedProperties } from "@/components/home/FeaturedProperties";
import { PopularLocations } from "@/components/home/PopularLocations";
import { PropertyCategories } from "@/components/home/PropertyCategories";
import { NewProjects } from "@/components/home/NewProjects";
import { BuildersPromo } from "@/components/home/BuildersPromo";
import { WhyChooseUs } from "@/components/home/WhyChooseUs";
import { Insights } from "@/components/home/Insights";
import { AppPromotion } from "@/components/home/AppPromotion";

export default function Home() {
  return (
    <>
      <Navbar />
      <main id="main-content" className="flex-1 pt-16">
        <Suspense fallback={null}>
          <Hero />
          <SellBanner />
          <FeaturedProperties />
          <PopularLocations />
          <PropertyCategories />
          <NewProjects />
          <BuildersPromo />
          <WhyChooseUs />
          <Insights />
        </Suspense>
        <AppPromotion />
      </main>
      <Footer />
      <ConsentBanner />
    </>
  );
}

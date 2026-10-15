import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { VerificationBanner } from "@/components/account/VerificationBanner";
import { NewsPopup } from "@/components/home/NewsPopup";

export function PageShell({ children }) {
  return (
    <>
      <Navbar />
      <main id="main-content" className="flex-1 pt-16">
        <VerificationBanner />
        {children}
      </main>
      <Footer />
      <NewsPopup />
    </>
  );
}

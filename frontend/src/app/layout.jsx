import { Inter, Plus_Jakarta_Sans } from "next/font/google";
import { Providers } from "@/components/Providers";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  display: "swap",
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const SITE_URL = "https://www.homenest.example";

export const metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "HomeNest — Find the right place, without the noise",
    template: "%s | HomeNest",
  },
  description:
    "Search reviewed listings for sale and rent, and contact owners and agents directly. Buy, rent, or sell property across India's top cities.",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "HomeNest — Find the right place, without the noise",
    description:
      "Search reviewed listings for sale and rent, and contact owners and agents directly.",
    url: SITE_URL,
    siteName: "HomeNest",
    type: "website",
    images: [{ url: "/next.svg", width: 1200, height: 630 }],
  },
};

const jsonLd = [
  {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "HomeNest",
    url: SITE_URL,
  },
  {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "HomeNest",
    url: SITE_URL,
  },
];

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${jakarta.variable} ${inter.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col font-sans">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

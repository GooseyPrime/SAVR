import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";
import { AuthProvider } from "@/contexts/AuthContext";
import PwaRegister from "@/components/PwaRegister";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";

const enableVercelAnalytics = process.env.NEXT_PUBLIC_ENABLE_VERCEL_ANALYTICS === 'true';

export const metadata: Metadata = {
  metadataBase: new URL("https://www.savr.cam"),
  openGraph: {
    type: "website",
    siteName: "SAVR",
    url: "https://www.savr.cam",
    title: "SAVR - AI-Powered Smart Cooking Assistant",
    description: "Turn what's in your pantry into meals, with smart inventory, recipes and meal plans.",
  },
  title: "SAVR - AI-Powered Smart Cooking Assistant",
  description: "Transform your pantry into restaurant-quality meals with AI-powered recipe generation. Smart inventory, personalized recipes, meal planning, and pet-safe treats.",
  keywords: "AI cooking, recipe generator, meal planning, smart kitchen, pet recipes, pantry management",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body className="font-sans antialiased">
        {/* Google Analytics - G-WXDLLPJ8T2 */}
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=G-WXDLLPJ8T2"
          strategy="afterInteractive"
        />
        <Script id="gtag-1" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-WXDLLPJ8T2');
          `}
        </Script>

        <PwaRegister />
        <AuthProvider>
          {children}
        </AuthProvider>
        {enableVercelAnalytics && <Analytics />}
        {enableVercelAnalytics && <SpeedInsights />}
      </body>
    </html>
  );
}

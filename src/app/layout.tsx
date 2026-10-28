import type { Metadata } from "next";
import { Footer } from "@/components/Footer";
import "./globals.css";

export const metadata: Metadata = {
  title: "NookShift - Redesign your space",
  description:
    "Redesign your rented space without designer cost. Upload a photo, describe the change, get a grounded visual proposal.",
};

// Apply saved theme before first paint to avoid a flash of the wrong mode.
const themeScript = `(function(){try{if(localStorage.getItem("nookshift_theme")==="dark"){document.documentElement.classList.add("dark");}}catch(e){}})();`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Gentium+Book+Plus:ital,wght@0,400;0,700;1,400;1,700&display=swap"
          rel="stylesheet"
        />
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="flex min-h-screen flex-col">
        {children}
        {/* Single global footer — nothing else in pages */}
        <Footer />
      </body>
    </html>
  );
}

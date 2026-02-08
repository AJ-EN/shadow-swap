import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ShadowSwap | Privacy-Preserving Dark Pool",
  description: "Trustless cross-chain atomic swaps between Bitcoin and Starknet. Privacy-preserving dark pool for institutional and retail traders.",
  keywords: ["Bitcoin", "Starknet", "atomic swap", "HTLC", "dark pool", "privacy", "DeFi"],
  openGraph: {
    title: "ShadowSwap | Privacy-Preserving Dark Pool",
    description: "Trustless cross-chain atomic swaps between Bitcoin and Starknet",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}

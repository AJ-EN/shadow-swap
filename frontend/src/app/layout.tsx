import type { Metadata } from "next";
import "./globals.css";
import ClientProviders from "@/providers/ClientProviders";

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
      <body className="antialiased">
        <ClientProviders>
          {children}
        </ClientProviders>
      </body>
    </html>
  );
}

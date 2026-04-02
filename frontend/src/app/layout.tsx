import type { Metadata, Viewport } from "next";
import "@fontsource/maple-mono/400.css";
import "@fontsource/maple-mono/700.css";
import "./globals.css";
import { WalletProvider } from "./providers/WalletProvider";
import { ToastProvider } from "./providers/ToastProvider";
import { AllowanceProvider } from "./providers/AllowanceProvider";
import RootLayoutProvider from "./providers/RootLayoutProvider";

export const metadata: Metadata = {
  title: "gnothi",
  description: "An experimental playground for fully on-chain prediction market resolution.",
  icons: {
    icon: "/gnothi.svg",
    apple: "/gnothi.svg",
    shortcut: "/gnothi.svg",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <RootLayoutProvider>
          <ToastProvider>
            <WalletProvider>
              <AllowanceProvider>
                {children}
              </AllowanceProvider>
            </WalletProvider>
          </ToastProvider>
        </RootLayoutProvider>
        <script src="https://widgets.coingecko.com/gecko-coin-price-chart-widget.js" async></script>
      </body>
    </html>
  );
}

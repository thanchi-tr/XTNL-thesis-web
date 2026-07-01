import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import NavBar from "@/components/layout/NavBar";
import StatusBar from "@/components/layout/StatusBar";
import Footer from "@/components/layout/Footer";
import ScrollToTop from "@/components/ui/ScrollToTop";
import SessionProvider          from "@/components/SessionProvider";
import { SimulatorProvider }   from "@/context/SimulatorContext";
import FounderWelcome          from "@/components/FounderWelcome";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const mono  = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono", display: "swap" });

export const viewport: Viewport = {
  themeColor: "#04080f",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  metadataBase: new URL("https://xtnl-solutions.com"),
  title: {
    default:  "XTNL Solutions",
    template: "%s | XTNL Solutions",
  },
  description:
    "A 96.5% deterministic quantitative compounding engine for EUR/USD spot foreign exchange. Statistical edge SQN 4.253, validated across N=914 live transactions.",
  keywords: [
    "quantitative trading", "algorithmic trading", "forex", "EUR/USD",
    "systematic trading", "Monte Carlo", "risk management", "XTNL",
  ],
  authors: [{ name: "XTNL Solutions", url: "mailto:xt@xtnl-solutions.com" }],
  creator: "XTNL Solutions",
  openGraph: {
    type:        "website",
    siteName:    "XTNL Solutions",
    title:       "XTNL Solutions | Institutional Prospectus",
    description: "A 96.5% deterministic quantitative compounding engine for EUR/USD spot FX. SQN 4.253 · OOS Expectancy 0.904 R · Validated N=914.",
    locale:      "en_AU",
  },
  twitter: {
    card:        "summary",
    title:       "XTNL Solutions",
    description: "Quantitative EUR/USD compounding engine. SQN 4.253 · STABLE · OOS validated.",
  },
  robots: { index: false, follow: false }, // private prospectus
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${inter.variable} ${mono.variable}`}>
      <body>
        <SessionProvider>
          <SimulatorProvider>
            <NavBar />
            <StatusBar />
            <div style={{ paddingTop: "calc(var(--nav-h) + var(--bar-h))" }}>
              {children}
            </div>
            <Footer />
            <ScrollToTop />
            <FounderWelcome />
          </SimulatorProvider>
        </SessionProvider>
      </body>
    </html>
  );
}

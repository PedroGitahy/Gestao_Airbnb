import type { Metadata } from "next";
import "./central.css";

export const metadata: Metadata = {
  title: "Central RGR",
  manifest: "/manifest.webmanifest",
  robots: { index: false, follow: false },
  appleWebApp: { capable: true, title: "Central RGR", statusBarStyle: "default" },
};

export default function CentralLayout({ children }: { children: React.ReactNode }) {
  return children;
}

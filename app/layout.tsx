import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Keller, by Realty Enhanced",
  description:
    "Test how the Realty Enhanced assistant talks to your customers and leads, on a call and in chat, and how it builds a listing from your photographs.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

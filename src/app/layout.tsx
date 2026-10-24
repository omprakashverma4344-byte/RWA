import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "STUDY PREMIUM — Premium Learning Hub",
  description:
    "STUDY PREMIUM: premium batches, lectures, notes and PDFs for competitive exams. Dark & golden learning experience.",
  keywords: [
    "STUDY PREMIUM",
    "batches",
    "lectures",
    "notes",
    "PDFs",
    "competitive exams",
    "learning",
  ],
  authors: [{ name: "STUDY PREMIUM" }],
  icons: {
    icon: [
      { url: "/branding/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/branding/favicon-16.png", sizes: "16x16", type: "image/png" },
      { url: "/branding/logo.png", type: "image/png" },
    ],
    apple: "/branding/apple-touch-icon.png",
  },
  openGraph: {
    title: "STUDY PREMIUM — Premium Learning Hub",
    description: "Premium batches, lectures, notes and PDFs — all in one place.",
    siteName: "STUDY PREMIUM",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "STUDY PREMIUM — Premium Learning Hub",
    description: "Premium batches, lectures, notes and PDFs — all in one place.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}

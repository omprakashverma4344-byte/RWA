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
  title: "Study Bison — Premium Learning Hub",
  description:
    "Study Bison: premium batches, lectures, notes and PDFs for competitive exams. Dark & golden learning experience.",
  keywords: [
    "Study Bison",
    "batches",
    "lectures",
    "notes",
    "PDFs",
    "competitive exams",
    "learning",
  ],
  authors: [{ name: "Study Bison" }],
  icons: {
    icon: [
      { url: "/branding/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/branding/favicon-16.png", sizes: "16x16", type: "image/png" },
      { url: "/branding/logo.png", type: "image/png" },
    ],
    apple: "/branding/apple-touch-icon.png",
  },
  openGraph: {
    title: "Study Bison — Premium Learning Hub",
    description: "Premium batches, lectures, notes and PDFs — all in one place.",
    siteName: "Study Bison",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Study Bison — Premium Learning Hub",
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

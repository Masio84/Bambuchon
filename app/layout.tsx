import type { Metadata } from "next";
import { Bebas_Neue, DM_Sans } from "next/font/google";
import "./globals.css";

const bebasNeue = Bebas_Neue({
  weight: "400",
  variable: "--font-bebas",
  subsets: ["latin"],
});

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Bambuchón Financiero 🐰",
  description: "Gestión inteligente de gastos familiares",
  icons: {
    icon: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const fontClassName = `${bebasNeue.variable} ${dmSans.variable}`;
  
  return (
    <html lang="en" className={fontClassName}>
      <body className={fontClassName}>{children}</body>
    </html>
  );
}

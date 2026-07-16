import type { Metadata } from "next";
import { Lora, Poppins } from "next/font/google";
import "./globals.css";
import "./fonts.css";

const lora = Lora({
  subsets: ["latin"],
  variable: "--font-lora",
  weight: ["400", "500", "600", "700"],
});

const poppins = Poppins({
  subsets: ["latin"],
  variable: "--font-poppins",
  weight: ["300", "400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Kindred",
  description: "Practice talking to new people in a safe, structured environment.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${lora.variable} ${poppins.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col font-[var(--font-poppins)] bg-[#FOF4EA] text-[#00bfff]">
        {children}
      </body>
    </html>
  );
}

import type { Metadata } from "next";
import { Karla, Montserrat, Poppins } from "next/font/google";
import "./globals.css";
import "./fonts.css";

const montserrat = Montserrat({
  subsets: ["latin"],
  variable: "--font-montserrat",
});

const karla = Karla({
  subsets: ["latin"],
  variable: "--font-karla",
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
    <html
      lang="en"
      className={`${montserrat.variable} ${karla.variable} ${poppins.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-[var(--font-poppins)] bg-chantilly text-ink">
        {children}
      </body>
    </html>
  );
}

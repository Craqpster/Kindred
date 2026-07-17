import LandingHero from "@/components/homepage/LandingHero";
import HowItWorks from "@/components/homepage/HowItWorks";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-chantilly text-ink flex flex-col items-center font-[var(--font-poppins)]">
      <LandingHero />
      <HowItWorks />
    </main>
  );
}

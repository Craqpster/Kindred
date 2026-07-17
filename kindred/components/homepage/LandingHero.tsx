export default function LandingHero() {
  return (
    <section className="flex flex-col items-center text-center mt-32 px-6 font-[var(--font-poppins)]">
      <h1 className="text-5xl font-bold mb-4 font-[var(--font-lora)] text-star-sapphire">
        Meet People. Build Confidence.
      </h1>

      <p className="text-lg text-metro-blue max-w-xl mb-8">
        Kindred helps you practice talking to new people in a safe,
  structured environment. Get matched with someone who shares your interests and confidence level.
      </p>

      <div className="flex gap-4">
        <a
          href="/signup"
          className="px-6 py-3 bg-star-sapphire text-white rounded-lg font-medium shadow-md hover:shadow-lg transition"
        >
          Get Started
        </a>

        <a
          href="/login"
          className="px-6 py-3 border border-star-sapphire text-star-sapphire rounded-lg font-medium hover:bg-mist transition"
        >
          Log In
        </a>
      </div>
    </section>
  );
}

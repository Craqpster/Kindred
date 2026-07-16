export default function HowItWorks() {
  return (
    <section className="max-w-4xl mx-auto px-6 py-20 font-[var(--font-poppins)]">
      <h2 className="text-3xl font-bold text-center mb-10 font-[var(--font-lora)] text-[#153D74]">
        How It Works
      </h2>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="border border-[#3F79AF] rounded-lg p-6 bg-white shadow-sm hover:shadow-md transition">
          <h3 className="font-semibold text-lg mb-2 font-[var(--font-lora)] text-[#1A1A1A]">
            1. Set your comfort level
          </h3>
          <p className="text-[#4B5563] text-sm">
            Choose your interests, confidence level, and age preferences.
          </p>
        </div>

        <div className="border border-[#3F79AF] rounded-lg p-6 bg-white shadow-sm hover:shadow-md transition">
          <h3 className="font-semibold text-lg mb-2 font-[var(--font-lora)] text-[#1A1A1A]">
            2. Get matched intentionally
          </h3>
          <p className="text-[#4B5563] text-sm">
            Matches are based on shared interests, confidence stage, and timezone.
          </p>
        </div>

        <div className="border border-[#3F79AF] rounded-lg p-6 bg-white shadow-sm hover:shadow-md transition">
          <h3 className="font-semibold text-lg mb-2 font-[var(--font-lora)] text-[#1A1A1A]">
            3. Chat with structure
          </h3>
          <p className="text-[#4B5563] text-sm">
            No images—just avatars and guided prompts to keep conversations flowing.
          </p>
        </div>

        <div className="border border-[#3F79AF] rounded-lg p-6 bg-white shadow-sm hover:shadow-md transition">
          <h3 className="font-semibold text-lg mb-2 font-[var(--font-lora)] text-[#1A1A1A]">
            4. Build confidence
          </h3>
          <p className="text-[#4B5563] text-sm">
            Unlock avatars, badges, and group creation as you complete chats.
          </p>
        </div>
      </div>
    </section>
  );
}

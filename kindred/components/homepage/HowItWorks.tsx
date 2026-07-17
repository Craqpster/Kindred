"use client";

export default function HowItWorks() {
  return (
    <>
      {/* Why Kindred */}
      <section
        id="why-kindred"
        className="w-full bg-flour px-6 py-24 lg:px-12"
      >
        <div className="mx-auto max-w-5xl">
          <p className="mb-4 text-sm font-semibold uppercase tracking-[0.18em] text-metro-blue">
            Why Kindred
          </p>

          <h2 className="max-w-2xl text-4xl font-bold leading-tight tracking-[-0.03em] text-star-sapphire md:text-5xl">
            Groups are where real social life happens.
            <br />
            We make the first step small.
          </h2>

          <div className="mt-10 grid gap-4 md:grid-cols-3">
            <FeatureCard
              title="A little structure helps"
              description="You don't have to walk into a conversation with nothing to say. Kindred gives you prompts and activities to help conversations flow."
            />

            <FeatureCard
              title="Ease in your way"
              description="Take your time. React before you speak, answer when you're ready, and join conversations at a pace that feels comfortable."
            />

            <FeatureCard
              title="Safe, always"
              description="Kindred is designed around comfort. Control your experience, block or report users, and connect with people at a similar stage."
            />
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section
        id="how-it-works"
        className="w-full bg-chantilly px-6 py-24 lg:px-12"
      >
        <div className="mx-auto max-w-5xl">
          <p className="mb-4 text-sm font-semibold uppercase tracking-[0.18em] text-metro-blue">
            How it works
          </p>

          <h2 className="text-4xl font-bold leading-tight tracking-[-0.03em] text-star-sapphire md:text-5xl">
            A few small steps toward
            <br />
            feeling more comfortable.
          </h2>

          <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <StepCard
              number="1"
              title="Tell us about you"
              description="Choose your interests, comfort level, and the kinds of conversations you'd enjoy."
              color="blue"
            />

            <StepCard
              number="2"
              title="Find your people"
              description="We'll help connect you with people who share your interests and conversation pace."
              color="orange"
            />

            <StepCard
              number="3"
              title="Start talking"
              description="Use prompts, questions, and shared interests to keep the conversation moving."
              color="green"
            />

            <StepCard
              number="4"
              title="Build confidence"
              description="Every conversation is one more small step toward feeling comfortable meeting people."
              color="blue"
            />
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="w-full bg-metro-blue px-6 py-20 lg:px-12">
        <div className="mx-auto flex max-w-5xl flex-col items-start justify-between gap-8 md:flex-row md:items-center">
          <div>
            <h2 className="text-3xl font-bold text-white md:text-4xl">
              Ready to take the first step?
            </h2>

            <p className="mt-2 text-white/75">
              Start small. Meet someone new. See where the conversation goes.
            </p>
          </div>

          <button
            onClick={() => {
              window.location.href = "/signup";
            }}
            className="rounded-full bg-white px-7 py-4 font-semibold text-star-sapphire transition hover:-translate-y-1"
          >
            Get started
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="w-full bg-chantilly px-6 py-8 lg:px-12">
        <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-3 text-sm text-star-sapphire/50 md:flex-row">
          <span>Kindred</span>

          <span>
            Meet people. Build confidence. Take it at your own pace.
          </span>
        </div>
      </footer>
    </>
  );
}

function FeatureCard({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-star-sapphire/10 bg-white/70 p-6 transition duration-300 hover:-translate-y-1 hover:shadow-lg">
      <h3 className="text-lg font-semibold text-star-sapphire">{title}</h3>

      <p className="mt-3 text-sm leading-6 text-star-sapphire/65">
        {description}
      </p>
    </div>
  );
}

function StepCard({
  number,
  title,
  description,
  color,
}: {
  number: string;
  title: string;
  description: string;
  color: "blue" | "orange" | "green";
}) {
  const colors = {
    blue: "bg-iceland/20 text-star-sapphire",
    orange: "bg-orange-100 text-orange-700",
    green: "bg-green-100 text-green-700",
  };

  return (
    <div className="rounded-2xl border border-star-sapphire/10 bg-white/70 p-6 transition duration-300 hover:-translate-y-1 hover:shadow-lg">
      <div
        className={`mb-6 flex h-9 w-9 items-center justify-center rounded-xl text-sm font-semibold ${colors[color]}`}
      >
        {number}
      </div>

      <h3 className="text-lg font-semibold text-star-sapphire">{title}</h3>

      <p className="mt-3 text-sm leading-6 text-star-sapphire/65">
        {description}
      </p>
    </div>
  );
}
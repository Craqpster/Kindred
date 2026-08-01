"use client";

import { ArrowUpRight, Sparkles } from "lucide-react";

export default function LandingHero() {
  return (
    <section className="relative min-h-[760px] w-full overflow-hidden">
      {/* Decorative background shapes */}
      <div className="pointer-events-none absolute -right-24 top-24 h-72 w-72 rounded-full bg-iceland/10 blur-3xl" />
      <div className="pointer-events-none absolute -left-32 bottom-0 h-80 w-80 rounded-full bg-metro-blue/10 blur-3xl" />

      {/* Navigation */}
      <nav className="relative z-10 mx-auto flex max-w-7xl items-center justify-between px-6 py-7 lg:px-12">
        <span className="text-xl font-semibold tracking-tight text-star-sapphire">
          Kindred
        </span>

        <button
          onClick={() => {
            // Replace this with your teammate's existing login route
            window.location.href = "/login";
          }}
          className="rounded-full border border-star-sapphire/20 px-5 py-2.5 text-sm font-medium text-star-sapphire transition hover:bg-white/60"
        >
          Log in
        </button>
      </nav>

      {/* Hero content */}
      <div className="relative z-10 mx-auto grid max-w-7xl items-center gap-16 px-6 pb-24 pt-20 lg:grid-cols-[1fr_0.9fr] lg:px-12 lg:pb-32 lg:pt-24">
        {/* Left side */}
        <div className="max-w-2xl">
          <h1 className="max-w-3xl text-5xl font-bold leading-[1.02] tracking-[-0.04em] text-star-sapphire sm:text-6xl lg:text-7xl">
            Meet people.
            <br />
            <span className="text-metro-blue">At your own pace.</span>
          </h1>

          <p className="mt-8 max-w-xl text-lg leading-8 text-star-sapphire/70 sm:text-xl">
            Practice talking to new people in a safe, low-pressure space.
            Find shared interests, start small, and build confidence one
            conversation at a time.
          </p>

          <div className="mt-9">
            <button
              onClick={() => {
                // Replace this with your teammate's existing signup route
                window.location.href = "/signup";
              }}
              className="group flex items-center gap-3 rounded-full bg-star-sapphire px-7 py-4 font-semibold text-white shadow-lg shadow-star-sapphire/20 transition duration-300 hover:-translate-y-1 hover:bg-metro-blue"
            >
              Get started

              <ArrowUpRight
                size={18}
                className="transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
              />
            </button>
          </div>
        </div>

        {/* Right side: conversation visual */}
        <div className="relative mx-auto h-[440px] w-full max-w-[520px]">
          {/* Soft background blob */}
          <div className="absolute inset-10 rotate-[-5deg] rounded-[45%] bg-mist" />

          {/* Decorative stars */}
          <Sparkles
            className="absolute right-16 top-8 text-metro-blue"
            size={24}
          />

          <Sparkles
            className="absolute bottom-16 left-12 text-iceland"
            size={18}
          />

          {/* Top speech bubble */}
          <div className="absolute right-5 top-14 rotate-3 rounded-2xl rounded-br-sm bg-white px-5 py-4 text-sm text-star-sapphire shadow-lg shadow-star-sapphire/10">
            <span className="mr-2">👋</span>
            hi, what&apos;s your favorite movie?
          </div>

          {/* Person one */}
          <div className="absolute left-12 top-28 flex h-28 w-28 rotate-[-8deg] items-center justify-center rounded-full bg-iceland shadow-xl shadow-iceland/20">
            <span className="text-5xl">🧑🏽‍🎨</span>
          </div>

          {/* Connection line */}
          <div className="absolute left-32 top-52 h-24 w-48 rotate-[-12deg] border-b-2 border-dashed border-metro-blue/40" />

          {/* Person two */}
          <div className="absolute right-16 top-48 flex h-32 w-32 rotate-[7deg] items-center justify-center rounded-full bg-white shadow-xl shadow-star-sapphire/10">
            <span className="text-5xl">🧑🏾‍💻</span>
          </div>

          {/* Bottom message */}
          <div className="absolute bottom-20 left-20 rotate-[-3deg] rounded-2xl rounded-bl-sm bg-star-sapphire px-6 py-4 text-sm text-white shadow-xl shadow-star-sapphire/20">
            wait, I love that too :)
          </div>
        </div>
      </div>
    </section>
  );
}
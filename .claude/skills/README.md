# Vendored agent skills

Third-party skills copied in verbatim, not written here. Recorded so nobody has to wonder
later where 18,000 words of design opinion came from.

| Skill | Source | Licence | Size |
| --- | --- | --- | --- |
| `web-design-guidelines` | [vercel-labs/agent-skills](https://github.com/vercel-labs/agent-skills/tree/main/skills/web-design-guidelines) | MIT | 176 words |
| `design-taste-frontend` | [Leonxlnx/taste-skill](https://github.com/Leonxlnx/taste-skill/tree/main/skills/taste-skill) | MIT | 12,793 words |
| `image-to-code` | [Leonxlnx/taste-skill](https://github.com/Leonxlnx/taste-skill/tree/main/skills/image-to-code-skill) | MIT | 5,806 words |

Updating one means re-copying from upstream. Nothing here is edited locally, so a local
change would be silently lost on the next copy.

## Where these disagree with this repo, this repo wins

`docs/conventions.md` and `app/globals.css` are the authority on how Kindred looks. These
skills were written for greenfield brand work and will sometimes argue with decisions that
are already made here:

- **`design-taste-frontend` bans warm beige/cream + brass palettes as a lazy default.**
  Kindred's Meet surfaces are exactly that family on purpose - `--color-bone-100: #f1ede4`,
  `--color-bone-200: #e6e1d6`, `--color-surface: #fbf9f5`. Keep them.
- **It also prescribes its own typeface shortlist** (Geist, Satoshi, Cabinet Grotesk).
  Kindred's fonts are theme tokens - `font-display` (Montserrat), `font-body` (Karla),
  Poppins as the default sans. Keep them.
- **Neither skill knows the product constraints**: no red, pink or coral (reads romantic -
  this is explicitly not a dating app) and no purple (reads as Discord). Those are not
  stylistic preferences and are not up for a redesign.

What they are genuinely good for here: `design-taste-frontend`'s technical rules, which are
about React and Next rather than taste - `min-h-[100dvh]` over `h-screen`, CSS Grid over
flexbox percentage math, `useMotionValue`/`useTransform` instead of `useState` for
continuous pointer and scroll values, and keeping Motion components as isolated
`'use client'` leaves. This app uses Motion in the dock and the onboarding wizard, so that
advice applies directly.

`web-design-guidelines` fetches its actual rules at review time from
`raw.githubusercontent.com/vercel-labs/web-interface-guidelines`, so what it checks can
change without any change here. It is an accessibility and UX review, which is orthogonal
to the palette decisions above rather than in tension with them.

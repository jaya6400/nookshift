# NookShift

**See First, Analyze the Feel, Then Change.**

NookShift lets renters redesign their space without designer cost. Upload a room
photo (or pick a sample), describe the change by text, and get a structured
plan + visual proposal you can compare with a before/after slider.

Built for the **Meta Global AI Developer Hackathon 2026** (Cerebral Valley + Meta)
by **Jaya Dubey** — solo, Indie Developer track, Ranchi, India.

## Why it is not a wrapper

Every edit is grounded, not just prompt -> image:

1. `muse-spark-1.3` reasons over the image + your text and returns **strict JSON**
   (`goal`, `constraints[]`, `operations[]` with keep/remove/recolor/reposition).
2. `sam-3.1` detects each `operation.target` text-prompted and returns **pixel
   masks** — shown as overlay dots (proof of grounding).
3. `muse-image-1.0` renders the targeted edit proposal from the original image.
4. Optional `muse-voice-transcribe-1.0` turns spoken ideas into text ($0.18/hr).

Model IDs are logged here for judges per hackathon rules.

## Tech stack

- **Next.js 14 (App Router) + TypeScript + Tailwind CSS + shadcn/ui-style components**
- **Framer Motion** for micro-animations (glow pulse is pure CSS keyframes)
- **No database, no sign-in** — name modal saved to `localStorage` (`nookshift_user`)
- Client-side image compression to 1024px webp (<2MB) before upload
- Deploy: Vercel Hobby. Keys server-side only in `.env.local`

## Topology

| Route | Purpose |
| --- | --- |
| `/` | Landing: hero, video placeholder, samples catalogue, single centered footer |
| `/studio` | 20/60/20 workspace: collapsible sidebar / canvas / profile+tips; mobile bottom nav |

Design source: `public/design/New_Screen_1.png` (fixed Uizard wireframe),
`public/design/New_Screen.png` (first export), `public/design/paper-sketch.jpg`.

## Run it

```bash
npm install
npm run dev        # http://localhost:3000
```

Copy `.env.example` to `.env.local` and add `MODEL_API_KEY` when credits arrive
(Phase 1). The app runs fully on mocks without it.

## Phases

- **Phase 0 (this repo):** UI shell from wireframe — Gentium Book Plus, keyboard
  feel, light/dark toggle, name modal, samples, dropzone, before/after slider,
  loading steps.
- **Phase 1 (live):** `/api/plan` wired end-to-end — `callSpark` (muse-spark-1.3,
  temperature 0.2, strict JSON plan) then `callImage` (muse-image-1.0, grounded
  `/images/edits` with the uploaded room, `/images/generations` as text-only
  fallback). Falls back to mock plan when `MODEL_API_KEY` is unset.
- **Phase 1:** wire `/api/plan` to Spark JSON + one SAM call + one Image edit.
- **Phase 2:** mask overlay, checklist refine loop, error handling, cost guard
  (n=1, 5 generations/session).
- **Phase 3:** voice input, history, stretch: WebXR preview.

## Costs (per full loop)

Spark ~$0.001 + SAM ~$0.0025 + Image $0.01 = **~$0.0132**.

## Security

- Keys in `.env.local`, read only by server route handlers. Never in the client bundle.
- Label all output "generated proposal — not to scale".

## Submission checklist

- [x] Gentium Book Plus via Google Fonts link + Tailwind `font-serif`
- [x] Footer full-width & centered (single footer, no duplicate)
- [x] No sign-in; name modal -> `localStorage`
- [x] Dropzone, idea input, Magic button with `#F1FF5E` glow pulse
- [x] Functional light/dark toggle (white/`#0F0A2A`)
- [x] Samples clickable -> loads into canvas
- [x] Before/after slider
- [x] Design wireframe committed under `public/design/`
- [x] README mentions Meta model IDs and topology
- [x] `/api/plan` live (Spark + Image verified, credits active)
- [ ] 3-minute demo video

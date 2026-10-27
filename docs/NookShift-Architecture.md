# NookShift — Architecture & Design Specification (Updated for Kimi)

**Final Name:** NookShift  
**Former Names:** MetaSpace XR, RoomShift  
**Tagline:** See First, Analyze the Feel, Then Change  
**Prepared:** 27 Oct 2026 after Uizard wireframe fix (New_Screen_1.png)  
**Repo Asset:** /design/New_Screen_1.png (the fixed wireframe, PNG export from Uizard free — Figma export is paid, PNG is enough for Kimi vision)

## 1. Product Summary

NookShift lets renters redesign without designer cost. User uploads room photo/video, describes change by text or voice, sees objects segmented, gets structured plan + visual proposal, compares before/after, iteratively refines.

Differentiator: Every edit is tied to a real SAM mask + Spark JSON checklist, not just prompt->image. Judges can see grounding.

## 2. Typography & Brand

**Font (must enforce in code):**
```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Gentium+Book+Plus:ital,wght@0,400;0,700;1,400;1,700&display=swap" rel="stylesheet">
```
- Headings: Gentium Book Plus 700 Bold
- Tagline/body: Gentium Book Plus 400 Regular, 400 Italic for "See First, Analyze the Feel, Then Change"
- UI small text fallback: Inter 400

Tailwind config: `fontFamily: { serif: ['Gentium Book Plus','serif'], sans: ['Inter','sans-serif'] }`

**Colors (white-first, premium studio):**
- Background: #FFFFFF
- Pale surfaces: #EFF6FF, #DBEAFE
- Primary button: Deep Indigo #1C0770
- Focus ring: Electric Violet-Blue #261CC1
- Link: Bright Azure #3A9AFF
- Accent: Luminous Lime #F1FF5E — ONLY as 2px dot, badge, or glowing outline on Magic button, never as text on white
- Dark mode (toggle): bg #0F0A2A, surfaces #1C1A3A, same accents

Keyboard-like feel: Buttons rounded 12px, soft shadow 0 2px 8px rgba(28,7,112,0.12), hover lift 2px, active press down 1px.

## 3. Screens / Topology (Matches Fixed Screenshot New_Screen_1.png)

**No sign-in.** Name modal on first visit -> save to localStorage `nookshift_user`.

### Screen A: Landing Page (/)
- Header: Left NookShift logo cube icon #1C0770 + wordmark Gentium Bold, Right nav pills Features, Samples, Catalogue, Light/Dark toggle (fix orange dot to proper toggle switch)
- Hero: Centered H1 "Want to Redesign your Space?" 48px Bold, sub centered "NookShift is here for you. See First, Analyze the Feel, Then Change" 18px italic
- Middle pale blue card #EFF6FF rounded 16px:
  - Left 60%: Video/Animation placeholder 16:9 dashed border, shows living room. Will later be auto-play loop of workspace.
  - Right 40%: "Samples - History / Catalogue" with 3 image cards (bedroom examples), button "Try Workspace ->" indigo #1C0770 white text, microcopy "Your designs will be saved here. For your comeback." 14px gray, footer note small.
- Footer: Full-width centered, not side card. Text "Built by Jaya Dubey (Indian Dev)" 14px + LinkedIn link with icon `linkedin.com/in/jaya-dubey`. Background #EFF6FF, padding 24px. This was fixed from previous detached card version.

### Screen B: Workspace (/studio)
Layout: Desktop 20% left sidebar | 60% center canvas | 20% right profile. Mobile: sidebar collapses to bottom nav Home Gallery Settings (icons from screenshot bottom).

- Left Sidebar 20% collapsible:
  - Top: "Your Space" 16px Bold + "Hello, Jaya," dynamic from localStorage
  - Avatar Jaya circular + name Jaya + "Workspace architect"
  - Buttons: "Get Sample Images" outline, "Edit Space" ghost link
  - Mid: Settings with sliders icon, Profile section with name input "Enter your name before workspace" (fix typo workspace) — this input is actually modal logic, but keep in settings for edit
  - Profile badge lime dot #F1FF5E small
- Center Canvas 60%:
  - Header "Workspace Canvas" + "60%" label top right
  - Dropzone dashed: Light blue #EFF6FF inside, icon + text "Drop your space image or video" + link "Not have? Get one from Samples ->" #3A9AFF
  - Below: "Type your idea or speak" label + input field rounded full 24px placeholder "Type your idea or speak --" with lightbulb icon right
  - CTA: Pill button "Talk to See the Magic" indigo #1C0770 with magic wand icon, glowing outline animation using box-shadow 0 0 20px #F1FF5E pulse (heart pump bulb effect as sketched)
  - Helper text "Glowing outline indicates studio magic."
- Right Panel 20%:
  - Profile card with Jaya Dubey photo + role Workspace architect
  - Quick Tips with floor plan illustration

## 4. Tech Stack — Beginner-Friendly, Free-First

- Frontend: Next.js 14 App Router + TypeScript + Tailwind CSS + shadcn/ui (Button, Input, Card, Dialog, Toggle)
- Animations: framer-motion free for fade, glow pulse on Magic button: `box-shadow: 0 0 0 0 rgba(241,255,94,0.7)` animated
- Backend: Next.js API routes only (/api/plan, /api/segment, /api/generate). No FastAPI needed for MVP — keeps keys server-side, no extra hosting. If you add FastAPI later, keep it optional.
- Storage: No DB. Samples in /public/samples (3 rights-cleared room photos). User uploads handled in memory, compressed to 1024px longest edge webp <2MB client side.
- Deployment: Vercel Hobby free, env vars MODEL_API_KEY.

## 5. Model Pipeline — Smallest Meaningful Workflow

**Model IDs (verified from official docs):**
- `muse-spark-1.3` — baseURL https://api.meta.ai/v1, OpenAI-compatible
- `sam-3.1` — detection + masks + video tracking single call
- `muse-image-1.0` — POST /v1/images/generations and /v1/images/edits, plus /v1/responses for multi-turn
- `muse-voice-transcribe-1.0` — speech-to-text only, $0.18/hr

**Flow:**
1. Client: compress image, collect prompt + user name from localStorage
2. POST /api/plan:
   a. Spark: system prompt "Return JSON only: {goal, constraints[], operations[{action: keep|remove|recolor|reposition, target: string, value?: string}]}" Input: image (multimodal) + user text. Output: strict JSON. Retry once if invalid.
   b. SAM: for each operation.target, call sam-3.1 with text prompt e.g. "clothes pile on chair". Output: boxes + masks base64 RLE.
   c. Muse Image: assemble prompt from operations, call edit endpoint with original image + text. Output: b64 image. If fails, return original + error.
3. Return: {plan, masks, originalUrl, proposalUrl}
4. Client: show mask chips overlaid on original (proof), checklist with checkboxes, before/after slider (shadcn Slider or custom compare).
5. Refine loop: user edits checklist or new prompt -> repeat with history.

**Do NOT assume:** SAM mask directly usable as inpainting mask for Muse Image — verify API contract. Use mask as visual proof first, edit via text instruction. Don't claim measurements.

## 6. UI Tools Used & Why PNG Is Enough

- Hand-drawn paper sketch -> Uizard free (sketch to design) -> exported PNG New_Screen.png -> fixed in Uizard edit to New_Screen_1.png (footer centered). Figma export is paid feature in Uizard, not needed.
- Uizard gave 3-column layout which is better than paper 2-column — keep it.
- curated.design: free to browse inspiration, pro sections (hero, pricing) paid ~$15/mo. Not needed, use for reference only. Alternatives free: Mobbin, Refero, Godly.
- Figma free used for font check: select all text -> search Gentium Book Plus -> add.
- Kimi can build from PNG — vision models parse layout, no need for .fig file.

## 7. Implementation Phases

**Phase 0 — Now until credits (free):**
- UI shell landing + studio from PNG, shadcn, Gentium link, toggle, name modal localStorage, sample images, before/after slider mock, loading skeletons.

**Phase 1 — Once credits arrive (~28 Oct):**
- Wire /api/plan with Spark JSON, test one SAM call with "chair", one Image edit with safe sample.

**Phase 2 — Make it more than wrapper:**
- Mask overlay, checklist, refine loop, error handling, cost guard n=1, 5 gens/session limit.

**Phase 3 — Stretch:**
- Voice input via Voice Transcribe, history, optional single-plane WebXR preview (no headset needed for preview, but immersive needs headset — skip if no device).

## 8. Security & Costs

- Keys in .env.local, never in frontend. Server routes only.
- Log model IDs in README for judges.
- Cost estimates: full loop ~$0.0132 (Spark $0.001 + SAM $0.0025 + Image $0.01). Mock until credits.

## 9. Submission Checklist for Kimi Output

- [ ] Gentium Book Plus enforced via link + tailwind
- [ ] Footer is full-width centered, not side card
- [ ] No sign-in, name modal localStorage
- [ ] Dropzone, input, Magic button with glow #F1FF5E
- [ ] Light/Dark toggle functional
- [ ] Samples clickable -> loads into canvas
- [ ] Before/after slider
- [ ] /design/New_Screen_1.png committed to repo
- [ ] README mentions Meta models and topology

## 10. Reference Files to Give Kimi

- This file
- Hackathon Details file
- New_Screen_1.png (fixed wireframe)
- New_Screen.png (first export for comparison)
- Original paper sketch design-nook-shift.jpg if you want

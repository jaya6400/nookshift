# NookShift

**See First, Analyze the Feel, Then Change.**

NookShift helps renters explore room redesigns from a photo and a text prompt, then compare the original with a generated proposal.

## Quick Links

- Deployed Website: _Coming soon_
- Demo Video: _Coming soon_
- [Architecture and implementation status](docs/NookShift-Architecture.md)

## Features

- Upload a room photo or choose a sample; uploads are compressed client-side to a 1024px WebP.
- `muse-spark-1.3` creates a structured redesign plan. Live `/api/plan` HTTP 200 logs and a sofa-removal test were reported for this audit.
- `sam-3.1` box parsing and labeled target markers are present. Pixel masks are not rendered yet; the visible markers do not by themselves prove live SAM output.
- `muse-image-1.0` is wired for image edits and was reported live-verified through API logs. The generated proposal and before/after slider are shown in the supplied screenshots.
- Edit operations can be changed and resubmitted. Save Edit stores results locally, and Saved Edits appears on the landing page.
- Browser speech recognition is implemented; Meta voice transcription is not integrated, and interim-result behavior still needs work.
- No sign-in; the display name is stored in local storage. Gentium Book Plus and the `#1C0770` primary color are used.
- The landing catalogue currently uses three static sample cards. A carousel, Help, and Upvote are planned additions.
- The footer is currently a full-width banner; its copy/link still needs to change to “Built by Indie Dev,” with “Indie Dev” as the LinkedIn link.

See the architecture document for the detailed feature-by-feature status and remaining work.

## Tools Used

- Next.js 14 App Router, TypeScript, Tailwind CSS, and Framer Motion
- Wispr Flow and Visual Studio Code
- Meta models: `muse-spark-1.3`, `sam-3.1`, `muse-image-1.0`; `muse-voice-transcribe-1.0` is not integrated
- Kimi for scaffolding
- Meta AI for brainstorming
- ChatGPT for research
- UI Wizard (Uizard) for wireframes

## Screenshots

Local screenshots: [Screenshot 124](docs/screenshots/Screenshot%20(124).png), [Screenshot 125](docs/screenshots/Screenshot%20(125).png), [Screenshot 126](docs/screenshots/Screenshot%20(126).png), [Screenshot 127](docs/screenshots/Screenshot%20(127).png).

_Deployed-site and demo-video screenshots/links will be added when available._

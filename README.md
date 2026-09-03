# Handoff: VIDORA AI — Director, Storyboard, Character Lock, Ad Studio (mobile)

## Overview
A mobile-web feature expansion for VIDORA AI, an AI video generation platform that today has Text-to-Video and Image-to-Video modes. This design adds a third mode — **VIDORA Director** — plus the production surfaces around it: Idea/Script → plan → storyboard → scene editor → credit confirmation → background generation → final cut, with finishing studios (Voice, Captions, Social Auto-Format, Remix, Extend), Character Lock, Ad Studio, Template Library, and Projects with version history.

The expansion is strictly **additive**: Text → Video and Image → Video remain as-is in the mode switcher; Director is a third tab. No existing screen is replaced.

## About the Design Files
`VIDORA AI Director.dc.html` is a **design reference created in HTML** — an interactive prototype showing intended look and behavior. It is not production code to copy. It is a self-contained streaming-component file (`support.js` is its runtime; open the `.dc.html` directly in a browser to click through it).

The task is to **recreate these designs in VIDORA AI's existing environment** — its React/Next (or whichever) component library, router, and styling system — using established patterns. Do not port the HTML or `support.js` into the app. Where VIDORA AI already has a button, sheet, chip, or card component, use it and match the visual spec below.

## Fidelity
**High-fidelity.** Colors, typography, spacing, radii, and interaction states are final and exact. Recreate pixel-perfectly at a 390 × 844 mobile viewport (the frame in the prototype is device chrome — not part of the UI). Imagery is deliberately placeholder: every diagonal-striped block is where real video frames, product photos, or character reference images go.

## Design Tokens

### Color
| Token | Value | Use |
|---|---|---|
| `bg` | `#0A0B0D` | App background, header, tab bar (headers/tab bar at 92–94% alpha + `backdrop-filter: blur(14px)`) |
| `surface` | `#14161A` | Cards, sheets, list rows |
| `surface-raise` | `rgba(255,255,255,.04)` | Secondary buttons, inputs |
| `surface-raise-hover` | `rgba(255,255,255,.10)` | Secondary button hover |
| `border` | `rgba(255,255,255,.08)` | Card borders |
| `border-strong` | `rgba(255,255,255,.12)` | Secondary button borders |
| `divider` | `rgba(255,255,255,.06)` | Header/footer rules, in-card dividers (inner rows `.045`–`.05`) |
| `text` | `#F2F4F5` | Primary text |
| `text-muted` | `rgba(242,244,245,.45)` | Subtitles, meta |
| `text-dim` | `rgba(242,244,245,.35)` | Section labels, disclaimers |
| `accent` | `#00D5A0` | Primary actions, active state, generation state |
| `accent-hover` | `#4EE8BE` | Primary button hover |
| `on-accent` | `#04120E` | Text on accent fills |
| `accent-tint` | `rgba(0,213,160,.08–.12)` | Selected chip / soft button fills |
| `accent-line` | `rgba(0,213,160,.30–.45)` | Selected chip / soft button borders |
| `warn` | `#F5C042` | "Needs review", conflicting-prompt suggestion |
| `danger` | `#FF6B5B` | Delete hover only |

Page backdrop behind the device: `radial-gradient(120% 80% at 50% 0%, #12161A 0%, #07080A 60%)` — prototype scaffolding, not app UI.

### Typography
Family: `"Helvetica Neue", Helvetica, Arial, sans-serif`. Monospace (`ui-monospace, Menlo, monospace`) for numerics only: credit balance, scene numbers `01`–`04`, timecodes, resolutions, version labels, readiness score.

| Role | Size / weight / tracking |
|---|---|
| Home hero | 26px / 600 / `-.03em` / line-height 1.15 |
| Screen title (header) | 15px / 600 / `-.01em` |
| Header subtitle | 10.5px / 400 |
| Section label | 11px / 400 / uppercase / `.12em` tracking |
| Card title | 13–13.5px / 600 / `-.01em` |
| Card body | 11.5–12.5px / 400 / line-height 1.45–1.55 |
| Chip / small button | 11–12px / 600 |
| Primary CTA | 13–14px / 700 |
| Sheet title | 17px / 600 / `-.02em` |
| Mono meta | 9–11px |

### Spacing, radius, motion
- Screen padding `14–18px`; card gap `9–11px`; chip gap `7px`; grid gap `9–10px`.
- Radii: chips/pills `full` (15–17px on 30–34px height), inputs & small cards `11px`, cards `14–16px`, hero prompt box `18px`, bottom sheet `24px 24px 0 0`, device `52px`.
- Heights: header `60px` (under a `52px` status bar), bottom tab bar `78px`, primary CTA `46–48px`, secondary `38–42px`, chips `30–34px`, row buttons `36px`.
- Motion: screen enter `vup` — `opacity 0→1, translateY(10px→0)`, `.3s ease`, plan card `.35s` with `60ms` delay; sheet `.2s ease`; spinner `1s linear infinite`; progress bar `width .4s ease`.
- No shadows inside the app UI (only the device mock has one). Depth comes from surface + 1px border.

## Screens / Views

### 1. Create (Home) — `screen: "home"`
**Purpose:** enter an idea and choose the generation mode.
- Hero: "What are we making today?" (two lines) + "Type an idea. Director handles the rest."
- **Mode switcher** — segmented control, 4px padding inside a `rgba(255,255,255,.045)` track, 38px tall segments, `11px` radius: `Text → Video` · `Image → Video` · `Director`. Active = accent fill + `#04120E` text; inactive = transparent + `rgba(242,244,245,.55)`. Changing mode swaps the placeholder idea text. **Text and Image modes are the existing product — wire them to today's flows.**
- **Prompt card** — 18px radius, `rgba(0,213,160,.22)` border, `linear-gradient(180deg, rgba(0,213,160,.06), rgba(255,255,255,.02))`, 66px min text area. Footer row: `✦ Prompt Magic` and `Character` secondary chips (hover → accent border/text), and primary `Direct it →`.
- **Suggestion chips** (horizontal scroll): "Advertise my restaurant", "Property walkthrough", "Founder intro" → open Director prefilled.
- **Studios** 2-col grid: Ad Studio ("Product photo → advert"), Script → Video ("Paste, auto-split scenes"), Character Lock ("3 saved characters"), Templates ("9 categories"). Each: 30px icon tile, 26px gap, title 13.5px/600, meta 11px. Hover → accent border.
- **Continue** horizontal card row (132px wide, 88px thumbnail): "Aurora Skincare · 4 scenes · v3" → Final cut; "Lagos Bistro · Draft · not charged" → Storyboard. "All projects" link → Projects.

### 2. VIDORA Director — `screen: "director"`
**Purpose:** turn one sentence into an editable production plan.
- Chat column, 12px gap. User bubble: right-aligned, max 80%, accent fill, `#04120E` text, radius `16 16 4 16`. Director bubble: 26px "V" avatar (accent tint tile) + bubble `#14161A`, 1px border, radius `16 16 16 4`, max 88%.
- Director asks for the missing creative details (subject, location, time of day, mood, camera, lighting, style, action) as **answer chips** indented 35px: "Skincare serum", "Marble studio", "Golden hour", "Slow & elegant", "Add my character". Picking any chip advances to step 2 and marks that chip selected (accent tint + accent border).
- Step 2 reveals a stated-assumptions bubble, then **Your Video Plan** card: header ("4 scenes · 24s · luxury · 9:16" + mono `DRAFT` badge), then 4 tappable scene rows — mono number, name, one-line description, `edit` affordance, row hover `rgba(255,255,255,.03)`. Rows: Introduction, Main Action, Cinematic Highlight, Final Scene. Footer: `Revise` (secondary) + `Open storyboard` (primary).
- Below the card, the non-destructive note: "Nothing is charged yet. Credits are only estimated once you generate from the storyboard."

### 3. Storyboard — `screen: "storyboard"`
**Purpose:** review and edit the whole production before spending credits.
- Context chips row: "Sarah locked" (accent), "9:16 · 24s", "Luxury".
- **Scene card** (repeat ×4): 104px striped thumbnail column showing mono scene number top / duration bottom; body with name, description, and three mono meta chips (camera / motion / duration on `rgba(255,255,255,.05)`); action row of three equal 36px buttons divided by 1px rules — `Edit`, `Regenerate` (hover accent), `Delete` (dim, hover `#FF6B5B`).
- `+ Add scene` — full-width 44px dashed button, hover accent.
- **Floating CTA below the screen:** `Generate · est. 48 credits` pill (44px, accent tint, accent border) — present on Storyboard and Scene editor. Opens the credit sheet. In production this is a fixed bottom bar above the tab bar.
- Reorder is specified as drag-and-drop on the scene card (not prototyped).

### 4. Scene editor — `screen: "scene"`
**Purpose:** edit one scene without regenerating the video.
- 150px reference frame (striped, mono caption).
- **Prompt** card (13px/1.5 text), then **readiness strip**: accent-tinted, "Prompt Readiness: High" + "Lighting, camera and subject are all specified." + `✦ Magic` button.
- **Camera Director** — 2-col grid of ten 40px options: Wide Shot, Close-up, Medium Shot, Over-the-Shoulder, Low Angle, High Angle, Tracking Shot, Dolly Shot, Orbit Shot, Drone Shot. Single-select; selection propagates to the storyboard's scene-02 camera chip.
- **Character Lock** row: 38px striped avatar, "Sarah · Locked · 3 reference frames", `Change` → Character Lock screen. Followed by the honesty note: "Your current provider supports reference frames but cannot guarantee exact likeness across scenes."

### 5. Character Lock — `screen: "character"`
- Saved characters (Sarah / Chef Dami / Narrator) with 46px striped avatar, name, description, and a `Lock` / `Locked` toggle button (selected = accent tint + accent border, label "Locked").
- **New character** dashed 16px-radius panel: name input (38px), description textarea (66px, placeholder "Appearance, clothing, hair, personality…"), three square 1:1 striped reference-image drop slots with `+`, then `Save character` primary.
- Provider capability must be surfaced here too: disable/annotate reference upload when the selected provider doesn't support it.

### 6. Ad Studio — `screen: "ad"`
- Product row: 74px striped product thumb, "Aurora Serum 30ml", "1 image · background removed", `Replace image`.
- **Advert style** chips, single-select: Luxury, Modern, Social Media, Cinematic, Minimal, E-commerce, Product Launch.
- **Concept card** titled "Concept · {style}" with a generated concept paragraph, plus two inset blocks (`rgba(255,255,255,.035)`, 11px radius) labelled `VOICE-OVER` and `CAPTION` with the generated lines.
- `Approve → storyboard` primary. Nothing generates until approval.

### 7. Script → Video — `screen: "script"`
- Pasted-script card (12.5px/1.6 body), mono meta "213 chars · ~18s read", `Split into scenes` primary.
- **Detected scenes** rows: 52×40 striped thumb, scene name, and the quoted script line that produced it. Tapping a row opens the Scene editor — editing one scene must not regenerate the others.

### 8. Template Library — `screen: "templates"`
2-col grid of nine cards (96px striped preview with mono ratio label, name, "n scenes · Ns"): Product Advert, Restaurant Promo, Real Estate Tour, Business Intro, Motivational, Educational, YouTube Short, Social Promo, Event Promo. Opening a template creates a **new** draft — never overwrites current work.

### 9. Prompt Magic — `screen: "magic"`
- Score ring: 62px `conic-gradient(#00D5A0 0 82%, rgba(255,255,255,.08) 82% 100%)` with a 48px `#0F1215` inner disc holding mono `82`. Beside it: "Prompt Readiness: High" and the disclaimer "A score of the prompt's detail — not a promise about the result."
- **Suggestions** list: 22px square tag tile (`+` accent, `!` warn), title, body, `Apply` button. Suggestions are advisory — applying is always an explicit tap.

### 10. Credit sheet (modal) — `sheet: true`
Bottom sheet over `rgba(0,0,0,.6)` scrim, 24px top radius, 36×4 grab handle. "Estimated 48 credits" + "4 scenes × 6s at high quality. Balance 1,240 → 1,192 after generation." Detail table: Provider "Available · primary", Queue "~2 min", Failed scenes "Not charged" (accent). `Confirm & generate` primary, `Cancel` ghost. Scrim tap dismisses.

### 11. Generating — `screen: "generating"`
80px spinner ring (2px track, accent top), "Generating 4 scenes", "Runs on our servers — you can close the app. We'll notify you when it's done.", 6px progress bar, and a mono status line cycling: `Scene 1 of 4 · queued` → `Scene 2 of 4 · rendering` → `Scene 3 of 4 · rerouted to backup` → `Assembling final cut`. Footer card: "Held: 48 credits · charged only on delivered scenes. Scene 3 was rerouted to a backup provider by Smart Router." Prototype advances every 260ms / +9%; production drives it from job status. Credit balance drops 1,240 → 1,199 on completion (41 charged, not the 48 held).

### 12. Final cut — `screen: "result"`
- 300px striped player with a 56px play button and mono "final cut · 9:16 · 24s".
- Title "Aurora Skincare — Luxury", "v3 · 4 scenes · 41 credits used", `History` → Projects.
- **Finish** 2×2 grid: Voice Studio ("Amara · EN-NG"), Captions ("Bold Social"), Formats ("5 aspect ratios"), Storyboard ("Edit one scene").
- **Remix · keeps the original** chips: More Cinematic, More Realistic, More Energetic, Different Camera, Different Weather, Different Time of Day, Different Style — each creates a **new version**, never mutating the source.
- `Continue this video →` (accent-tint CTA) + "Extension continues motion and style where the provider supports it — continuity isn't guaranteed."

### 13. Social Auto-Format — `screen: "formats"`
Intro: "Reframed with subject-aware composition, not a blind crop. Review each before export." Rows with true-proportion striped previews (52px tall; widths 30px vertical, 92px landscape, 52px square): TikTok Vertical, Instagram Reels, YouTube Shorts (1080×1920), YouTube Landscape (1920×1080), Square Post (1080×1080). Multi-select `Add` / `On` toggles (default: TikTok Vertical + YouTube Shorts). `Export selected` opens the credit sheet.

### 14. Voice Studio — `screen: "voice"`
Voice rows (Amara EN-NG warm female / Kwame EN-GH deep male / Lena EN-US bright female / Noor AR calm female): 34px circular preview `▶`, name, meta, `Preview` / `Using` button. Controls card: **Speed** slider (4px track, 14px accent thumb at 47%, mono `0.95×`) and **Tone** 3-way (Warm / Neutral / Bold). Footer: "Replacing the voice does not regenerate the visuals — no video credits charged."

### 15. Captions Studio — `screen: "captions"`
Style chips (Professional, Cinematic, Bold Social, Minimal, Educational), a 160px striped preview with a live caption chip (`rgba(0,0,0,.65)`, 14px/800, uppercase), then editable cue rows: mono timecode (accent) + text + `edit`. Cues: `0:00` "Some mornings deserve more", `0:04` "than water.", `0:11` "Aurora Serum — 30ml", `0:19` "Now in stock." Footer: `+ Language` (secondary) and `Save captions` (primary).

### 16. My Projects — `screen: "projects"`
Project rows (62px striped thumb, name, meta, status badge): Aurora Skincare `READY` (accent), Lagos Bistro `DRAFT` (neutral), Ikoyi Duplex Tour `NEEDS REVIEW` (warn — "scene 4 failed, refunded"), Founder Intro `ARCHIVED`. Below: **Version history · Aurora Skincare** card — `v3` "Voice replaced with Amara" (`Current`), `v2` "Scene 3 regenerated · orbit" (`Restore`), `v1` "First generation from Director plan" (`Restore`). Restore must never destroy the newer version.

### Global chrome
- **Header (60px):** back button (32px, 10px radius, hover `rgba(255,255,255,.1)`), title + subtitle per screen (see table below), and a **credit pill** — 28px, accent border/tint, 5px accent dot, mono balance.
- **Bottom tab bar (78px):** Create · Projects · Templates · Studio. 16px icon shape (square for the first three, circle for Studio) — active gets accent stroke + `rgba(0,213,160,.25)` fill and accent label; inactive `rgba(242,244,245,.35)`.

| screen | title | subtitle |
|---|---|---|
| home | VIDORA AI | Director ready |
| director | VIDORA Director | Building your plan |
| storyboard | Storyboard | Aurora Skincare · draft |
| scene | Scene 2 · Main Action | Hero product reveal |
| character | Character Lock | Reuse a face across scenes |
| ad | Ad Studio | Product → advert |
| script | Script → Video | Paste, split, generate |
| templates | Template Library | 9 categories |
| magic | Prompt Magic | Readiness 82 / 100 |
| generating | Generating | Runs in the background |
| result | Final cut | Aurora Skincare · v3 |
| formats | Social Auto-Format | One cut, five ratios |
| voice | Voice Studio | Preview before you commit |
| captions | Captions Studio | Auto transcript · editable |
| projects | My Projects | Autosaved · versioned |

## Interactions & Behavior
Primary flow: **Home → `Direct it →` → Director → tap an answer chip → plan appears → `Open storyboard` → `Edit` a scene → `Generate` → credit sheet → `Confirm & generate` → Generating → Final cut.**

Other navigation: studio tiles → Ad Studio / Script / Character / Templates; `✦ Prompt Magic` → Prompt Magic; Final cut finish tiles → Voice / Captions / Formats / Storyboard; any Remix chip or `Regenerate` → Generating → Final cut; tab bar → Create / Projects / Templates / Studio(Final cut); back button → Storyboard from Scene, otherwise Home.

States to implement: chip/segment selected, button hover (border → accent, text → accent; primary → `#4EE8BE`), row hover tint, delete hover red, sheet open/scrim dismiss, generation progress, empty states (no projects / no characters — not drawn, use the same card language with a dashed panel), and failure state (see `NEEDS REVIEW` badge + refunded copy).

Behavior rules carried from the brief and expressed in the UI:
1. Nothing is charged before the credit sheet is confirmed; the sheet is the only path to spend.
2. Failed scenes are not charged; held ≠ charged (48 held, 41 charged).
3. Remix and Extend always create a new version; the source video is preserved.
4. Templates create new drafts; they never overwrite current work.
5. Provider limitations are stated inline (Character Lock, Extend) — never claim guaranteed likeness or continuity.
6. Prompt Magic scores prompt detail only, and never edits without an explicit `Apply`.
7. Generation is server-side and survives closing the app.
8. Voice/caption changes don't re-spend video credits.

Accessibility: every tap target ≥ 44px on primary CTAs and rows (chips are 30–34px tall but ≥ 60px wide with generous hit padding — pad to 44px in production), visible focus rings using `accent-line`, labels on all icon-only controls (play, back, reference-image slots), and `prefers-reduced-motion` should disable `vup`, the spinner rotation, and the progress transition.

## State Management
Single view-model in the prototype:
```
screen        one of the 15 keys above
mode          "Text → Video" | "Image → Video" | "Director"
chat          1 | 2   (Director step; 2 reveals the plan)
answerPicked  selected Director answer chip
cam           selected camera shot (default "Dolly Shot")
adStyle       selected advert style (default "Luxury")
cap           caption style (default "Bold Social")
voice         voice name (default "Amara")
char          locked character (default "Sarah")
fmt           string[] selected export formats
sheet         boolean — credit sheet open
prog          0–100 generation progress
credits       balance string ("1,240" → "1,199")
```
In production these split across: a router (screen), a project/draft entity (scenes, camera, character, style, versions), a job entity (progress, provider, held credits), and account state (balance). Data needs: draft autosave on every scene edit, job polling or websocket for progress, notification on start/complete/fail/low-credits, and a version record per major change.

## Assets
None shipped. Every diagonal-striped block is a placeholder — `repeating-linear-gradient(115deg, #1B1F24 0 8px, #171A1F 8px 16px)` (10px/20px stops on the large player) with a mono label naming what belongs there (`frame 01`, `storyboard`, `product`, `9:16`). Replace with real thumbnails, product photos, and character reference frames. Icons in the prototype are geometric placeholders (squares, circles, rotated squares, a CSS play triangle) — **use VIDORA AI's real icon set**, do not ship these. Fonts are system Helvetica; if VIDORA AI has a brand typeface, use it and keep the scale above.

## Files
- `VIDORA AI Director.dc.html` — the interactive prototype (all 15 screens + credit sheet). Open in a browser and click through.
- `support.js` — prototype runtime only. Not for production.

# Track Toolkit logo prompts

Prompts to hand to a design agent for the Track Toolkit mark and wordmark.
Paste Prompt 0 in front of every other prompt: it carries the colors, the
constraints and the transparency requirement. Prompts 1-4 are independent and
can go to separate runs.

If the agent is a pure image generator (no SVG output), add to every prompt:
"Output a PNG with a real alpha channel. Do not paint a checkerboard, white,
or any background pixels. I will verify transparency by placing the file on a
dark navy surface." Then check the result yourself; most image models fake
transparency.

---

## Prompt 0 — shared brief (prepend to every prompt)

You are designing the visual identity for **Track Toolkit**, a free web app for
SoundCloud power users. It does the bulk work SoundCloud's own site cannot:
merge playlists and split them at the 500-track cap, remove blocked or dead
tracks, bulk unlike, bulk unfollow, bulk remove reposts, turn likes into
playlists, and resolve SoundCloud links into metadata. The audience is DJs,
curators and collectors with libraries in the thousands. The tone is
practical, precise and a little industrial: a well-made tool, not a music
brand and not a streaming service.

The product used to be called "SC Toolkit" and used SoundCloud's own cloud
logo. That is being replaced because SoundCloud's API terms forbid using their
name or logo as an app's identity. The new mark must be unmistakably its own.

**Hard constraints, all non-negotiable:**

- No cloud shape of any kind. No cloud silhouette, no cloud outline, no
  "cloud made of bars".
- No row of vertical bars that rise in height from left to right. That is the
  left half of SoundCloud's logo. Vertical bars of any kind are off-limits.
- No headphones, musical notes, vinyl records, speakers, play triangles,
  or equalizer glyphs. These are generic music clichés.
- No gradients inside the mark. Flat fills only, so it reproduces at 24 px and
  as a single-color stamp.
- No text inside the icon mark. The wordmark is a separate asset.
- Every deliverable that is a logo must have a **fully transparent
  background**. No white, no cream, no checkerboard, no drop shadow, no
  glow. The only pixels in the file are the mark itself.

**Colors. Use exactly these values and no others:**

| Role | Hex | Where it is used |
|------|-----|------------------|
| Brand orange (primary) | `#FF5500` | The mark's main fill. This is the app's primary color everywhere. |
| Orange deep | `#E64A00` | Optional second flat tone inside the mark for one accent element, e.g. the offset bar. Never as a gradient. |
| Ink (navy) | `#0F1729` | Wordmark text on light backgrounds. Monochrome mark on light backgrounds. |
| Paper (cream) | `#F8F7F5` | The app's light-mode page background. Use it only to *preview* the mark, never inside a logo file. |
| Night (dark navy) | `#0E121A` | The app's dark-mode page background. Preview only, never inside a logo file. |
| White | `#FFFFFF` | Monochrome mark and wordmark text on dark backgrounds. |

Orange is kept deliberately: it signals "works with SoundCloud". The
differentiation comes from the shape, not from the color, so the shape must
carry all of it.

**Typography:** the wordmark uses **Space Grotesk**, weight 600 (SemiBold).
It is the app's display font already. Do not substitute another geometric
sans. If Space Grotesk is unavailable, stop and say so rather than
approximating it.

**The mark concept, "stacked tracks":** three or four horizontal bars with
fully rounded ends, of different lengths, stacked with even vertical gaps,
like rows in a playlist. One bar is treated differently to tell the product's
story: either it is broken into two pieces with a small gap (a playlist being
split at the cap) or it is shifted sideways out of alignment (a track being
moved). That single irregular bar is the whole idea. Keep everything else
plain. The result should read as "a list of tracks, and one thing being done
to it", and must be legible at 24 px.

Deliver vector SVG as the source of truth for every logo asset. Export
rasters from the SVG. Report the exact pixel bounds of the mark inside each
raster so I can check the safe zone.

---

## Prompt 1 — icon mark (square, transparent)

Design the Track Toolkit **icon mark** following the shared brief above.

Produce:

1. `mark.svg`: the mark alone, orange `#FF5500` (with `#E64A00` on the one
   irregular bar if you use a second tone), on a transparent canvas. Square
   viewBox. No background rect.
2. `mark-white.svg` and `mark-ink.svg`: the same geometry as a single flat
   fill in `#FFFFFF` and `#0F1729`. These are the monochrome versions for dark
   and light surfaces.
3. `icon-512.png`, `icon-192.png`, `icon-180.png`: exported from `mark.svg`
   with a transparent background. The 512 file is used as an Android
   "maskable" PWA icon, so the mark must sit inside the central 80% of the
   canvas (a circle of diameter 410 px centered on the 512 canvas must fully
   contain it). The 180 file is the Apple touch icon.
4. `icon-24.png`: a 24 px export. Look at it. If the gaps between bars close
   up or the irregular bar stops reading, increase the gaps and bar thickness
   in the SVG and re-export everything.

Rules for this mark specifically:

- Bars are horizontal only. Rounded end caps, radius equal to half the bar
  height.
- Bar thickness between 18% and 22% of the canvas width; gaps between bars
  between 8% and 12%. Three bars preferred, four at most.
- Total mark height and width should be within 10% of each other so it
  fills a square evenly.
- Nothing else in the file. No frame, no rounded-square tile, no text.

Show me a contact sheet (a separate preview PNG, not a logo asset) with the
mark at 512, 64 and 24 px on `#F8F7F5` and on `#0E121A`, so I can judge it
on both app themes.

---

## Prompt 2 — horizontal wordmark (transparent)

Design the Track Toolkit **horizontal wordmark** following the shared brief
above, using the icon mark from Prompt 1 unchanged. Do not redesign the mark.

Layout: mark on the left, the words "Track Toolkit" on the right on one line,
in Space Grotesk 600. Both words the same weight, same size, same color; do
not emphasize one word over the other. Cap height of the text equals roughly
65% of the mark's height. Gap between mark and text equals the height of one
bar. Letter-spacing slightly tight, around -0.01 em. The text and mark are
vertically centered on each other.

Produce three color versions, each on a fully transparent canvas with the
canvas cropped tight to the artwork plus a padding of one bar-height on every
side:

1. `wordmark.svg` and `wordmark.png` (PNG 1200 px wide): mark in `#FF5500`,
   text in `#0F1729`. This is the light-theme version.
2. `wordmark-dark.svg` and `wordmark-dark.png`: mark in `#FF5500`, text in
   `#FFFFFF`. Dark-theme version.
3. `wordmark-mono-white.svg` and `wordmark-mono-ink.svg`: mark and text both
   in a single color, white and `#0F1729` respectively, for one-color uses.

Also produce `wordmark-28.png`: the light-theme wordmark exported at exactly
28 px tall, width auto. This is the size the app's sidebar renders it at, so
check that "Track Toolkit" is still legible and the mark's gaps are still
open. If not, adjust the text size or tracking in the SVG and re-export.

Convert the text to outlines in the SVG files so they render without the
font installed.

---

## Prompt 3 — stacked wordmark and monochrome stamp (transparent)

Following the shared brief, produce two secondary lockups from the Prompt 1
mark and the Prompt 2 typography. Do not change either.

1. **Stacked lockup**, `wordmark-stacked.svg` and a 1024 px PNG: mark
   centered above the text, text on one line, "Track Toolkit" in Space
   Grotesk 600, `#0F1729`, mark `#FF5500`. Text width roughly 1.6 times the
   mark's width. Vertical gap equals one bar-height. Transparent background,
   tight crop with one bar-height of padding. Provide a `-dark` variant with
   white text.
2. **Monochrome stamp**, `stamp-white.svg` and `stamp-ink.svg`: the stacked
   lockup as one flat color, for watermarks, favicons and printed use.

Confirm in your reply that every SVG has no `rect`, `background` or fill on
the root element, and that every PNG's alpha channel is 0 outside the
artwork.

---

## Prompt 4 — social card (not transparent)

This is the one asset that is *not* transparent. Following the shared brief,
produce `og-image.png`, 1200 x 630 px, for link previews on X, Discord,
Slack and iMessage.

- Background: solid `#0E121A`. No gradient, no texture, no photo.
- Left third: the Track Toolkit horizontal wordmark from Prompt 2, dark-theme
  version (orange mark, white text), sized so the wordmark is 480 px wide,
  left-aligned 96 px from the left edge, vertically centered.
- Below the wordmark, one line in Space Grotesk 500, `#FFFFFF` at 70%
  opacity, 28 px: "Bulk playlist, like and follow management for SoundCloud."
- Right half: a single abstract illustration built only from the mark's
  vocabulary, horizontal rounded bars in `#FF5500` and `#E64A00` on the dark
  background, arranged like a long playlist that has been split into two
  numbered groups. No clouds, no vertical bars, no music iconography.
- Keep all text inside a 1120 x 550 safe area centered on the canvas, since
  some platforms crop the edges.

Provide the layered SVG or source file alongside the PNG so the tagline can
be edited later.

---

## Where the results go

Paths are fixed by a standing decision (2026-09-10): replace the images in
place, do not rename the files, because the app and the Chrome extension
reference these paths verbatim.

| Deliverable | Replaces |
|-------------|----------|
| `icon-512.png` (transparent) | `frontend-UI/public/SC Toolkit Icon.png` and `.webp` |
| `wordmark.png` light theme (transparent) | `frontend-UI/public/sc toolkit transparent .png` and `.webp` |
| `og-image.png` | the `og-image.png` referenced in `frontend-UI/src/app/layout.tsx` (not currently in `public/`) |
| all `.svg` sources | new folder `frontend-UI/public/brand/` |

Before swapping, check the transparent PNGs on both `#F8F7F5` and `#0E121A`,
because the sidebar renders the same file in both themes.

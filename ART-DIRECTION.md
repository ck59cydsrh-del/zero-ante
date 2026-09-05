# Liquid edition

The supplied reference informed cobalt ink, tactile paper, generous negative space,
and restrained editorial labels. The artwork is original, with no copied text or marks.
Cards remain discrete pixel shapes. Essential controls and figures sit on opaque surfaces.

## Artwork

Asset: `ink-art.png`, generated with the built-in image generation tool.

Prompt: “Create a finished original raster background asset for an editorial poker game,
landscape 1536x1024. Bone white cold paper, deep cobalt blue ink only. One very large
abstract flowing spade silhouette dissolving into liquid ink, soft oversprayed edges and
fine speckled print grain, high quality experimental contemporary Swiss graphic design.
Intensely blue organic spade-like fluid forms occupying left third and far right edge,
central 45 percent predominantly empty white with subtle grain for game cards overlay.
No text, letters, logos, watermarks, cards or UI screenshots.”

## Verification

- Browser: six-player solo game, white/black toggle, preflop call and flop progression.
- Browser: two-player local handoff shows two backs before each reveal.
- Browser: local all-in and call expose five community cards; awarded pot returns to zero.
- Browser: reward selection layout checked in black mode.
- Eight automated checks against the shipped evaluator: categories, ace-low straight,
  no wraparound, suit equality, kicker order, full house, seven-card selection,
  and eight-card selection for the sixth-street variant.
- Action hide timer cancellation prevents stale timers hiding a newer action.
- Turn starts wait for queued announcements to finish.
- Community cards preserve their DOM nodes unless that slot changes, avoiding repeated
  deal animations when another card opens.

Browser checks are representative, not a complete proof of tournament-rule compliance.

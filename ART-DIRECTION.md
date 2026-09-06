# Circle table — current

Bold compact grotesk typography replaces the monospaced direction. White, vivid green
and orange follow the supplied festival reference without reproducing its artwork.
Seats orbit the green oval, relative to the current local viewer. Pixel cards remain.
Ability receipts now launch a source-to-target ray and target ring, with a short bold
banner. Reduced-motion mode omits the rays and rings.

## Previous minimal rhythm foundation

The active surface is now monochrome, unboxed and aligned like a sequencer: numbered
street steps, a small turn indicator, tabular chip counts and flat action keys. Pixel
cards retain red suits. Ability names stay English, descriptions Japanese. Results are
compact rows. Crucially the action pod inherits theme variables instead of overriding
them with the former green-table palette. Setup is a centered auto-height panel.

## Previous beginner clarity foundation

Circuit ornaments are removed. A continuous green table puts readable turn guidance above
the opponents and the player controls within the lower edge. Desktop pot and community
cards share a row, avoiding opponent overlap. Persistent results show winner, best five
cards and chip deltas. Japanese ability names describe their actions. Local names are
editable; a 600-chip stack and 25/50 blinds increasing every two hands accelerate play.
CHECK, FOLD, CALL, RAISE and ALL-IN each have a distinct optional synthesized cue.

## Earlier Overdrive foundation (circuit styling superseded)

The entire match now lives on one green circuit table. No separate sidebar: the player's
cards, stack, action receipt and English betting controls form the lower edge of the table.
The lower circuit is occluded behind controls to avoid drawing through text. Diamonds have
a narrow stepped silhouette; clubs use three separate lobes and a defined stem.

32 modules live in rogue.js, a browser/CommonJS engine shared by the UI and tests.
All participants earn a reward: winners draw tiers 2–3 and losers tier 1. CPU rewards use
the same pools; local human rewards are queued individually. Choice has no time limit.
Owned modules are excluded; exhausted pools convert to a stated chip bonus.

Effect receipts include source, target and actual result; installed module buttons expose
the description and last trigger. Information modules expose live readouts. Guard jamming
resolves first; human opponents are valid targets. All-in runout resolves street-by-street
so flop and river abilities execute. Rank rewriting explicitly permits five-of-a-kind.
This is a custom rogue variant, not a claim of complete official-tournament compliance.

Sound uses optional bounded-gain synthesis: short check tick, pitch-dropping attack bass,
and rising victory arpeggio. Win effects have longer hold, more particles and circuit bloom.
Reduced-motion preferences suppress particle movement; sound defaults OFF.

Automated verification: 48 tests, including all 32 module implementations, payout-side
effects, reward eligibility, jam/fog, once-per-hand triggers, all-in lock and rank variants.
Browser: loser COMMON selection, winner RARE selection, CPU jammer disabling both raise
and over-call all-in, and restoration at flop. Further QA is recorded in the handoff.

## Circuit edition — previous

The new references drive a PCB-green play surface with cream circuit traces around
its perimeter, a paper/black control panel, orange action emphasis, and bold editorial
type. The circuit geometry is original and contains no copied logo or text. Pixel suits
remain red/black. A single circuit.css replaces the previous layered production styles.

Actions occupy a reserved row beneath the hand, avoiding layout jumps. Betting sends
chips from the acting player to the pot; announcements pulse the circuit and significant
events emit a brief particle burst. Optional synthesized sound starts OFF. Reduced-motion
preferences suppress chip flight and particles and shorten other animations.

Validated: six-player solo call, two-player flop/all-in/uncontested award and reward
screen, 844 × 390 landscape controls, 1440 × 900 desktop, black/white and sound toggles.
Eight hand-evaluator checks pass. No browser console errors observed in the tested flow.
These checks do not establish full official tournament-rule compliance.

## Previous liquid edition (archived direction)

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

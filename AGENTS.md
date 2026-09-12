# Agent instructions

**Copyright (c) 2026 Martial Systems LLC.** MIT.

## Quality defaults

- **Code:** write and change code at the level of a top software architect with a PhD in computer science.
- **PDFs:** PhD / research-level register; no AI polishing (no fluff, marketing gloss, or generic LLM prose).
- **Prose / docs:** lists use colons; em dashes only for ironic cut-off/swerve (not for asides or polished rhythm). Do not glob-replace dashes with colons or hyphens; rewrite so the sentence still parses. Write from the data we have; no `What it is not` section except legal/T&C.
- **After create:** pass over again with the same rules; fix bugs; re-pass until clean (or residual risk is explicit).

Override only when the user asks for a sketch, prototype, or lower bar.

## Product

`fly_shell` is an empty chassis: 3D fly on a grid, neuron map, mapping table, plug slot. The default atlas uses FlyWire / MaleCNS type labels. The dense map is 141,781 MaleCNS v1 soma positions as one Points draw (`data/malecns_soma.bin`). Named cells without a soma stay schematic. Do not add one Mesh per soma. Rebuild the bin only with `scripts/pack_malecns_soma.py` and restamp the locked count in tests and README.

Claim bans (fail the public copy, not the mapping engine):

- Do not say the in-browser atlas is a 166k-cell reconstruction or a live whole-CNS LIF.
- Do not say a built-in adapter (walk, loom, sugar, cycle) is a connectome simulation. Adapters write named-cell rates. The map moves the body.
- Demo HUD text may name the cell (`jump  DNp01`). README and the page lede stay on the chassis.

`window.FlyShell` is the extension point. Keep `js/schema.js` and `js/mapping.js` DOM-free so `node --test` hits the production functions.

No GraphForge pin in this tree unless the operator says yes to those claim bans as fail-closed graph laws.

## Verify before done

Before reporting fixed, done, shipped, or ready to try:

1. In a git tree: fetch. If origin is ahead and the tree is clean, pull before editing. If origin is ahead and the tree is dirty: stash, commit, or report both; never discard or `reset --hard` to take the pull. If origin is not ahead and already edited: finish-later, do not discard.
2. Implement the change.
3. List every interaction path (entry points, modes, toggles, fallbacks, caches, mirrors, deploys, side effects, id assignment / merge / dedupe, time/state batching, prose surfaces, git). For UI, layout, nav, or in-page jumps: include phone-width (390x844) and desktop (~1280).
4. Check each path (for docs: scan decorative em dashes). Indirect verification is not verification: isolated unit tests, JSON-shape checks, and source-list counts do not prove the production path. Name the exact execution tool or script. If the repo has `vbd.runtime.json`, `vbd_gate` runs those argv commands on `--claim-done` and pre-push (not Stop, not pre-commit). Optional `paths` globs skip a command when the change set does not match. Phone-width must be a named command (`python3.12 scripts/viewport_sanity.py`), not a thought. Run `vbd_gate.py check --claim-done` so fetch, dashes, and skip-landing cannot be forgotten.
5. On failure, fix and recheck the full list. Promote general lessons to the VBD pack (`LESSONS.md`); do not leave them only in this repo. Skip when the lesson is unique to this product.
6. Push completed work unless the user asked to hold it. If you do not push, the Git line must say why.
7. End with the report section below.

```text
## Verify-before-done report
- What changed:
- Interaction map:
- Verified: (path → exact execution tool/script → pass/fail)
- Bugs found in verify pass:
- Git: fetched; origin ahead → pulled <sha> | no recent push; finish-later <paths> | pushed <ref@sha> | did not push: <reason> | not a git repo
- Promoted: <lesson → LESSONS.md / pack> | not promoted: <why>
- Residual risks:
```

Full rule set: https://github.com/martialsystems/verify-before-done

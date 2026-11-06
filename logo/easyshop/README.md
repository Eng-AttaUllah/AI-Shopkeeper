# EasyShop — Book-E logo

Second pass: the Open Ledger mark became an **E**, with a Geist SemiBold **EasyShop**
wordmark. Open **`preview.html`** to compare the three variants at real sizes, in a header,
and on a dark browser tab.

## Variants

| Tag | Name           | What it is                                                       |
| --- | -------------- | ---------------------------------------------------------------- |
| B1  | Spine-E        | Bold E, cut spine seam. Calmest and most versatile.              |
| B2  | Folded-E       | Middle arm sharpens into a page fold. Most distinctive.          |
| B3  | Spine-E + spark| B1 plus a small four-point spark. The assistant is in the icon.  |

The three arms are the page edges, the stem is the spine, and the cut line is the spine seam.
At 16px the seam disappears and a clean E remains.

## Files

- `concepts/` — standalone mark and squircle app tile for B1, B2, B3.
- `lockups/` — horizontal mark + wordmark lockup for each variant.
- `png/` — 512px previews and 1024px lockup previews.
- `preview.html` — before/after, size strips, header mock, dark tab.

## Wordmark

- **EasyShop**, Geist SemiBold (weight 600), 19px, tracking −0.02em, ink `#17181A`.
- The lockups are outlined SVG, generated from the same Geist variable font the app loads.
  In the app the wordmark is live text, so it stays crisp and selectable.
- Horizontal lockup: 32-unit tile, 8-unit visual gap, 48-unit canvas height.

## Construction

- 48-unit grid; squircle tile (9-unit corner, superellipse); flat fills only.
- Brand `#0F766E`, white `#FFFFFF`, ink `#17181A`, page `#F7F7F5`.
- No gradients, glows, or text inside the mark, so it survives the Pashto / RTL interface.
- Tested at 16 / 24 / 32 / 48 / 64 / 112 / 512px and on a dark tab.

## Next step

Pick **B1**, **B2**, or **B3**. The winner becomes:

- `src/app/icon.svg` and `src/app/apple-icon.png`
- a multi-size `src/app/favicon.ico`
- the header brand link and sign-in card (mark + live Geist wordmark)

The app rename from “AI Shopkeeper” to **EasyShop** is a separate follow-up unit, after the
mark is locked.

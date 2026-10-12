# Generation Workshop

Open **Tools → Generation Workshop**. Its controls are a movable, minimizable window; generated terrain appears in the main atlas or globe.

## Preview and apply

1. Choose a recipe, seed, and settings. Valid changes refresh a **180 × 91 draft after 600 ms** without saving anything.
2. Use **Compare three seeds** to generate three draft candidates sequentially. Select a thumbnail to inspect that candidate.
3. Use **Stages** to inspect Tectonics, Terrain, Erosion, Terrain edits, Climate, Water, Biomes, and Review. Optional disabled stages are marked **Skipped**. Climate offers temperature and rainfall views.
4. Choose **Generate final**. Intermediate stage frames remain limited to 360 columns; Review displays the chosen final resolution.
5. Review changed terrain around authored anchors. Acknowledge conflicts when prompted, then choose **Apply reviewed world**. Applying makes one undoable change and retains authored coordinates, elevations, locks, lore, caves, and eras.

**Return to world**, **Discard**, or closing the window cancels pending work and restores the committed view. Minimizing retains the displayed preview and suspends background work. Changing settings invalidates a previous final result. Save and project export always refer to the committed project; SVG chart export is disabled during preview.

Recipes are editable tendencies, not geological guarantees: Balanced, Archipelago, Continental World, Drowned World, and Highlands. Editing their settings displays **Custom**.

## Replace regional geography

Select **Replace region**, pick a center in the atlas, and set a radius from **1–2,500 km**. The boundary is visible before generation; its outer 20% is blended. The final resolution matches the committed raster so all elevation samples outside the boundary remain unchanged.

Regional replacement preserves the base terrain algorithm and reapplies existing authored terrain strokes. Climate, rivers, lakes, and biomes are recalculated globally and may change beyond the boundary. A region intersecting locked content is rejected; choose another region or return to the world and explicitly unlock the content first.

Applied regions are listed under **Saved regional replacements**. **Remove in preview** builds a removal proposal without changing the base seed or algorithm. Generate a final result, review it, and apply; removal is also undoable.

## Persistence and resource bounds

- Regional instructions use project **version 4** and are reproduced from ordered seeds, settings, geographic centers, radii, and `regional-geology-v1`.
- Versions 0–3 continue to load. Existing projects upgrade only when a regional replacement is applied; subsequent authoring preserves version 4.
- Up to **16** regional replacements fit within the existing **2 MB** project limit. Drafts, thumbnails, and stage buffers are not saved or exported.
- Only one generation worker is active per application document. Retained workshop preview buffers are capped at **64 MiB**; unselected results are released before exceeding the cap.
- Generation remains a deterministic worldbuilding heuristic rather than a validated physical simulation.

## Verification

The workshop has unit and browser coverage for stage-buffer independence, deterministic generation, regional boundaries and blending, lock protection, version 4 persistence, compressed import/export, offline reload, authoring after regional generation, removal, undo, stale-result rejection, comparisons, and cancellation.

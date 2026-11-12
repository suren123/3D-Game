# Curated Kenney Mini assets

Source: [Mini Shop 2.1](https://kenney.nl/assets/mini-shop) and [Mini Forest 1.0](https://kenney.nl/assets/mini-forest), by Kenney. CC0-1.0; the exact license texts are preserved beside the models.

Only seven relevant meshes are included. Original geometry, UVs, materials and node transforms are preserved; the original colormap PNG is embedded in each GLB to remove external image requests. `sources.json` records the official source page, archive path, hashes and byte counts.

Refresh with `python3 scripts/import_mini_assets.py --download`, then regenerate town landmarks with `node scripts/generate_models.mjs`. Expiring download URLs and cookies are not persisted. The Python importer uses the standard library.

`shop-shelf-boxes`, `shop-display-fruit`, and `shop-cash-register` appear in `../town-v2/shop.glb`. `forest-tent`, `forest-tree`, `forest-flag`, and `forest-stones` appear in `../town-v2/camp.glb`. The running game loads the two composite landmarks, avoiding duplicate preload of these standalone editing sources.

All files are GLB 2.0, Y-up. Dimensions and composition coordinates are recorded in `../../../docs/assets-and-licenses.md` and `scripts/import_mini_assets.py` in the repository.

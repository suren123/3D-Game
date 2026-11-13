# Toy town models

Regenerate with `node scripts/generate_models.mjs`. The original toy geometry is made offline, with beveled box edges and landmark badges. Original geometry is merged by material. No fonts, Blender or browser-time modelling are required.

`shop.glb` and `camp.glb` combine original town geometry with genuine Kenney Mini Shop 2.1, Mini Forest 1.0 and Nature Kit 2.1 meshes (CC0-1.0). Their original colormap PNGs are embedded inside each GLB. The other 14 GLBs contain original geometry and embedded material colours, with no external texture files. See `../kenney-mini/` for the selected source models, exact licenses and `sources.json` provenance. To refresh those source files from Kenney, run `python3 scripts/import_mini_assets.py --download` before regenerating.

GLB 2.0, Y-up; foundations sit at Y=0; building fronts face -Z; bus and tanker fronts face +Z. Existing location IDs and the world scale of 1.24 remain compatible. Shop measures 4.05 × 3.32 × 3.80 units (X/Y/Z), camp uses the isolated project base and the open Nature tent assembly recorded in camp-sources.json. Other buildings are approximately 3–4.5 units wide. All delivered resources work offline and require no Draco, Meshopt or additional image requests.

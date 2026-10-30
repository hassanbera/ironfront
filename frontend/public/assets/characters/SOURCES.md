# Animated character assets

Source: **KayKit Character Pack Adventurers 1.0**, Kay Lousberg, **CC0 1.0**.

- Official repository: https://github.com/KayKit-Game-Assets/KayKit-Character-Pack-Adventures-1.0
- Pinned source commit: `672074b73ba276876a19e8816ecdc5241817ab47`
- Models: `Knight.glb`, `Barbarian.glb`, `Rogue_Hooded.glb` in `addons/kaykit_character_pack_adventures/Characters/gltf/`.
- Original license: `LICENSE-KayKit.txt`. Original model hashes: `provenance.json`.

IRONFRONT uses the source body geometry, textures, socketed weapons and animations. Adaptations: smaller head proportions; faction-colored fabric; custom spear, bow, deforming bowstring and arrow geometry; arm posing for bow draw; seated lower-body poses for mounted attacks; 24 samples/second baked into half-float bone-matrix atlases. Skinned and rigid pieces retain their original bone/socket relationships. Near, medium and far body geometry use approximately 100%, 28% and 10% of the source triangles. The high-detail bodies contain 4,005–4,777 triangles.

These are derived assets. Source textures are extracted unchanged. `meshoptimizer` 1.0.1 (MIT) is a development-only simplification dependency and is not shipped in the game JavaScript.

To regenerate, place the three GLBs and the original `LICENSE.txt` in a local source directory, install frontend dependencies with `npm ci`, and run from the repository root:

```sh
node scripts/bake-characters.mjs /path/to/source-directory
node scripts/validate-character-assets.mjs
```

Only those source files are read. Generated `.json`, `.bin`, `.png` and provenance files are written to this directory. Commit generated assets together with converter changes; reload test clients after rebuilding the complete asset set.

# Animated character assets

The field armies use original fitted garments in `art/duel/field_kit.py`. Cloth, helmets, infantry mantles, wrapped headwear, quivers and spare javelins share the existing material maps and skeletons. Three mesh detail levels are baked per outfit. These meshes use the existing animation atlases unchanged.

Source: **KayKit Character Pack Adventurers 1.0**, Kay Lousberg, **CC0 1.0**.

- Official repository: https://github.com/KayKit-Game-Assets/KayKit-Character-Pack-Adventures-1.0
- Pinned source commit: `672074b73ba276876a19e8816ecdc5241817ab47`
- Models: `Knight.glb`, `Barbarian.glb`, `Rogue_Hooded.glb` in `addons/kaykit_character_pack_adventures/Characters/gltf/`.
- Original license: `LICENSE-KayKit.txt`. Original model hashes: `provenance.json`.

IRONFRONT uses the source body geometry, textures, socketed weapons and animations. Adaptations: smaller head proportions; faction-colored fabric; custom spear, bow, deforming bowstring and arrow geometry; arm posing for bow draw; seated lower-body poses for mounted attacks; 24 samples/second baked into half-float bone-matrix atlases. Skinned and rigid pieces retain their original bone/socket relationships. Near, medium and far body geometry use approximately 100%, 28% and 10% of the source triangles. The high-detail bodies contain 4,005–4,777 triangles.

These are derived assets. Source textures are extracted unchanged. `meshoptimizer` 1.0.1 (MIT) is a development-only simplification dependency and is not shipped in the game JavaScript.

The hero control update extends the atlas to 33 clips: backward walking, left/right strafing, backward/side dodges, diagonal attack, jump start/landing and four guarded locomotion variants. Guarded movement combines the source Blocking upper-body pose with source locomotion legs. Capes are shortened to 72% of their original length and narrowed to 90% so steps remain visible. Green hood texels use the faction color while skin texels retain their source texture. The far ranger body now contains 400 triangles.

To regenerate, place the three GLBs and the original `LICENSE.txt` in a local source directory, install frontend dependencies with `npm ci`, and run from the repository root:

```sh
node scripts/bake-characters.mjs /path/to/source-directory
blender --background --factory-startup --python-exit-code 1 --python art/duel/build.py -- /path/to/source-directory
node scripts/validate-character-assets.mjs
```

Only those source files are read. Generated `.json`, `.bin`, `.png` and provenance files are written to this directory. Commit generated assets together with converter changes; reload test clients after rebuilding the complete asset set.

The Turks Guardian and Knights heavy sword infantry retain the KayKit rig and selected exposed body parts. Their fitted costumes, weapons, shields and three shared material maps are original procedural artwork. Each costume has three levels of detail. On the distant model the weapon and shield remain attached to their animated hand sockets in the same draw as the body. Blender source is in `art/duel/`. Open `/drill.html?duel` to inspect the two figures together.

The Guardian's red kaftan, conical helmet, mail neck guard and round breastplate draw on Anatolian arms and Ottoman textiles. The Knights infantry uses a Western medieval enclosed helm, mail and a heraldic surcoat bearing the shield's chevrons. These are stylized game costumes. Museum objects served as visual references. [Turban helmet, The Met](https://www.metmuseum.org/art/collection/search/21978) · [Mirror armor, LACMA](https://collections.lacma.org/object/115778) · [Ottoman textile, The Met](https://www.metmuseum.org/art/collection/search/445264) · [Medieval European armor, The Met](https://www.metmuseum.org/essays/arms-and-armor-in-medieval-europe).

The Blender motion pass samples the source armature, retimes the sword arc to the server's contact phase, then keys torso, shoulder and shield corrections into editable Actions. The rising opening cut rolls the forearm and wrist around the blade tip. Ten clips per kit are appended to the GPU pose atlas. Pass an optional output `.blend` path after the source directory to export the two rigged characters, packed maps and Actions for further editing.

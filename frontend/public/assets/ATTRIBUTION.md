# Third-party art

Selected 3D models and their palette textures are by **Kenney**, released under **Creative Commons CC0 1.0 Universal**. Attribution is not required, but retained here for provenance.

- `castle/`: [Kenney Castle Kit 2.0](https://kenney.nl/assets/castle-kit)
- `nature/`: [Kenney Nature Kit 2.1](https://kenney.nl/assets/nature-kit) (version from the downloaded license)
- License: https://creativecommons.org/publicdomain/zero/1.0/

Original package license files are preserved in each subdirectory. Models were downloaded from Kenney's official free download flow on 2026-10-30. No geometry was modified.

`inventory.json` records local geometry bounds and sizes in source model units (Y is up), plus node transforms. External palette textures must remain at the relative `Textures/` paths embedded in the GLB files. Nature Kit meshes have a node translation of Y = -0.05; account for that when positioning them on the terrain. Castle Kit meshes have no node transforms. `wall-doorway.glb` is a half-width module (X -0.5 to 0).

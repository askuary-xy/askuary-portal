# Solar system assets

## Planet textures

- Source: [Solar System Scope Texture Library](https://www.solarsystemscope.com/textures/)
- License: [Creative Commons Attribution 4.0](https://creativecommons.org/licenses/by/4.0/)
- Files: `textures/2k_*.jpg` and `textures/2k_saturn_ring_alpha.png`
- Use: spherical planet materials, Earth cloud layer, Saturn ring opacity, and background reference.

## Navigation station models

- [Space Station](https://sketchfab.com/3d-models/space-station-0da4a24e7edd49159737675ffcc06228) by re1monsen — [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Used for the Blog station and as the base mesh for the ring-station variant.
- [Sci-Fi Space Station](https://sketchfab.com/3d-models/sci-fi-space-station-f6b9106fffc64fec93cabc17492cb2e4) by Helindu — [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Used for the About station close view.
- [Space Station 4](https://sketchfab.com/3d-models/space-station-4-cf80075368174bf9895f4fd266cf17e3) by re1monsen — [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). The supplied archive contains a Blender source only; the live Friends station currently uses the lightweight station mesh with an original ring assembly until a browser-ready export is available.

The solar-system overview uses lightweight procedural silhouettes for immediate legibility and stable frame time. The author models are loaded only when their station is selected.

## Spacecraft reference models

- Source: [NASA 3D Resources](https://github.com/nasa/NASA-3D-Resources)
- Files: `models/Voyager Probe (A).glb`, `models/International Space Station (ISS) (A).glb`
- Use: optional close-range orbital details. The models are not loaded by default.
- Note: NASA media use must follow the current [NASA media usage guidelines](https://www.nasa.gov/nasa-brand-center/images-and-media/).

The full downloaded NASA collection, source station archives, and the Maya solar-system project are retained outside the website build. Only the optimized runtime files listed above are copied into the portal.

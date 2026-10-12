# Human anatomy asset

`accra-male.glb` and `accra-female.glb` are editable, rigged derivatives of the CC0 surface, with nine named body/face morph targets. They are built by `tools/build-character-models.py` and loaded by the game. Their root transforms express grounded adult dimensions in metres. Sparse morph storage keeps each anatomy model under 1.7 MB.

`accra-male-player.glb` and `accra-female-player.glb` are dressed game-model exports, created by `tools/export-player-models.py`. They include fitted wardrobe meshes, eyes, hair, the game's retargeted animation skeleton, an idle pose and an original generated walk cycle. The game artwork, fitting and preview walk are original additions to the licensed base. The GLBs can be opened in Blender or another glTF 2.0 editor. No Free3D creator's model has been copied.

`human.json` contains the authored continuous MakeHuman base mesh and adult African male/female targets, packed by `tools/build-human.py` and adapted to the game's animation rig. The graphical assets are CC0 1.0 Universal. No MakeHuman application source code is bundled or copied.

Source: https://github.com/makehumancommunity/makehuman

Authored skin weights: `makehuman/data/rigs/default_weights.mhw` (CC0, Data Collection AB / Joel Palmius and Jonas Hauquier). Influences are remapped to the runtime animation skeleton by `tools/build-human.py`.

Asset paths: `makehuman/data/3dobjs/base.obj`, `makehuman/data/targets/macrodetails/african-male-young.target`, `makehuman/data/targets/macrodetails/african-female-young.target`.

License: https://github.com/makehumancommunity/makehuman/blob/master/LICENSE.md (section C).

CC0: https://creativecommons.org/publicdomain/zero/1.0/

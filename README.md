# rneanim

This project lets you view models and animations from [Robotics;Notes Elite](https://vndb.org/v5883), a game published by *5pb. Games* in June 2014.

(I am not affiliated with, authorised or endorsed by *5pb. Games* or any other *Robotics;Notes Elite* copyright holders.)

### How to use

- Extract `gamedata/model.cpk` to the `models` subfolder (see `README` in that folder for details).
- Make this root folder available on a webserver (viewing `index.html` locally will not work)

Third-party dependencies are included. See `THIRDPARTY` for attribution.

### TODO

- Support more GXT types
  - Support all models
- Accurate shading, apply remaining non-colormap textures
  - ~~Eye decals?~~ Looks good except for Airi
  - Reflection sprites though
- Fix tweening jitters

![AkiDamaged](akidamaged.png?raw=true "AkiDamaged")
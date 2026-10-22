# Third-party notices

Chicken Piano's own code is MIT licensed (see LICENSE). The built page (dist/index.html) bundles the
libraries and sounds below. Their licenses still apply to those parts.

| Part | Version | License | Copyright / source |
|---|---|---|---|
| [Tone.js](https://github.com/Tonejs/Tone.js) | 14.9.17 | MIT | Copyright (c) 2014-2020 Yotam Mann |
| [VexFlow](https://github.com/0xfe/vexflow) | 4.2.5 | MIT | Copyright (c) 2010 Mohit Muthanna Cheppudira |
| [Pitchy](https://github.com/ianprime0509/pitchy) | 4.1.0 | MIT | Copyright 2018-2021 Ian Johnson |
| [fft.js](https://github.com/indutny/fft.js) (used by Pitchy) | 4.0.4 | MIT | Copyright Fedor Indutny, 2017 |
| Bravura music font (inside VexFlow) | | SIL Open Font License 1.1 | Steinberg Media Technologies GmbH |
| Piano samples: [tonejs-instruments](https://github.com/nbrosowsky/tonejs-instruments) via [tonejs-instrument-piano-mp3](https://github.com/Makefully-Studios/tonejs-instruments) | 1.1.2 | Samples: [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/); code: MIT | Samples collected and edited by Nicholas Brosowsky, from Versilian Studios VSCO 2 (per the project's sample-source-info.txt). Chicken Piano trims them to 2.5 s, mono, 64 kbps. |
| Talking-chicken voice clips (`dist/voice`), recorded with [Kokoro-82M](https://github.com/hexgrad/kokoro) (voice `af_heart`) via [kokoro-onnx](https://github.com/thewh1teagle/kokoro-onnx) | 1.0 / 0.6.1 | Apache 2.0 (model weights and kokoro-onnx) | Kokoro model by hexgrad; kokoro-onnx by thewh1teagle. The model is used only at build time and is not shipped. |
| [Fredoka](https://fonts.google.com/specimen/Fredoka) font (loaded from Google Fonts, not bundled) | | SIL Open Font License 1.1 | The Fredoka Project Authors |

Not third-party:

- Chicken sounds (clucks, pecks, the "bawk") are synthesized in code with Tone.js. No recorded clips.
- The talking chicken plays clips recorded with Kokoro (above); sentences without a clip use the device's built-in speech voice (Web Speech API).
- Song melodies are traditional or public domain tunes (or new). The chicken lyrics are new.

## MIT license text (Tone.js, VexFlow, Pitchy, fft.js)

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated
documentation files (the "Software"), to deal in the Software without restriction, including without limitation
the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to
permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of
the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE
WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

# CoreCom AI Email Signature Generator

A small web page where anyone at CoreCom AI types their details and downloads an animated GIF email signature.

- **Fields:** full name, job title, and up to three contact lines (email, phone, second phone, website).
- **Output:** a 340 x 100 px GIF for uploading in Gmail or Outlook, plus a sharper 680 x 200 px copy for hosting online.
- **Animation:** the CC mark rebuilds from slanted shards, a colour wave runs through the name, and the highlighter
  re-swipes "CoreCom AI". It plays about three times, then rests on the finished signature.
  The first frame is the finished signature, so apps that do not animate GIFs still look right.

## Privacy

Everything runs in the browser. The details typed into the form are never uploaded or stored.

## Use it

Open the published page, fill in the form, press **Create my GIF**, download the file, then upload it in your
Gmail signature settings (the page lists the steps).

## Run it locally

The page uses ES modules, so open it through a local web server rather than by double-clicking the file:

```sh
python -m http.server 8000
# then open http://localhost:8000
```

## How it works

| File | Purpose |
| --- | --- |
| `index.html`, `style.css`, `app.js` | the form, live preview and download buttons |
| `signature.js` | draws one frame of the signature on a canvas (finished frame or build-animation frame) |
| `gif.js` | renders all frames, builds one shared colour palette, and encodes the GIF files |
| `vendor/gifenc.esm.js` | [gifenc](https://github.com/mattdesl/gifenc) GIF encoder, MIT licence (see `vendor/LICENSE-gifenc.md`) |
| `assets/mark.png` | the CC mark, taken from the CoreCom AI logo |

Only the pixels that change between frames are stored in the GIF, which keeps typical files around 50 KB.

## Publishing

The site is plain static files, so it is served directly by GitHub Pages from the `main` branch.

## Brand assets

The CC mark in `assets/` is part of the CoreCom AI logo and is intended for CoreCom AI use.

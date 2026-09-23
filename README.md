# 🎹 Carbon Piano

A kid-friendly piano teacher that runs entirely in the browser: on a laptop, a tablet, or a phone, with or without a real MIDI keyboard.

**Private by design:** no accounts, no ads, no tracking, and no network calls. Progress is saved only on the device.

## What it teaches

| Mode | What it does |
|------|-------------|
| **Free Play** | Play anything. The app shows the note name and where the note sits on the treble staff. |
| **Songs** | 7 classic tunes across 4 levels (Hot Cross Buns → Happy Birthday). Press **Listen** to hear the song first, then play along while the next key glows. Earn up to 3 ★ per song. |
| **Note Quiz** | *Find the Key* ("find any D") or *Read the Staff* (play the note shown). Tracks streaks. Optional black keys and higher notes. |
| **Echo Game** | Ear training and memory. Listen to a melody that grows by one note each round, then play it back. 3 lives, 3 difficulties. |
| **Progress** | Stars, play counts, and best scores. |

Learning aids (toggle them in ⚙ Settings):

- Rainbow note colors, consistent across the keys, lesson notes, and staff.
- Note names on the keys.
- Computer-keyboard letters on the keys.
- A **Connect a MIDI keyboard** button for real hardware (Chrome, Edge, or Firefox, over USB).

### Playing on a computer keyboard

```
 W E   T Y U   O P          ← black keys
A S D F G H J K L ; '       ← white keys (A = middle C)
Z / X = octave down / up
```

## Run it

Requires Node.js 22 or newer. There is nothing to install.

```bash
npm start          # http://127.0.0.1:8080
```

To try it on a tablet on the same Wi-Fi network, run `HOST=0.0.0.0 npm start` and open `http://<your-computer-ip>:8080`. Web MIDI needs HTTPS or `localhost`, so a MIDI keyboard will only work on the computer running the server in that setup.

## Develop

```bash
npm run ci               # everything CI runs:
npm run check:syntax     #   parse-check all JS
npm run check:security   #   static security gate (see SECURITY.md)
npm test                 #   unit tests (node:test)
```

```
public/                  ← the entire deployable app (static files)
  index.html
  _headers               ← security headers for Netlify / Cloudflare Pages
  src/
    core/                ← pure logic, no DOM: music theory, songs, lesson/quiz/echo
    │                      engines, progress sanitizer, MIDI parser  (unit-tested)
    ui/                  ← browser side effects: DOM helper, synth, keyboard, staff, storage
    modes/               ← one file per tab
    app.js               ← wiring
scripts/                 ← dev server, security gate, header source of truth
test/                    ← unit + adversarial tests
docs/THREAT_MODEL.md     ← STRIDE, NIST 800-53 mapping, hosting trade-offs
```

### Adding a song

Add an entry in `public/src/core/songs.js`. The notation is `NOTE[:BEATS]`, with `R` for a rest:

```js
song('my-song', 'My Song', 1, 100, 'C4 D4 E4:2 R E4 D4 C4:2'),
```

The tests check that every note fits on the C4–C6 keyboard.

## Deploy

`public/` is the whole site. Any static host works:

- **Cloudflare Pages / Netlify (recommended).** Publish directory: `public`. The `_headers` file is applied automatically, which enables the full header set.
- **GitHub Pages.** Set Settings → Pages → Source to **GitHub Actions**, then run the **Deploy to GitHub Pages** workflow manually. This option has fewer security headers; see the trade-off in `docs/THREAT_MODEL.md` §5.

## Security

See [`SECURITY.md`](SECURITY.md) and [`docs/THREAT_MODEL.md`](docs/THREAT_MODEL.md).

## License

No license has been chosen yet, so all rights are reserved by default.

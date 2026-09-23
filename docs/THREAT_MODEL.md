# Carbon Piano — Threat Model & Security Architecture

| | |
|---|---|
| **System** | Carbon Piano, a client-side web app that teaches piano to a child |
| **Version** | 0.1.0 |
| **Method** | Data-flow decomposition + STRIDE per element; controls mapped to NIST SP 800-53 Rev. 5 and OWASP ASVS 4.0 |
| **Review cadence** | On every change to a trust boundary: new input source, network call, storage field, dependency, or hosting target |

## 1. Security objectives

1. **Child privacy by design.** No collection, transmission, or third-party processing of personal data. This keeps the app out of COPPA / GDPR-K scope because it never collects personal information.
2. **Integrity of the code delivered to the browser.** Only first-party, same-origin, reviewed code can execute.
3. **Availability and safety of the device.** Malformed input (touch, keyboard, MIDI, tampered storage) cannot crash the app, leave notes stuck, or use unbounded resources.
4. **Secure SDLC.** Security invariants are enforced in CI rather than by convention alone.

## 2. System decomposition

```
 ┌────────────────────────── Browser (single origin) ──────────────────────────┐
 │                                                                             │
 │  [Touch / mouse] ──┐                                                        │
 │  [Computer keys] ──┼──► PianoKeyboard ──► app.js router ──► active Mode     │
 │  [USB MIDI dev] ───┘   (ui/keyboard)       │    │           (core engines)  │
 │     ▲  TB-2              ▲ parseMidi       │    └──► Synth (Web Audio)      │
 │     │  (untrusted HW)    │ (core/midi-     │                                │
 │                          │  message.js)    └──► ProgressStore ◄──► localStorage
 │                                                (ui/store.js)   TB-3 (untrusted
 │                                                 sanitize()      at rest)    │
 └───────────────────────────────▲─────────────────────────────────────────────┘
                                 │ TB-1: HTTPS, static files only (GET)
                        [Static host / CDN]  ◄── CI/CD (GitHub Actions)  TB-4
```

**Trust boundaries**

| ID | Boundary | Crossing data |
|----|----------|---------------|
| TB-1 | Host → browser | HTML/JS/CSS/SVG/manifest (static, same-origin) |
| TB-2 | MIDI hardware → app | 2–3 byte channel messages |
| TB-3 | Web Storage → app | JSON progress/settings blob (≤ 16 KiB) |
| TB-4 | Source repo → build/deploy pipeline | Code, workflow definitions, third-party Actions |

**Data inventory.** Stars per song, play counts, best quiz and echo scores, and four UI preferences. No names, ages, audio recordings, identifiers, or analytics. All of it is stored only in the browser's `localStorage` and never leaves the device.

## 3. STRIDE analysis

| # | Element | Threat (STRIDE) | Scenario | Mitigation | Residual |
|---|---------|-----------------|----------|------------|----------|
| T1 | Browser DOM | **T**ampering / **E**oP | DOM XSS through a string that reaches an HTML sink | No HTML-string sinks anywhere. All UI is built with `createElement` + `textContent` (`ui/dom.js`). CSP `require-trusted-types-for 'script'; trusted-types 'none'` makes such sinks throw at runtime (checked in the E2E probe). `check-security.mjs` blocks `innerHTML`, `insertAdjacentHTML`, `document.write`, `eval`, `new Function`, string timers, `javascript:` URLs, and dangerous `setAttribute` calls in CI. | Low |
| T2 | TB-1 | **T**ampering | Injected third-party script, CDN compromise, or malicious package | Zero runtime dependencies (enforced). CSP `default-src 'none'; script-src 'self'`, no remote URLs (enforced), `connect-src 'none'`. | Low; depends on host integrity |
| T3 | TB-1 | **I**nfo disclosure | Referrer or data exfiltration | `connect-src 'none'`, `form-action 'none'`, `img-src 'self'`, `Referrer-Policy: no-referrer`. The app has no data worth exfiltrating. | Very low |
| T4 | TB-1 | **S**poofing / **T**ampering | Clickjacking or framing of the app | `frame-ancestors 'none'` + `X-Frame-Options: DENY` (header delivery required, see §5) | Low (Medium on GitHub Pages) |
| T5 | TB-3 | **T**ampering / **E**oP | Tampered `localStorage`: prototype pollution (`__proto__`), type confusion, oversized blob, script payloads | `core/progress.js` rebuilds state from an allowlist: own-property reads only, type checks, range clamps, known song IDs only, 16 KiB cap, schema version gate. Tampered values never reach a sink (T1). Unit tests and the E2E probe cover this. | Very low |
| T6 | TB-2 | **D**oS / **T**ampering | Malformed, flooding, or SysEx MIDI | SysEx never requested (`sysex: false`). Strict message parser drops anything other than note on/off and all-notes-off. Polyphony capped at 12 voices with voice stealing. All notes are released when a device disconnects or the window blurs. | Low |
| T7 | Device | **E**oP | Access to powerful APIs | `Permissions-Policy` denies camera, microphone, geolocation, USB, serial, HID, payment, display-capture, and sensors. MIDI is limited to self and prompts only after an explicit click. | Low |
| T8 | Input | **D**oS | Stuck notes or runaway audio | Release-all on `blur`, `visibilitychange`, and mode switch. Key-repeat ignored. Bounded sequence lengths (songs ≤ 512 tokens, echo ≤ 32). | Low |
| T9 | TB-4 | **T**ampering | Compromised or retagged third-party GitHub Action | Actions pinned to full commit SHAs. Dependabot keeps the pins fresh. `permissions: contents: read` by default. `persist-credentials: false`. Pages deploy is a manual dispatch with a job-scoped `pages: write` / `id-token: write`. CodeQL scans both JS and workflow files. | Low |
| T10 | Dev server | **I**nfo disclosure | Path traversal or LAN exposure while developing locally | Binds to `127.0.0.1` by default. Serves only `public/`. Rejects `..`, encoded traversal, dotfiles, NUL, backslashes, symlink escapes, and non-allowlisted extensions. GET/HEAD only. Covered by regression tests (`test/serve.test.mjs`). | Very low |
| T11 | Repudiation | **R** | Not applicable: no multi-user state and no server-side actions | None needed | — |

## 4. Control mapping (NIST SP 800-53 Rev. 5)

| Control | Implementation |
|---------|----------------|
| **AC-6** Least Privilege | Workflow tokens default to `contents: read`, with elevation scoped per job. Permissions-Policy denies unused device APIs. |
| **CM-7** Least Functionality | No backend, network calls, service worker, or third-party code. The dev server serves one directory and two HTTP methods. |
| **SA-8** Security & Privacy Engineering Principles | Pure `core/` modules are separated from `ui/` side effects. Deny-by-default CSP. Privacy by design (§1). |
| **SA-11** Developer Testing & Evaluation | Unit tests cover engines, parsers, and sanitizers, plus adversarial cases (pollution, traversal, malformed MIDI). A static security gate and CodeQL `security-extended` run in CI. |
| **SA-15** Development Process, Standards & Tools | Security invariants are codified in `scripts/check-security.mjs` and fail the build. |
| **SC-7** Boundary Protection | CSP `default-src 'none'`, `connect-src 'none'`, `frame-ancestors 'none'`, and COOP/COEP/CORP same-origin isolation. |
| **SC-8** Transmission Confidentiality & Integrity | HTTPS host plus HSTS (`public/_headers`). |
| **SC-18** Mobile Code | Only same-origin ES modules execute. Trusted Types enforced. No `eval`. |
| **SI-10** Information Input Validation | MIDI parser, storage sanitizer, melody parser, note parser, and dev-server URL resolver all reject by default. |
| **SI-11** Error Handling | Storage failures degrade silently to in-memory state. Messages shown to the user never echo raw input or stack traces. |
| **SR-3 / SR-11** Supply Chain Controls, Component Authenticity | Zero dependencies, SHA-pinned Actions, and Dependabot for Actions. The CI gate fails if a lockfile, `node_modules/`, runtime dependency, or install lifecycle script appears. |
| **PT-2 / PT-3** Authority & Purpose for Processing PII | No PII is processed. Documented here as a design constraint. |

For the OWASP Top 10 (2021), the design directly eliminates or mitigates A03 Injection, A05 Security Misconfiguration (CSP and headers are tested for drift), A06 Vulnerable Components (none exist), and A08 Software & Data Integrity Failures (pinned CI, allowlisted deserialization).

## 5. Hosting: risk/benefit

| Option | Benefit | Risk / gap | Recommendation |
|--------|---------|-----------|----------------|
| **Cloudflare Pages / Netlify** | Honors `public/_headers`: full CSP including `frame-ancestors`, HSTS, Permissions-Policy, COOP/COEP | Another vendor account to secure (enable MFA) | **Preferred** |
| **GitHub Pages** (`pages.yml`) | Zero extra accounts, integrated with the repo | No custom headers. The `<meta>` CSP still enforces script, style, connect, and Trusted Types rules, but `frame-ancestors`, HSTS preload control, and Permissions-Policy are lost. Clickjacking impact is minimal here (no state-changing actions worth hijacking). | Acceptable for a family app |
| **Local only** (`npm start`) | No internet exposure at all | Needs a computer running Node. Web MIDI works because `localhost` is a secure context. | Good for development |

## 6. Accepted residual risks

- **Host compromise (TB-1).** A compromised static host could serve arbitrary code. Subresource Integrity does not help for first-party entry points. Mitigations: MFA on the hosting account and branch protection on `main`.
- **Browser or extension compromise.** Out of scope. Extensions can read and modify any page.
- **No accounts.** There are no accounts, so no account recovery or parental controls exist. This is intentional.

## 7. Change triggers requiring an update to this document

Adding any of the following requires updating this model and the `check-security.mjs` rules: a network request, a runtime dependency, a service worker, a new storage field, a new device API (microphone for pitch detection is the likely next one), user-generated content, or accounts/sync.

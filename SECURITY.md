# Security Policy

Carbon Piano is used by children, so it is built to be private and secure by default. The full threat model and control mapping are in [`docs/THREAT_MODEL.md`](docs/THREAT_MODEL.md).

## Reporting a vulnerability

Please use GitHub's **private vulnerability reporting** (Security tab → "Report a vulnerability") instead of opening a public issue. Include steps to reproduce and the affected browser. Expect an acknowledgement within 7 days.

## Security invariants (enforced in CI)

These rules are checked by `npm run check:security` and must not be weakened without updating the threat model:

1. **No HTML-string DOM sinks or dynamic code** (`innerHTML`, `insertAdjacentHTML`, `document.write`, `eval`, `new Function`, string timers). Build UI with `src/ui/dom.js`.
2. **No network access and no remote origins** in client code or markup.
3. **No inline script, style, or event-handler attributes** in HTML.
4. **Web Storage is accessed only through `src/ui/store.js`**, and all stored data passes through `sanitizeProgress()`.
5. **The CSP and headers match `scripts/security-headers.mjs`** in both `index.html` and `public/_headers`.
6. **No runtime dependencies and no install lifecycle scripts.**

## Dependency policy

The project has zero runtime and zero development npm dependencies by design. The test runner is `node:test` and the dev server is `node:http`. Any proposal to add a dependency must:

- justify why a small first-party implementation is not sufficient
- pin an exact version and commit the lockfile
- pass `npm audit` and receive a maintainer review of the package's maintainers, install scripts, and transitive tree
- update `docs/THREAT_MODEL.md` (T2, SR-3) and relax the CI check deliberately in the same PR

GitHub Actions are pinned to full commit SHAs and updated through Dependabot PRs, which must pass CI before merging.

## Recommended repository settings

- Branch protection on `main`: require PRs, require the **CI** and **CodeQL** checks, and disallow force-push.
- Enable secret scanning with push protection, and private vulnerability reporting.
- Settings → Actions → Workflow permissions: **Read repository contents** (the default token stays read-only).
- Require MFA for everyone with write access to the repo or the hosting account.

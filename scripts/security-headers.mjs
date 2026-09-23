// Single source of truth for the app's HTTP security headers.
// Consumed by: scripts/serve.mjs (local dev), scripts/check-security.mjs (drift check
// against public/_headers and the <meta> CSP in public/index.html).

/** CSP directives that also work when delivered via <meta http-equiv>. */
export const CSP_META_DIRECTIVES = Object.freeze([
  "default-src 'none'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self'",
  "font-src 'none'",
  "connect-src 'none'",
  "media-src 'none'",
  "object-src 'none'",
  "worker-src 'none'",
  "frame-src 'none'",
  "manifest-src 'self'",
  "base-uri 'none'",
  "form-action 'none'",
  "require-trusted-types-for 'script'",
  "trusted-types 'none'",
]);

/** Directives that are ignored in <meta> and must be sent as a real header. */
const CSP_HEADER_ONLY = Object.freeze(["frame-ancestors 'none'"]);

export const CSP_META = CSP_META_DIRECTIVES.join('; ');
export const CSP_HEADER = [...CSP_META_DIRECTIVES, ...CSP_HEADER_ONLY].join('; ');

// Everything is denied except Web MIDI for our own origin (opt-in hardware keyboard).
export const PERMISSIONS_POLICY = [
  'midi=(self)',
  'camera=()',
  'microphone=()',
  'geolocation=()',
  'usb=()',
  'serial=()',
  'hid=()',
  'payment=()',
  'display-capture=()',
  'accelerometer=()',
  'gyroscope=()',
  'magnetometer=()',
].join(', ');

/** Headers safe for both local development and production. */
export const BASE_HEADERS = Object.freeze({
  'Content-Security-Policy': CSP_HEADER,
  'Permissions-Policy': PERMISSIONS_POLICY,
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Resource-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'require-corp',
});

/** Production-only additions (HTTPS). Not sent by the local HTTP dev server. */
export const PRODUCTION_ONLY_HEADERS = Object.freeze({
  'Strict-Transport-Security': 'max-age=63072000; includeSubDomains',
});

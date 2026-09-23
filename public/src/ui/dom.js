// Minimal, safe DOM construction helpers.
//
// All UI is built with createElement/textContent. There is deliberately no way to
// pass HTML strings, inline event-handler attributes, or inline styles through
// these helpers. Combined with the Trusted Types CSP directive, this makes
// DOM-based XSS structurally impossible in this codebase rather than merely unlikely.

const SVG_NS = 'http://www.w3.org/2000/svg';
const FORBIDDEN_ATTR = /^(on|style$|srcdoc$|formaction$)/i;

function applyAttrs(node, attrs) {
  for (const [name, value] of Object.entries(attrs)) {
    if (FORBIDDEN_ATTR.test(name)) throw new Error(`Attribute not allowed: ${name}`);
    if (value === false || value === null || value === undefined) continue;
    node.setAttribute(name, value === true ? '' : String(value));
  }
}

function append(node, children) {
  for (const child of children) {
    if (child === null || child === undefined || child === false) continue;
    node.append(typeof child === 'string' || typeof child === 'number'
      ? document.createTextNode(String(child))
      : child);
  }
}

/**
 * h('button', { class: 'btn', attrs: { type: 'button' }, on: { click } }, ['Label'])
 */
export function h(tag, { class: className, text, attrs, on, dataset } = {}, children = []) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = String(text);
  if (attrs) applyAttrs(node, attrs);
  if (dataset) Object.assign(node.dataset, dataset);
  if (on) for (const [evt, fn] of Object.entries(on)) node.addEventListener(evt, fn);
  append(node, children);
  return node;
}

export function s(tag, attrs = {}, children = []) {
  const node = document.createElementNS(SVG_NS, tag);
  applyAttrs(node, attrs);
  append(node, children);
  return node;
}

export function button(label, onClick, { className = 'btn', attrs = {} } = {}) {
  return h('button', { class: className, text: label, attrs: { type: 'button', ...attrs }, on: { click: onClick } });
}

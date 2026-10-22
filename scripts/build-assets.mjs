/**
 * Draws the README's buttons as SVG, styled after the ones on eriklarson.dev. A
 * README can't carry CSS, so an image is the only way to get the site's square,
 * monospace buttons onto the profile.
 *
 *   node scripts/build-assets.mjs
 *
 * Every button comes in a light and a dark version. The README picks between
 * them with <picture>, which GitHub matches to its own theme setting rather than
 * the operating system's — so the link sits inside <picture>, around the <img>:
 * one wrapped around the whole <picture> makes GitHub move the image out of it.
 *
 * Geist Mono is embedded in the one button with a label, since an SVG shown as
 * an image can't load a font from anywhere else.
 */
import { mkdir, writeFile } from 'node:fs/promises'

const OUT = new URL('../assets/', import.meta.url)

const SITE_BUTTON = { slug: 'website', label: 'eriklarson.dev' }

// Brand marks from Simple Icons (CC0), the same ones the site's social rail uses.
const ICON_BUTTONS = [
  {
    slug: 'x',
    title: 'X',
    path: 'M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z'
  },
  {
    slug: 'linkedin',
    title: 'LinkedIn',
    path: 'M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z'
  }
]

// The site's tokens (src/styles.css), less the ones nothing here draws with.
const THEMES = {
  light: {
    background: '#ffffff',
    foreground: '#171717',
    primary: '#0a0a0a',
    primaryForeground: '#ffffff',
    input: '#d4d4d4'
  },
  dark: {
    background: '#0a0a0a',
    foreground: '#e8e8e8',
    primary: '#ffffff',
    primaryForeground: '#0a0a0a',
    input: '#3a3a3a'
  }
}

// The site's "normal" weight, one step lighter than the usual 400.
const WEIGHT_NORMAL = 300

// Geist Mono's advance is 600 units to the em, so a label's width can be worked
// out here rather than measured in a browser.
const MONO_ADVANCE = 0.6

// Sentence case wants less air between letters than the site's uppercase labels.
const TRACKING = 0.04

// Pinned to the version the site builds with.
const res = await fetch(
  'https://cdn.jsdelivr.net/npm/@fontsource-variable/geist-mono@5.3.0/files/geist-mono-latin-wght-normal.woff2'
)
if (!res.ok) throw new Error(`Geist Mono: HTTP ${res.status}`)
const mono = Buffer.from(await res.arrayBuffer()).toString('base64')

const escape = text =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

function svg({ width, height, title, body }) {
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escape(title)}">`,
    `<title>${escape(title)}</title>`,
    body,
    '</svg>\n'
  ].join('')
}

/** The site's primary button: solid ink, square, with the icon in a divided cell. */
function siteButton({ label }, t) {
  const height = 44
  const size = 12
  // Leaves out the tracking after the last letter.
  const labelWidth = label.length * size * MONO_ADVANCE + (label.length - 1) * size * TRACKING
  const divider = 20 + labelWidth + 20
  const width = divider + 14 + 16 + 14

  return svg({
    width,
    height,
    title: label,
    body: [
      `<style>@font-face{font-family:'Geist Mono';src:url(data:font/woff2;base64,${mono}) format('woff2');font-weight:100 900}</style>`,
      `<rect width="${width}" height="${height}" fill="${t.primary}"/>`,
      `<text x="20" y="${height / 2 + 4.2}" font-family="'Geist Mono'" font-size="${size}" font-weight="${WEIGHT_NORMAL}" letter-spacing="${TRACKING * size}" fill="${t.primaryForeground}">${escape(label)}</text>`,
      `<line x1="${divider + 0.5}" y1="0" x2="${divider + 0.5}" y2="${height}" stroke="${t.primaryForeground}" stroke-opacity="0.25"/>`,
      // The site's up-right arrow for links that leave it, drawn 16px square.
      `<g transform="translate(${divider + 14} ${height / 2 - 8}) scale(${16 / 24})" fill="none" stroke="${t.primaryForeground}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17 17 7M8 7h9v9"/></g>`
    ].join('')
  })
}

/** The site's outline button, cut down to a square around a brand mark. */
function iconButton({ title, path }, t) {
  const size = 44
  const icon = 18
  const offset = (size - icon) / 2

  return svg({
    width: size,
    height: size,
    title,
    body: [
      `<rect x="0.5" y="0.5" width="${size - 1}" height="${size - 1}" fill="${t.background}" stroke="${t.input}"/>`,
      `<g transform="translate(${offset} ${offset}) scale(${icon / 24})"><path d="${path}" fill="${t.foreground}"/></g>`
    ].join('')
  })
}

await mkdir(OUT, { recursive: true })

const files = []
for (const [theme, tokens] of Object.entries(THEMES)) {
  files.push([`button-${SITE_BUTTON.slug}-${theme}.svg`, siteButton(SITE_BUTTON, tokens)])
  for (const item of ICON_BUTTONS) files.push([`button-${item.slug}-${theme}.svg`, iconButton(item, tokens)])
}

await Promise.all(files.map(([name, content]) => writeFile(new URL(name, OUT), content)))
console.log(`Wrote ${files.length} files to assets/`)

/**
 * Draws the README's typed heading and buttons as SVG, styled after the ones on
 * eriklarson.dev. A README can't carry CSS or scripts, so an image is the only
 * way to get the site's type, motion, and buttons onto the profile.
 *
 *   node scripts/build-assets.mjs
 *
 * Each file carries both themes and switches on prefers-color-scheme inside
 * itself, so it follows the system's color mode wherever it's shown. <picture>
 * can't do that here: the README wraps each image in a link, and a browser only
 * reads a <picture>'s sources when the <img> is its direct child.
 *
 * Geist Mono is embedded in each file that sets text, since an SVG shown as an
 * image can't load a font from anywhere else.
 */
import { mkdir, writeFile } from 'node:fs/promises'

const OUT = new URL('../assets/', import.meta.url)

// The site's hero titles, in its order.
const TITLES = [
  'Software Engineer',
  'System Architect',
  'Cloud Engineer',
  'WordPress Expert',
  'Coding Mentor',
  'Technical Lead'
]

// The site's TypedHeading timings: a slow type, a long hold on the finished
// title, a quick delete. The gap is the beat the line sits empty between titles.
const TYPE_MS = 100
const BACK_MS = 30
const HOLD_MS = 3000
const START_MS = 600
const GAP_MS = 400

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
// The heading is the exception: it sits in the README's own text, so it takes
// GitHub's text colors rather than the site's.
const THEMES = {
  light: {
    background: '#ffffff',
    foreground: '#171717',
    primary: '#0a0a0a',
    primaryForeground: '#ffffff',
    input: '#d4d4d4',
    heading: '#1f2328'
  },
  dark: {
    background: '#0a0a0a',
    foreground: '#e8e8e8',
    primary: '#ffffff',
    primaryForeground: '#0a0a0a',
    input: '#3a3a3a',
    heading: '#e6edf3'
  }
}

// The site's "normal" weight, one step lighter than the usual 400.
const WEIGHT_NORMAL = 300

// Geist Mono's advance is 600 units to the em, so a line's width can be worked
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

/**
 * A class per token for fill (.f-name) and stroke (.s-name), light by default
 * and dark when the system asks for it.
 */
function themeStyle({ withFont = false } = {}) {
  const rules = tokens =>
    Object.entries(tokens)
      .map(([name, color]) => `.f-${name}{fill:${color}}.s-${name}{stroke:${color}}`)
      .join('')
  const font = withFont
    ? `@font-face{font-family:'Geist Mono';src:url(data:font/woff2;base64,${mono}) format('woff2');font-weight:100 900}`
    : ''
  return `<style>${font}${rules(THEMES.light)}@media (prefers-color-scheme:dark){${rules(THEMES.dark)}}</style>`
}

function svg({ width, height, title, body }) {
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escape(title)}">`,
    `<title>${escape(title)}</title>`,
    body,
    '</svg>\n'
  ].join('')
}

/**
 * Types each title in turn, centred, then deletes it — the site's TypedHeading
 * without the script. Each title sits under a clip whose width steps a character
 * at a time, driven by SMIL, which runs inside an image where CSS can't count
 * characters.
 */
function typedHeading() {
  const width = 360
  const height = 40
  const size = 22
  const char = size * MONO_ADVANCE

  // Lay the titles end to end on one timeline, then loop it.
  let clock = START_MS
  const windows = TITLES.map(title => {
    const start = clock
    clock += title.length * TYPE_MS + HOLD_MS + title.length * BACK_MS + GAP_MS
    return { title, start }
  })
  const total = clock

  const clips = []
  const lines = []
  windows.forEach(({ title, start }, i) => {
    const n = title.length
    const x = (width - n * char) / 2
    const steps = [[0, 0]]
    for (let k = 0; k <= n; k++) steps.push([start + k * TYPE_MS, k * char])
    const held = start + n * TYPE_MS + HOLD_MS
    for (let k = 1; k <= n; k++) steps.push([held + k * BACK_MS, (n - k) * char])

    // The first step is 0 at 0, which the window's own start repeats; keep one.
    const unique = steps.filter(([t], j) => j === 0 || t > steps[j - 1][0])
    const keyTimes = unique.map(([t]) => (t / total).toFixed(6)).join(';')
    const values = unique.map(([, w]) => w.toFixed(2)).join(';')

    // The first title is drawn in full when nothing animates — a thumbnail, or
    // a renderer without SMIL — so a still image still says something.
    const still = i === 0 ? n * char : 0
    clips.push(
      `<clipPath id="t${i}"><rect x="${x}" y="0" width="${still}" height="${height}">`,
      `<animate attributeName="width" dur="${total}ms" repeatCount="indefinite" calcMode="discrete" keyTimes="${keyTimes}" values="${values}"/>`,
      '</rect></clipPath>'
    )
    lines.push(
      `<text x="${x}" y="${height / 2 + size * 0.35}" clip-path="url(#t${i})" class="f-heading" font-family="'Geist Mono'" font-size="${size}" font-weight="500">${escape(title)}</text>`
    )
  })

  return svg({
    width,
    height,
    title: TITLES.join(' · '),
    body: [themeStyle({ withFont: true }), `<defs>${clips.join('')}</defs>`, ...lines].join('')
  })
}

/** The site's primary button: solid ink, square, with the icon in a divided cell. */
function siteButton({ label }) {
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
      themeStyle({ withFont: true }),
      `<rect width="${width}" height="${height}" class="f-primary"/>`,
      `<text x="20" y="${height / 2 + 4.2}" class="f-primaryForeground" font-family="'Geist Mono'" font-size="${size}" font-weight="${WEIGHT_NORMAL}" letter-spacing="${TRACKING * size}">${escape(label)}</text>`,
      `<line x1="${divider + 0.5}" y1="0" x2="${divider + 0.5}" y2="${height}" class="s-primaryForeground" stroke-opacity="0.25"/>`,
      // The site's up-right arrow for links that leave it, drawn 16px square.
      `<g transform="translate(${divider + 14} ${height / 2 - 8}) scale(${16 / 24})" class="s-primaryForeground" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17 17 7M8 7h9v9"/></g>`
    ].join('')
  })
}

/** The site's outline button, cut down to a square around a brand mark. */
function iconButton({ title, path }) {
  const size = 44
  const icon = 18
  const offset = (size - icon) / 2

  return svg({
    width: size,
    height: size,
    title,
    body: [
      themeStyle(),
      `<rect x="0.5" y="0.5" width="${size - 1}" height="${size - 1}" class="f-background s-input"/>`,
      `<g transform="translate(${offset} ${offset}) scale(${icon / 24})"><path d="${path}" class="f-foreground"/></g>`
    ].join('')
  })
}

await mkdir(OUT, { recursive: true })

const files = [
  ['typed-heading.svg', typedHeading()],
  [`button-${SITE_BUTTON.slug}.svg`, siteButton(SITE_BUTTON)],
  ...ICON_BUTTONS.map(item => [`button-${item.slug}.svg`, iconButton(item)])
]

await Promise.all(files.map(([name, content]) => writeFile(new URL(name, OUT), content)))
console.log(`Wrote ${files.length} files to assets/`)

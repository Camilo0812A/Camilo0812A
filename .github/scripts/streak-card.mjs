// Genera la tarjeta de racha de contribuciones (assets/stats/streak.svg).
// Uso en el workflow: GITHUB_TOKEN=... node .github/scripts/streak-card.mjs <usuario> <salida.svg>
import { writeFile } from 'node:fs/promises'

const [user = 'Camilo0812A', out = 'assets/stats/streak.svg'] = process.argv.slice(2)
const token = process.env.GITHUB_TOKEN

const C = { bg: '#0b0907', title: '#c8a24a', text: '#ede6d8', muted: '#9a9184', icon: '#b4232a', accent: '#e0575d', ring: '#2a231d' }
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

async function gql(query, variables) {
  const res = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: { Authorization: `bearer ${token}`, 'Content-Type': 'application/json', 'User-Agent': 'profile-streak-card' },
    body: JSON.stringify({ query, variables }),
  })
  const json = await res.json()
  if (!res.ok || json.errors) throw new Error(JSON.stringify(json.errors ?? json))
  return json.data
}

async function contributionDays() {
  const { user: u } = await gql('query($login:String!){user(login:$login){createdAt}}', { login: user })
  const firstYear = new Date(u.createdAt).getUTCFullYear()
  const now = new Date()
  const days = []
  for (let y = firstYear; y <= now.getUTCFullYear(); y++) {
    const from = new Date(Date.UTC(y, 0, 1)).toISOString()
    const to = y === now.getUTCFullYear() ? now.toISOString() : new Date(Date.UTC(y, 11, 31, 23, 59, 59)).toISOString()
    const data = await gql(
      `query($login:String!,$from:DateTime!,$to:DateTime!){user(login:$login){contributionsCollection(from:$from,to:$to){
        contributionCalendar{weeks{contributionDays{date contributionCount}}}}}}`,
      { login: user, from, to },
    )
    for (const w of data.user.contributionsCollection.contributionCalendar.weeks)
      for (const d of w.contributionDays) days.push(d)
  }
  const today = now.toISOString().slice(0, 10)
  return days.filter((d) => d.date <= today).sort((a, b) => a.date.localeCompare(b.date))
}

function computeStats(days) {
  const total = days.reduce((s, d) => s + d.contributionCount, 0)
  const first = days.find((d) => d.contributionCount > 0)?.date ?? null
  let longest = { length: 0, start: null, end: null }
  let run = { length: 0, start: null, end: null }
  for (const d of days) {
    if (d.contributionCount > 0) {
      run = run.length ? { ...run, length: run.length + 1, end: d.date } : { length: 1, start: d.date, end: d.date }
      if (run.length > longest.length) longest = { ...run }
    } else run = { length: 0, start: null, end: null }
  }
  // La racha actual no se rompe si hoy todavía no hay contribuciones.
  let i = days.length - 1
  if (i >= 0 && days[i].contributionCount === 0) i--
  let current = { length: 0, start: null, end: null }
  while (i >= 0 && days[i].contributionCount > 0) {
    current = { length: current.length + 1, start: days[i].date, end: current.end ?? days[i].date }
    i--
  }
  return { total, first, current, longest }
}

const fmt = (iso, withYear = true) => {
  if (!iso) return ''
  const [y, m, d] = iso.split('-').map(Number)
  return `${d} ${MESES[m - 1]}${withYear ? ` ${y}` : ''}`
}
const range = (r) => (r.length ? (r.start === r.end ? fmt(r.start) : `${fmt(r.start, r.start.slice(0, 4) !== r.end.slice(0, 4))} – ${fmt(r.end)}`) : 'Sin racha activa')
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')

export function renderCard({ total, first, current, longest }) {
  const W = 495, H = 195
  const font = "font-family=\"'Segoe UI', Ubuntu, 'Helvetica Neue', Sans-Serif\""
  const col = (x, value, label, sub, cls) => `
  <g class="fade ${cls}" text-anchor="middle" ${font}>
    <text x="${x}" y="${cls === 'c2' ? 104 : 92}" fill="${cls === 'c2' ? C.accent : C.text}" font-size="${cls === 'c2' ? 28 : 26}" font-weight="700">${esc(value)}</text>
    <text x="${x}" y="${cls === 'c2' ? 150 : 128}" fill="${cls === 'c2' ? C.title : C.text}" font-size="14" font-weight="600">${esc(label)}</text>
    <text x="${x}" y="${cls === 'c2' ? 170 : 150}" fill="${C.muted}" font-size="11.5">${esc(sub)}</text>
  </g>`
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="st">
<title id="st">Racha de contribuciones: ${current.length} días actuales, ${longest.length} días como máximo, ${total} contribuciones en total</title>
<style>
.fade{animation:fade .8s ease-out both}.c1{animation-delay:.1s}.c2{animation-delay:.3s}.c3{animation-delay:.5s}
@keyframes fade{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
.ring{stroke-dasharray:226;animation:ring 1.2s .3s ease-out both}
@keyframes ring{from{stroke-dashoffset:226}to{stroke-dashoffset:0}}
.flame{transform-origin:247.5px 38px;animation:flick 1.6s ease-in-out infinite alternate}
@keyframes flick{from{transform:scale(1)}to{transform:scale(1.12)}}
@media (prefers-reduced-motion:reduce){.fade,.ring,.flame{animation:none}}
</style>
<rect width="${W}" height="${H}" rx="6" fill="${C.bg}"/>
<line x1="165" y1="40" x2="165" y2="160" stroke="${C.ring}" stroke-width="1"/>
<line x1="330" y1="40" x2="330" y2="160" stroke="${C.ring}" stroke-width="1"/>
${col(82.5, total, 'Contribuciones', first ? `desde ${fmt(first)}` : '—', 'c1')}
<circle cx="247.5" cy="95" r="36" fill="none" stroke="${C.ring}" stroke-width="5"/>
<circle class="ring" cx="247.5" cy="95" r="36" fill="none" stroke="${C.icon}" stroke-width="5" transform="rotate(-90 247.5 95)"/>
<path class="flame" d="M247.5 24c4 7 10 11 10 19a10 10 0 0 1-20 0c0-4 2-7 4-9 0 4 2 6 4 6 0-6-1-10 2-16z" fill="${C.icon}"/>
${col(247.5, current.length, 'Racha actual', range(current), 'c2')}
${col(412.5, longest.length, 'Racha más larga', range(longest), 'c3')}
</svg>
`
}

async function main() {
  let stats
  if (process.env.STREAK_JSON) {
    // Modo local: datos ya calculados (mismo formato que la salida de computeStats).
    stats = JSON.parse(process.env.STREAK_JSON)
  } else {
    if (!token) throw new Error('Falta GITHUB_TOKEN')
    stats = computeStats(await contributionDays())
  }
  await writeFile(out, renderCard(stats))
  console.log(`Racha generada en ${out}:`, JSON.stringify(stats))
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

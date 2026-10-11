// TODO: replace with real API call
// Placeholder photos, logos and PDFs for the seeded accounts in mockUsers.js. They are built in
// code as File objects (the same kind a user uploads), so the repo needs no binary files.

const escapeXml = (text) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

const initials = (name) =>
  name
    .split(/\s+/)
    .filter((word) => /^[A-Za-z]/.test(word))
    .slice(0, 2)
    .map((word) => word[0].toUpperCase())
    .join('')

const slug = (text) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

function svgFile(fileName, width, height, body) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${body}</svg>`
  return new File([svg], fileName, { type: 'image/svg+xml', lastModified: 0 })
}

// Square profile photo: initials on a colored background.
export function avatarPhoto(name, color) {
  return svgFile(
    `${slug(name)}-photo.svg`,
    240,
    240,
    `<rect width="240" height="240" fill="${color}"/>
     <circle cx="120" cy="96" r="44" fill="#ffffff" opacity="0.25"/>
     <rect x="52" y="152" width="136" height="88" rx="60" fill="#ffffff" opacity="0.25"/>
     <text x="120" y="112" text-anchor="middle" font-family="Segoe UI, sans-serif" font-size="44" font-weight="700" fill="#ffffff">${escapeXml(initials(name))}</text>`,
  )
}

// Square company logo: initials in a rounded badge.
export function logoImage(name, color) {
  return svgFile(
    `${slug(name)}-logo.svg`,
    240,
    240,
    `<rect width="240" height="240" fill="#ffffff"/>
     <rect x="24" y="24" width="192" height="192" rx="40" fill="${color}"/>
     <text x="120" y="140" text-anchor="middle" font-family="Segoe UI, sans-serif" font-size="64" font-weight="800" fill="#ffffff">${escapeXml(initials(name))}</text>`,
  )
}

// Workshop or shop photo: a simple garage scene with a caption.
export function placePhoto(fileName, caption, color) {
  return svgFile(
    fileName,
    640,
    480,
    `<rect width="640" height="480" fill="#e8ecf1"/>
     <rect x="60" y="120" width="520" height="300" fill="${color}" opacity="0.85"/>
     <polygon points="40,130 320,40 600,130" fill="${color}"/>
     <rect x="120" y="200" width="400" height="220" fill="#f6f7f9"/>
     <g stroke="#c9d1db" stroke-width="6">${[0, 1, 2, 3, 4].map((i) => `<line x1="120" y1="${230 + i * 40}" x2="520" y2="${230 + i * 40}"/>`).join('')}</g>
     <rect x="0" y="420" width="640" height="60" fill="#1c2024" opacity="0.75"/>
     <text x="320" y="460" text-anchor="middle" font-family="Segoe UI, sans-serif" font-size="26" fill="#ffffff">${escapeXml(caption)}</text>`,
  )
}

// Tow truck side view with a caption.
export function truckPhoto(fileName, caption, color) {
  return svgFile(
    fileName,
    640,
    480,
    `<rect width="640" height="480" fill="#dfe8f1"/>
     <rect x="0" y="340" width="640" height="140" fill="#9aa5b1"/>
     <rect x="70" y="250" width="330" height="40" fill="#57606a"/>
     <polygon points="120,250 380,190 390,210 140,260" fill="#57606a"/>
     <rect x="400" y="190" width="150" height="110" rx="12" fill="${color}"/>
     <rect x="470" y="205" width="62" height="45" rx="6" fill="#cfe4ff"/>
     <rect x="70" y="290" width="480" height="30" fill="${color}"/>
     ${[140, 250, 480].map((x) => `<circle cx="${x}" cy="330" r="34" fill="#1c2024"/><circle cx="${x}" cy="330" r="14" fill="#c9d1db"/>`).join('')}
     <rect x="0" y="420" width="640" height="60" fill="#1c2024" opacity="0.75"/>
     <text x="320" y="460" text-anchor="middle" font-family="Segoe UI, sans-serif" font-size="26" fill="#ffffff">${escapeXml(caption)}</text>`,
  )
}

const escapePdf = (text) => text.replace(/[\\()]/g, (char) => `\\${char}`)

// A small, valid one-page PDF: a title and a few lines of text. ASCII only.
export function samplePdf(fileName, title, lines = []) {
  const content = [
    `BT /F1 22 Tf 60 720 Td (${escapePdf(title)}) Tj ET`,
    ...lines.map((line, i) => `BT /F1 13 Tf 60 ${680 - i * 24} Td (${escapePdf(line)}) Tj ET`),
    'BT /F1 10 Tf 60 60 Td (Sample document generated for the MOTEXA demo.) Tj ET',
  ].join('\n')
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ]

  let pdf = '%PDF-1.4\n'
  const offsets = objects.map((body, i) => {
    const offset = pdf.length
    pdf += `${i + 1} 0 obj\n${body}\nendobj\n`
    return offset
  })
  const xrefOffset = pdf.length
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
  pdf += offsets.map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`).join('')
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`

  return new File([pdf], fileName, { type: 'application/pdf', lastModified: 0 })
}

export { slug }

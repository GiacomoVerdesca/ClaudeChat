/**
 * Pre-estrae winCodeSign nella cache di electron-builder
 * escludendo le cartelle darwin/linux (che contengono symlink non creabili
 * su Windows senza Developer Mode o diritti admin).
 * Su Windows si usano solo i tool nella cartella win/.
 */
const { execSync } = require('child_process')
const https = require('https')
const http = require('http')
const fs = require('fs')
const path = require('path')
const os = require('os')

const VERSION = 'winCodeSign-2.6.0'
const URL = `https://github.com/electron-userland/electron-builder-binaries/releases/download/${VERSION}/${VERSION}.7z`
const CACHE_DIR = path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'), 'electron-builder', 'Cache', 'winCodeSign')
const EXTRACT_DIR = path.join(CACHE_DIR, VERSION)
const SEVENZIP = path.join(__dirname, '..', 'node_modules', '7zip-bin', 'win', 'x64', '7za.exe')
const TMP_ARCHIVE = path.join(CACHE_DIR, `${VERSION}.7z`)

async function main() {
  // Se la cache esiste già con file dentro, salta
  if (fs.existsSync(EXTRACT_DIR) && fs.readdirSync(EXTRACT_DIR).length > 2) {
    console.log('[prepare-winsign] Cache già presente, nessuna operazione necessaria.')
    return
  }

  fs.mkdirSync(CACHE_DIR, { recursive: true })

  console.log(`[prepare-winsign] Download ${VERSION}...`)
  await download(URL, TMP_ARCHIVE)
  console.log('[prepare-winsign] Download completato.')

  console.log('[prepare-winsign] Estrazione (solo tool Windows)...')
  // Esclude darwin/* e linux/* che contengono symlink non creabili senza privilegi.
  // Su Windows servono solo i file in win/.
  execSync(`"${SEVENZIP}" x -y -bd -x!darwin -x!linux "${TMP_ARCHIVE}" "-o${EXTRACT_DIR}"`, { stdio: 'inherit' })

  try { fs.unlinkSync(TMP_ARCHIVE) } catch { /* ignora */ }
  console.log('[prepare-winsign] Fatto. Cache popolata in:', EXTRACT_DIR)
}

function download(url, dest) {
  return new Promise((resolve, reject) => {
    const follow = (u) => {
      const mod = u.startsWith('https') ? https : http
      mod.get(u, (res) => {
        if (res.statusCode === 301 || res.statusCode === 302) {
          return follow(res.headers.location)
        }
        if (res.statusCode !== 200) {
          return reject(new Error(`HTTP ${res.statusCode} per ${u}`))
        }
        const file = fs.createWriteStream(dest)
        res.pipe(file)
        file.on('finish', () => file.close(resolve))
        file.on('error', reject)
      }).on('error', reject)
    }
    follow(url)
  })
}

main().catch(e => { console.error('[prepare-winsign] Errore:', e.message); process.exit(1) })

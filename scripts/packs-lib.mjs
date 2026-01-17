import fs from "node:fs/promises"
import fsSync from "node:fs"
import path from "node:path"
import os from "node:os"
import https from "node:https"
import { spawn } from "node:child_process"
import chalk from "chalk"
import dotenv from "dotenv"

dotenv.config({ path: path.resolve(process.cwd(), ".env"), quiet: true })

const PACKS_SOURCE_URL = "https://codeload.github.com/chielre/card-madness-packs/tar.gz/main"
const TRUTHY = new Set(["1", "true", "yes", "on"])

export function resolvePacksDir(packsDirEnv) {
  return path.isAbsolute(packsDirEnv) ? packsDirEnv : path.resolve(process.cwd(), packsDirEnv)
}

export function getPackFilterConfig() {
  const includeNsfwRaw = process.env.PACKS_DOWNLOAD_INCLUDE_NSFW
  const onlyCmRaw = process.env.PACKS_DOWNLOAD_ONLY_CM
  const includeNsfw = includeNsfwRaw == null ? true : TRUTHY.has(String(includeNsfwRaw).toLowerCase())
  const onlyCm = onlyCmRaw == null ? false : TRUTHY.has(String(onlyCmRaw).toLowerCase())

  return { includeNsfw, onlyCm }
}

export function createSpinner(label) {
  const frames = ["|", "/", "-", "\\"]
  let index = 0
  let timer = null
  let current = label
  const tick = () => {
    const frame = frames[index % frames.length]
    index += 1
    process.stdout.write(`\r${chalk.cyan(frame)} ${current}`)
  }
  return {
    start() {
      if (timer) return
      tick()
      timer = setInterval(tick, 80)
    },
    update(next) {
      current = next
    },
    stop(message) {
      if (timer) clearInterval(timer)
      timer = null
      process.stdout.write(`\r${chalk.green("✔")} ${message}\n`)
    },
    fail(message) {
      if (timer) clearInterval(timer)
      timer = null
      process.stdout.write(`\r${chalk.red("✖")} ${message}\n`)
    },
  }
}

export function logError(err) {
  console.error(chalk.red(err?.message || err))
}

function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    const request = https.get(url, (res) => {
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        const nextUrl = new URL(res.headers.location, url).toString()
        res.resume()
        return resolve(downloadFile(nextUrl, destPath))
      }
      if (res.statusCode !== 200) {
        res.resume()
        return reject(new Error(`Download failed (${res.statusCode}) for ${url}`))
      }
      const file = fsSync.createWriteStream(destPath)
      res.pipe(file)
      file.on("finish", () => file.close(resolve))
      file.on("error", reject)
    })
    request.on("error", reject)
  })
}

function runCommand(cmd, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: "inherit" })
    child.on("error", reject)
    child.on("close", (code) => {
      if (code === 0) resolve()
      else reject(new Error(`${cmd} exited with code ${code}`))
    })
  })
}

async function extractArchive(archivePath, destDir) {
  await fs.mkdir(destDir, { recursive: true })
  await runCommand("tar", ["--force-local", "-xzf", archivePath, "-C", destDir])
}

async function readPackMeta(packDir) {
  const packJsonPath = path.join(packDir, "pack.json")
  if (!fsSync.existsSync(packJsonPath)) return {}
  try {
    const raw = await fs.readFile(packJsonPath, "utf8")
    return raw.trim() ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

async function shouldIncludePack(packDir, packName, filter) {
  if (filter.onlyCm && !packName.startsWith("cm_")) return false
  if (!filter.includeNsfw) {
    const meta = await readPackMeta(packDir)
    if (meta?.nsfw === true) return false
  }
  return true
}

async function copyPackDirs(sourceDir, targetDir, filter) {
  await fs.mkdir(targetDir, { recursive: true })
  const entries = await fs.readdir(sourceDir, { withFileTypes: true })
  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    const src = path.join(sourceDir, entry.name)
    if (!(await shouldIncludePack(src, entry.name, filter))) continue
    const dst = path.join(targetDir, entry.name)
    await fs.rm(dst, { recursive: true, force: true })
    await fs.cp(src, dst, { recursive: true, force: true })
  }
}

async function copyLicense(sourceDir, targetDir) {
  const licensePath = path.join(sourceDir, "LICENSE")
  if (!fsSync.existsSync(licensePath)) return
  await fs.mkdir(targetDir, { recursive: true })
  await fs.cp(licensePath, path.join(targetDir, "LICENSE"), { force: true })
}

async function fetchSource() {
  const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), "card-madness-packs-"))
  const archivePath = path.join(tmpRoot, "packs.tar.gz")
  const extractDir = path.join(tmpRoot, "extract")

  await downloadFile(PACKS_SOURCE_URL, archivePath)
  await extractArchive(archivePath, extractDir)

  const topEntries = await fs.readdir(extractDir, { withFileTypes: true })
  const rootDir = topEntries.length === 1 && topEntries[0].isDirectory()
    ? path.join(extractDir, topEntries[0].name)
    : extractDir

  return { rootDir }
}

export async function installOrUpdatePacks(packsDirEnv, { label, updateOnly = false } = {}) {
  const packsDir = resolvePacksDir(packsDirEnv)
  const filter = getPackFilterConfig()
  const spinner = createSpinner(label || "Downloading packs")
  spinner.start()

  try {
    const { rootDir } = await fetchSource()
    spinner.update(updateOnly ? "Updating packs" : "Installing packs")
    await copyLicense(rootDir, packsDir)
    await copyPackDirs(rootDir, packsDir, filter)
    spinner.stop(chalk.green(`${updateOnly ? "Packs updated" : "Packs installed"} to ${packsDir}`))
  } catch (err) {
    spinner.fail("Pack install failed")
    throw err
  }
}

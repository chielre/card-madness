import path from "node:path"
import { spawn } from "node:child_process"

export async function updatePacksOnStart() {
    const TRUTHY = new Set(["1", "true", "yes", "on"])

    const enabled = TRUTHY.has(String(process.env.PACKS_UPDATE_ON_SERVER_START ?? "").toLowerCase())
    if (!enabled) return

    const projectRoot = path.resolve(process.cwd(), "..")
    const scriptPath = path.join(projectRoot, "scripts", "install-packs.mjs")

    await new Promise<void>((resolve, reject) => {
        const child = spawn(process.execPath, [scriptPath], {
            stdio: "inherit",
            cwd: projectRoot,
        })
        child.on("error", reject)
        child.on("close", (code) => {
            if (code === 0) resolve()
            else reject(new Error(`install-packs exited with code ${code}`))
        })
    })
}

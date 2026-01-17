#!/usr/bin/env node
import { installOrUpdatePacks, logError } from "./packs-lib.mjs"

const packsDirEnv = process.env.PACKS_DIR?.trim() || "packs"
const enabledRaw = process.env.PACKS_UPDATE_ON_CLIENT_BUILD
const enabled = enabledRaw == null
  ? true
  : ["1", "true", "yes", "on"].includes(String(enabledRaw).toLowerCase())

if (!enabled) {
  process.exit(0)
}

installOrUpdatePacks(packsDirEnv, { label: "Updating packs", updateOnly: true })
  .catch((err) => {
    logError(err)
    process.exitCode = 1
  })

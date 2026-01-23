#!/usr/bin/env node
import { installOrUpdatePacks, logError } from "./packs-lib.mjs"

const packsDirEnv = process.env.PACKS_DIR?.trim() || "packs"
const enabled = ["1", "true", "yes", "on"].includes(String(process.env.COMMUNITY_PACKS_UPDATE_ON_CLIENT_BUILD ?? "").toLowerCase())

if (!enabled) {
  process.exit(0)
}

installOrUpdatePacks(packsDirEnv, { label: "Updating packs", updateOnly: true })
  .catch((err) => {
    logError(err)
    process.exitCode = 1
  })

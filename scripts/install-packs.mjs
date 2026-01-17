#!/usr/bin/env node
import { installOrUpdatePacks, logError } from "./packs-lib.mjs"

const packsDirEnv = process.env.PACKS_DIR?.trim() || "packs"

installOrUpdatePacks(packsDirEnv, { label: "Downloading packs", updateOnly: false })
  .catch((err) => {
    logError(err)
    process.exitCode = 1
  })

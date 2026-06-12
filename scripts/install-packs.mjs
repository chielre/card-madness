#!/usr/bin/env node
import { installOrUpdatePacks, logError } from "./packs-lib.mjs"

const packsDirEnv = process.env.PACKS_DIR?.trim() || "packs"
const forceClean = process.argv.includes("--clean")

installOrUpdatePacks(packsDirEnv, { label: "Downloading packs", updateOnly: false, clean: forceClean })
  .catch((err) => {
    logError(err)
    process.exitCode = 1
  })

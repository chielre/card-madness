import { defineStore } from 'pinia'
import { Howl } from 'howler'

import themeMusic from '@assets/audio/theme.mp3'
import lobbyMusic from '@assets/audio/waiting_lobby.mp3'
import gameMusic from '@assets/audio/game.mp3'
import gameNsfwMusic from '@assets/audio/game_nsfw.mp3'
import gameCmdMusic from '@assets/audio/game_cmd.mp3'
import countDown52 from '@assets/audio/countdown_52.mp3'
import countDown33 from '@assets/audio/countdown_33.mp3'
import introGameMusic from '@assets/audio/intro_game.mp3'

type Track = string | null
type Seconds = '52' | '33'

let mainHowl: Howl | null = null
let lobbyHowl: Howl | null = null
let gameHowl: Howl | null = null
let gameNsfwHowl: Howl | null = null
let gameCmdHowl: Howl | null = null
let introGameHowl: Howl | null = null



const customHowls: Record<string, Howl> = {}
let oneShotHowl: Howl | null = null

let oneShotId: string | null = null

const loadPromises = new WeakMap<Howl, Promise<void>>()

function waitForLoad(howl: Howl) {
  const existing = loadPromises.get(howl)
  if (existing) return existing

  const p = new Promise<void>((resolve, reject) => {
    if (howl.state() === 'loaded') return resolve()

    const onLoad = () => { cleanup(); resolve() }
    const onError = (_id: number, err: unknown) => { cleanup(); reject(err) }

    const cleanup = () => {
      howl.off('load', onLoad)
      howl.off('loaderror', onError)
    }

    howl.once('load', onLoad)
    howl.once('loaderror', onError)
  })

  loadPromises.set(howl, p)
  return p
}

export const useAudioStore = defineStore('audio', {
  state: () => ({
    current: null as Track,
  }),
  actions: {
    // -------- ensure (maak/howl cache) --------
    ensureMain() {
      if (!mainHowl) mainHowl = new Howl({ src: [themeMusic], loop: true, volume: 0.5 })
      return mainHowl
    },
    ensureLobby() {
      if (!lobbyHowl) lobbyHowl = new Howl({ src: [lobbyMusic], loop: true, volume: 0.5 })
      return lobbyHowl
    },
    ensureGame() {
      if (!gameHowl) gameHowl = new Howl({ src: [gameMusic], loop: true, volume: 0.5 })
      return gameHowl
    },
    ensureGameNsfw() {
      if (!gameNsfwHowl) gameNsfwHowl = new Howl({ src: [gameNsfwMusic], loop: true, volume: 0.5 })
      return gameNsfwHowl
    },
    ensureGameCmd() {
      if (!gameCmdHowl) gameCmdHowl = new Howl({ src: [gameCmdMusic], loop: true, volume: 0.5 })
      return gameCmdHowl
    },
    ensureIntroGame() {
      if (!introGameHowl) introGameHowl = new Howl({ src: [introGameMusic], loop: true, volume: 0.5 })
      return introGameHowl
    },
    ensureCustom(key: string, src: string) {
      if (!customHowls[key]) customHowls[key] = new Howl({ src: [src], loop: true, volume: 0.5 })
      return customHowls[key]
    },

    ensureOneShot(id: string, src: string) {
      if (oneShotHowl && oneShotId === id) return oneShotHowl

      oneShotHowl?.unload()
      oneShotHowl = new Howl({ src: [src], loop: false, volume: 0.5 })
      oneShotId = id

      return oneShotHowl
    },

    readyMain() { return waitForLoad(this.ensureMain()) },
    readyLobby() { return waitForLoad(this.ensureLobby()) },
    readyGame() { return waitForLoad(this.ensureGame()) },
    readyGameNsfw() { return waitForLoad(this.ensureGameNsfw()) },
    readyGameCmd() { return waitForLoad(this.ensureGameCmd()) },
    readyIntroGame() { return waitForLoad(this.ensureIntroGame()) },
    readyCustom(key: string, src: string) { return waitForLoad(this.ensureCustom(key, src)) },

    readyCountDown(seconds: Seconds) {
      const src = seconds === '52' ? countDown52 : countDown33
      return waitForLoad(this.ensureOneShot(`countdown_${seconds}`, src))
    },

    readyCustomOnce(key: string, src: string) {
      return waitForLoad(this.ensureOneShot(`once:${key}`, src))
    },

    stopAll() {
      mainHowl?.stop()
      lobbyHowl?.stop()
      gameHowl?.stop()
      gameNsfwHowl?.stop()
      gameCmdHowl?.stop()
      oneShotHowl?.stop()
      Object.values(customHowls).forEach((h) => h.stop())
    },

    async playMain() {
      if (this.current === 'main') return
      this.stopAll()
      await this.readyMain()
      this.ensureMain().play()
      this.current = 'main'
    },

    async playLobby() {
      if (this.current === 'lobby') return
      this.stopAll()
      await this.readyLobby()
      this.ensureLobby().play()
      this.current = 'lobby'
    },

    async playGame() {
      if (this.current === 'game') return
      this.stopAll()
      await this.readyGame()
      this.ensureGame().play()
      this.current = 'game'
    },

    async playGameNsfw() {
      if (this.current === 'game_nsfw') return
      this.stopAll()
      await this.readyGameNsfw()
      this.ensureGameNsfw().play()
      this.current = 'game_nsfw'
    },

    async playGameCmd() {
      if (this.current === 'game_cmd') return
      this.stopAll()
      await this.readyGameCmd()
      this.ensureGameCmd().play()
      this.current = 'game_cmd'
    },

    async PlayIntroGame() {
      if (this.current === 'intro_game') return
      this.stopAll()
      await this.readyIntroGame()
      this.ensureIntroGame().play()
      this.current = 'intro_game'
    },

    async playCustom(key: string, src: string) {
      if (this.current === key) return
      this.stopAll()
      await this.readyCustom(key, src)
      this.ensureCustom(key, src).play()
      this.current = key
    },

    async playCountDown(seconds: Seconds) {
      const track = `once:countdown_${seconds}`
      if (this.current === track) return

      this.stopAll()
      await this.readyCountDown(seconds)

      oneShotHowl!.play()
      this.current = track
    },

    async playCustomOnce(key: string, src: string) {
      const track = `once:${key}`
      if (this.current === track) return

      this.stopAll()
      await this.readyCustomOnce(key, src)

      oneShotHowl!.play()
      this.current = track
    },
  },
})

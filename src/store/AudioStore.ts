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
let swooshHowl: Howl | null = null

const effectHowls: Record<string, Howl> = {}

const swooshFiles = import.meta.glob('@/assets/audio/effects/swoosh-*.mp3', {
  eager: true,
  import: 'default',
}) as Record<string, string>

const popFiles = import.meta.glob('@/assets/audio/effects/pop-*.mp3', {
  eager: true,
  import: 'default',
}) as Record<string, string>

const swooshUrls = Object.values(swooshFiles)
const popUrls = Object.values(popFiles)

function pickRandom<T>(arr: T[]) {
  return arr[Math.floor(Math.random() * arr.length)]
}

const customHowls: Record<string, Howl> = {}
let oneShotHowl: Howl | null = null
let oneShotId: string | null = null

const FADE_OUT_MS = 400

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

function fadeOutHowl(howl: Howl, duration = FADE_OUT_MS) {
  const currentVolume = howl.volume()
  const soundIds = (howl as any)._sounds?.map((s: { _id: number }) => s._id) ?? []
  const activeIds = soundIds.filter((id: number) => howl.playing(id))

  if (!activeIds.length) return

  activeIds.forEach((id: number) => {
    howl.fade(currentVolume, 0, duration, id)
  })

  setTimeout(() => {
    activeIds.forEach((id: number) => {
      if (howl.playing(id)) howl.stop(id)
    })
    howl.volume(currentVolume)
  }, duration + 20)
}

export const useAudioStore = defineStore('audio', {
  state: () => ({
    current: null as Track,
  }),
  actions: {
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
      if (!introGameHowl) introGameHowl = new Howl({ src: [introGameMusic], loop: false, volume: 0.5 })
      return introGameHowl
    },
    ensureCustom(key: string, src: string) {
      if (!customHowls[key]) customHowls[key] = new Howl({ src: [src], loop: true, volume: 0.5 })
      return customHowls[key]
    },
    ensureEffect(key: string, src: string, volume = 0.7) {
      if (!effectHowls[key]) effectHowls[key] = new Howl({ src: [src], loop: false, volume })
      return effectHowls[key]
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
    readyEffect(key: string, src: string, volume = 0.7) { return waitForLoad(this.ensureEffect(key, src, volume)) },

    readyCountDown(seconds: Seconds) {
      const src = seconds === '52' ? countDown52 : countDown33
      return this.readyEffect(`countdown_${seconds}`, src)
    },

    readyCustomOnce(key: string, src: string) {
      return waitForLoad(this.ensureOneShot(`once:${key}`, src))
    },

    stopAll() {
      if (mainHowl) fadeOutHowl(mainHowl)
      if (lobbyHowl) fadeOutHowl(lobbyHowl)
      if (gameHowl) fadeOutHowl(gameHowl)
      if (gameNsfwHowl) fadeOutHowl(gameNsfwHowl)
      if (gameCmdHowl) fadeOutHowl(gameCmdHowl)
      if (introGameHowl) fadeOutHowl(introGameHowl)
      if (oneShotHowl) fadeOutHowl(oneShotHowl)
      Object.values(customHowls).forEach((h) => fadeOutHowl(h))
      Object.values(effectHowls).forEach((h) => fadeOutHowl(h))
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
      const src = seconds === '52' ? countDown52 : countDown33
      await this.readyEffect(`countdown_${seconds}`, src)
      this.ensureEffect(`countdown_${seconds}`, src).play()
      this.current = track
    },

    async playReadySwoosh() {
      if (!swooshUrls.length) return
      const src = pickRandom(swooshUrls)

      await this.readyEffect(`swoosh:${src}`, src)
      this.ensureEffect(`swoosh:${src}`, src).play()
    },

    async playPop() {
      if (!popUrls.length) return
      const src = pickRandom(popUrls)
      await this.readyEffect(`pop:${src}`, src)
      this.ensureEffect(`pop:${src}`, src).play()
    },

    async playCustomOnce(key: string, src: string) {
      const track = `once:${key}`
      if (this.current === track) return

      this.stopAll()
      await this.readyCustomOnce(key, src)

      oneShotHowl!.play()
      this.current = track
    },

    playEffectOnce(src: string, volume = 0.7) {
      const key = `effect:${src}`
      const fx = this.ensureEffect(key, src, volume)
      fx.play()
    },

    async preloadAllAudioWithProgress(onProgress?: (loaded: number, total: number) => void) {
      const howls = new Set<Howl>()

      // loops / tracks
      howls.add(this.ensureMain())
      howls.add(this.ensureLobby())
      howls.add(this.ensureGame())
      howls.add(this.ensureGameNsfw())
      howls.add(this.ensureGameCmd())
      howls.add(this.ensureIntroGame())

      // effects
      howls.add(this.ensureEffect('countdown_52', countDown52))
      howls.add(this.ensureEffect('countdown_33', countDown33))
      swooshUrls.forEach((src) => {
        howls.add(this.ensureEffect(`swoosh:${src}`, src))
      })

      const items = Array.from(howls)
      const total = items.length
      let loaded = 0

      const jobs = items.map((howl) =>
        waitForLoad(howl).finally(() => {
          loaded += 1
          onProgress?.(loaded, total)
        })
      )

      await Promise.allSettled(jobs)
      return { loaded, total }
    },

  },


})

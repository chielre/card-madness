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
import gameRound1Music from '@assets/audio/game_1.mp3'
import gameRound2Music from '@assets/audio/game_2.mp3'
import wrapMusic from '@assets/audio/wrap.mp3'
import countDown1m from '@assets/audio/countdown1m.mp3'
import wrapCzarMusic from '@assets/audio/wrap_czar.mp3'

type Track = string | null
type Seconds = '52' | '33'

let mainHowl: Howl | null = null
let lobbyHowl: Howl | null = null
let gameHowl: Howl | null = null
let gameNsfwHowl: Howl | null = null
let gameCmdHowl: Howl | null = null
let introGameHowl: Howl | null = null
let gameRoundHowl1: Howl | null = null
let gameRoundHowl2: Howl | null = null
let swooshHowl: Howl | null = null

const effectHowls: Record<string, Howl> = {}
const effectBaseVolumes = new Map<string, number>()
const musicEffectHowls: Record<string, Howl> = {}
const musicEffectBaseVolumes = new Map<string, number>()
let oneShotBaseVolume = 0.5
let musicOneShotBaseVolume = 0.5

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
let musicOneShotHowl: Howl | null = null
let musicOneShotId: string | null = null

const MUSIC_BASE_VOLUME = 0.5
const SFX_BASE_VOLUME = 0.7

const FADE_OUT_MS = 400
let roundLoopActive = false

const loadPromises = new WeakMap<Howl, Promise<void>>()

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value))
}

function getMusicVolume(enabled: boolean, master: number) {
  return enabled ? MUSIC_BASE_VOLUME * master : 0
}

function getSfxVolume(enabled: boolean, master: number, base: number) {
  return enabled ? base * master : 0
}

function getMusicEffectVolume(enabled: boolean, master: number, base: number) {
  return enabled ? base * master : 0
}

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

function stopMusicHowls() {
  if (mainHowl) fadeOutHowl(mainHowl)
  if (lobbyHowl) fadeOutHowl(lobbyHowl)
  if (gameHowl) fadeOutHowl(gameHowl)
  if (gameNsfwHowl) fadeOutHowl(gameNsfwHowl)
  if (gameCmdHowl) fadeOutHowl(gameCmdHowl)
  if (introGameHowl) fadeOutHowl(introGameHowl)
  if (gameRoundHowl1) fadeOutHowl(gameRoundHowl1)
  if (gameRoundHowl2) fadeOutHowl(gameRoundHowl2)

  Object.values(customHowls).forEach((h) => fadeOutHowl(h))
  Object.values(musicEffectHowls).forEach((h) => fadeOutHowl(h))
  if (musicOneShotHowl) fadeOutHowl(musicOneShotHowl)
}

function stopSfxHowls() {
  if (oneShotHowl) fadeOutHowl(oneShotHowl)
  Object.values(effectHowls).forEach((h) => fadeOutHowl(h))
}

function applyMusicVolumes(enabled: boolean, master: number) {
  const volume = getMusicVolume(enabled, master)
  if (mainHowl) mainHowl.volume(volume)
  if (lobbyHowl) lobbyHowl.volume(volume)
  if (gameHowl) gameHowl.volume(volume)
  if (gameNsfwHowl) gameNsfwHowl.volume(volume)
  if (gameCmdHowl) gameCmdHowl.volume(volume)
  if (introGameHowl) introGameHowl.volume(volume)
  if (gameRoundHowl1) gameRoundHowl1.volume(volume)
  if (gameRoundHowl2) gameRoundHowl2.volume(volume)

  Object.values(customHowls).forEach((h) => h.volume(volume))
  Object.entries(musicEffectHowls).forEach(([key, howl]) => {
    const base = musicEffectBaseVolumes.get(key) ?? MUSIC_BASE_VOLUME
    howl.volume(getMusicEffectVolume(enabled, master, base))
  })
  if (musicOneShotHowl) {
    musicOneShotHowl.volume(getMusicEffectVolume(enabled, master, musicOneShotBaseVolume))
  }
}

function applySfxVolumes(enabled: boolean, master: number) {
  Object.entries(effectHowls).forEach(([key, howl]) => {
    const base = effectBaseVolumes.get(key) ?? SFX_BASE_VOLUME
    howl.volume(getSfxVolume(enabled, master, base))
  })

  if (oneShotHowl) {
    oneShotHowl.volume(getSfxVolume(enabled, master, oneShotBaseVolume))
  }
}

function wireRoundLoopHandlers() {
  if (!gameRoundHowl1 || !gameRoundHowl2) return
  gameRoundHowl1.off('end', onRound1End)
  gameRoundHowl2.off('end', onRound2End)
  gameRoundHowl1.on('end', onRound1End)
  gameRoundHowl2.on('end', onRound2End)
}

function onRound1End() {
  if (!roundLoopActive || !gameRoundHowl2) return
  gameRoundHowl2.play()
}

function onRound2End() {
  if (!roundLoopActive || !gameRoundHowl1) return
  gameRoundHowl1.play()
}

export const useAudioStore = defineStore('audio', {
  state: () => ({
    current: null as Track,
    musicEnabled: true,
    sfxEnabled: true,
    musicMaster: .5,
    sfxMaster: .5,
  }),
  actions: {
    setMusicEnabled(enabled: boolean) {
      this.musicEnabled = enabled
      applyMusicVolumes(enabled, this.musicMaster)
      if (!enabled) {
        stopMusicHowls()
        this.current = null
      }
    },
    setSfxEnabled(enabled: boolean) {
      this.sfxEnabled = enabled
      applySfxVolumes(enabled, this.sfxMaster)
      if (!enabled) stopSfxHowls()
    },
    setMusicMaster(value: number) {
      this.musicMaster = clamp01(value)
      applyMusicVolumes(this.musicEnabled, this.musicMaster)
    },
    setSfxMaster(value: number) {
      this.sfxMaster = clamp01(value)
      applySfxVolumes(this.sfxEnabled, this.sfxMaster)
      this.playPop()

    },

    ensureMain() {
      if (!mainHowl) mainHowl = new Howl({ src: [themeMusic], loop: true, volume: getMusicVolume(this.musicEnabled, this.musicMaster) })
      return mainHowl
    },
    ensureLobby() {
      if (!lobbyHowl) lobbyHowl = new Howl({ src: [lobbyMusic], loop: true, volume: getMusicVolume(this.musicEnabled, this.musicMaster) })
      return lobbyHowl
    },
    ensureGame() {
      if (!gameHowl) gameHowl = new Howl({ src: [gameMusic], loop: true, volume: getMusicVolume(this.musicEnabled, this.musicMaster) })
      return gameHowl
    },
    ensureGameNsfw() {
      if (!gameNsfwHowl) gameNsfwHowl = new Howl({ src: [gameNsfwMusic], loop: true, volume: getMusicVolume(this.musicEnabled, this.musicMaster) })
      return gameNsfwHowl
    },
    ensureGameCmd() {
      if (!gameCmdHowl) gameCmdHowl = new Howl({ src: [gameCmdMusic], loop: true, volume: getMusicVolume(this.musicEnabled, this.musicMaster) })
      return gameCmdHowl
    },
    ensureIntroGame() {
      if (!introGameHowl) introGameHowl = new Howl({ src: [introGameMusic], loop: false, volume: getMusicVolume(this.musicEnabled, this.musicMaster) })
      return introGameHowl
    },
    ensureGameRound1() {
      if (!gameRoundHowl1) gameRoundHowl1 = new Howl({ src: [gameRound1Music], loop: false, volume: getMusicVolume(this.musicEnabled, this.musicMaster) })
      return gameRoundHowl1
    },
    ensureGameRound2() {
      if (!gameRoundHowl2) gameRoundHowl2 = new Howl({ src: [gameRound2Music], loop: false, volume: getMusicVolume(this.musicEnabled, this.musicMaster) })
      return gameRoundHowl2
    },
    ensureCustom(key: string, src: string) {
      if (!customHowls[key]) customHowls[key] = new Howl({ src: [src], loop: true, volume: getMusicVolume(this.musicEnabled, this.musicMaster) })
      return customHowls[key]
    },
    ensureEffect(key: string, src: string, volume = 0.7) {
      effectBaseVolumes.set(key, volume)
      if (!effectHowls[key]) {
        effectHowls[key] = new Howl({ src: [src], loop: false, volume: getSfxVolume(this.sfxEnabled, this.sfxMaster, volume) })
      } else {
        effectHowls[key].volume(getSfxVolume(this.sfxEnabled, this.sfxMaster, volume))
      }
      return effectHowls[key]
    },
    ensureMusicEffect(key: string, src: string, volume = 0.7) {
      musicEffectBaseVolumes.set(key, volume)
      if (!musicEffectHowls[key]) {
        musicEffectHowls[key] = new Howl({ src: [src], loop: false, volume: getMusicEffectVolume(this.musicEnabled, this.musicMaster, volume) })
      } else {
        musicEffectHowls[key].volume(getMusicEffectVolume(this.musicEnabled, this.musicMaster, volume))
      }
      return musicEffectHowls[key]
    },
    ensureOneShot(id: string, src: string) {
      if (oneShotHowl && oneShotId === id) return oneShotHowl
      oneShotHowl?.unload()
      oneShotBaseVolume = 0.5
      oneShotHowl = new Howl({ src: [src], loop: false, volume: getSfxVolume(this.sfxEnabled, this.sfxMaster, oneShotBaseVolume) })
      oneShotId = id
      return oneShotHowl
    },
    ensureMusicOneShot(id: string, src: string) {
      if (musicOneShotHowl && musicOneShotId === id) return musicOneShotHowl
      musicOneShotHowl?.unload()
      musicOneShotBaseVolume = 0.5
      musicOneShotHowl = new Howl({ src: [src], loop: false, volume: getMusicEffectVolume(this.musicEnabled, this.musicMaster, musicOneShotBaseVolume) })
      musicOneShotId = id
      return musicOneShotHowl
    },

    readyMain() { return waitForLoad(this.ensureMain()) },
    readyLobby() { return waitForLoad(this.ensureLobby()) },
    readyGame() { return waitForLoad(this.ensureGame()) },
    readyGameNsfw() { return waitForLoad(this.ensureGameNsfw()) },
    readyGameCmd() { return waitForLoad(this.ensureGameCmd()) },
    readyIntroGame() { return waitForLoad(this.ensureIntroGame()) },
    readyGameRound1() { return waitForLoad(this.ensureGameRound1()) },
    readyGameRound2() { return waitForLoad(this.ensureGameRound2()) },

    readyCustom(key: string, src: string) { return waitForLoad(this.ensureCustom(key, src)) },
    readyEffect(key: string, src: string, volume = 0.7) { return waitForLoad(this.ensureEffect(key, src, volume)) },
    readyMusicEffect(key: string, src: string, volume = 0.7) { return waitForLoad(this.ensureMusicEffect(key, src, volume)) },

    readyCountDown(seconds: Seconds) {
      const src = seconds === '52' ? countDown52 : countDown33
      return this.readyMusicEffect(`countdown_${seconds}`, src)
    },
    readyCountDown1m() {
      return this.readyMusicEffect('countdown_1m', countDown1m)
    },

    readyCustomOnce(key: string, src: string) {
      return waitForLoad(this.ensureMusicOneShot(`once:${key}`, src))
    },
    readyWrap() {
      return this.readyMusicEffect('wrap', wrapMusic)
    },
    readyWrapCzar() {
      return this.readyMusicEffect('wrap_czar', wrapCzarMusic)
    },

    stopAll() {
      roundLoopActive = false
      stopMusicHowls()
      stopSfxHowls()
    },

    async playMain() {
      if (!this.musicEnabled) return
      if (this.current === 'main') return
      this.stopAll()
      await this.readyMain()
      this.ensureMain().play()
      this.current = 'main'
    },

    async playLobby() {
      if (!this.musicEnabled) return
      if (this.current === 'lobby') return
      this.stopAll()
      await this.readyLobby()
      this.ensureLobby().play()
      this.current = 'lobby'
    },

    async playGame() {
      if (!this.musicEnabled) return
      if (this.current === 'game') return
      this.stopAll()
      await this.readyGame()
      this.ensureGame().play()
      this.current = 'game'
    },

    async playGameNsfw() {
      if (!this.musicEnabled) return
      if (this.current === 'game_nsfw') return
      this.stopAll()
      await this.readyGameNsfw()
      this.ensureGameNsfw().play()
      this.current = 'game_nsfw'
    },

    async playGameCmd() {
      if (!this.musicEnabled) return
      if (this.current === 'game_cmd') return
      this.stopAll()
      await this.readyGameCmd()
      this.ensureGameCmd().play()
      this.current = 'game_cmd'
    },

    async PlayIntroGame() {
      if (!this.musicEnabled) return
      if (this.current === 'intro_game') return
      this.stopAll()
      await this.readyIntroGame()
      this.ensureIntroGame().play()
      this.current = 'intro_game'
    },

    async playRoundLoop() {
      if (!this.musicEnabled) return
      if (this.current === 'game_round_loop' && roundLoopActive) return
      this.stopAll()
      await Promise.all([this.readyGameRound1(), this.readyGameRound2()])
      this.ensureGameRound1()
      this.ensureGameRound2()
      wireRoundLoopHandlers()
      roundLoopActive = true
      gameRoundHowl1!.play()
      this.current = 'game_round_loop'
    },

    async playCustom(key: string, src: string) {
      if (!this.musicEnabled) return
      if (this.current === key) return
      this.stopAll()
      await this.readyCustom(key, src)
      this.ensureCustom(key, src).play()
      this.current = key
    },

    async playCountDown(seconds: Seconds) {
      if (!this.musicEnabled) return
      const track = `once:countdown_${seconds}`
      if (this.current === track) return

      this.stopAll()
      const src = seconds === '52' ? countDown52 : countDown33
      await this.readyMusicEffect(`countdown_${seconds}`, src)
      this.ensureMusicEffect(`countdown_${seconds}`, src).play()
      this.current = track
    },
    async playCountDown1m() {
      if (!this.musicEnabled) return
      const track = 'once:countdown_1m'
      if (this.current === track) return

      this.stopAll()
      await this.readyCountDown1m()
      this.ensureMusicEffect('countdown_1m', countDown1m).play()
      this.current = track
    },

    async playReadySwoosh() {
      if (!this.sfxEnabled) return
      if (!swooshUrls.length) return
      const src = pickRandom(swooshUrls)

      await this.readyEffect(`swoosh:${src}`, src)
      this.ensureEffect(`swoosh:${src}`, src).play()
    },

    async playPop() {
      if (!this.sfxEnabled) return
      if (!popUrls.length) return
      const src = pickRandom(popUrls)
      await this.readyEffect(`pop:${src}`, src)
      this.ensureEffect(`pop:${src}`, src).play()
    },

    async playCustomOnce(key: string, src: string) {
      if (!this.musicEnabled) return
      const track = `once:${key}`
      if (this.current === track) return

      this.stopAll()
      await this.readyCustomOnce(key, src)

      musicOneShotHowl!.play()
      this.current = track
    },

    async playWrapOnce() {
      if (!this.musicEnabled) return
      const track = 'once:wrap'
      if (this.current === track) return

      this.stopAll()
      await this.readyWrap()
      this.ensureMusicEffect('wrap', wrapMusic).play()
      this.current = track
    },

    async playWrapCzarOnce() {
      if (!this.musicEnabled) return
      const track = 'once:wrap_czar'
      if (this.current === track) return

      this.stopAll()
      await this.readyWrapCzar()
      this.ensureMusicEffect('wrap_czar', wrapCzarMusic).play()
      this.current = track
    },

    playEffectOnce(src: string, volume = 0.7) {
      if (!this.sfxEnabled) return
      const key = `effect:${src}`
      const fx = this.ensureEffect(key, src, volume)
      this.stopAll()

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
      howls.add(this.ensureGameRound1())
      howls.add(this.ensureGameRound2())

      // effects
      howls.add(this.ensureMusicEffect('countdown_52', countDown52))
      howls.add(this.ensureMusicEffect('countdown_33', countDown33))
      howls.add(this.ensureMusicEffect('countdown_1m', countDown1m))
      howls.add(this.ensureMusicEffect('wrap', wrapMusic))
      howls.add(this.ensureMusicEffect('wrap_czar', wrapCzarMusic))

      swooshUrls.forEach((src) => {
        howls.add(this.ensureEffect(`swoosh:${src}`, src))
      })

      popUrls.forEach((src) => {
        howls.add(this.ensureEffect(`pop:${src}`, src))
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

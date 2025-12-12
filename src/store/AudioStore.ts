import { defineStore } from 'pinia'
import { Howl } from 'howler'

import themeMusic from '@assets/audio/theme.mp3'
import lobbyMusic from '@assets/audio/waiting_lobby.mp3'
import gameMusic from '@assets/audio/game.mp3'
import gameNsfwMusic from '@assets/audio/game_nsfw.mp3'
import gameCmdMusic from '@assets/audio/game_cmd.mp3'

type Track = string | null

let mainHowl: Howl | null = null
let lobbyHowl: Howl | null = null
let gameHowl: Howl | null = null
let gameNsfwHowl: Howl | null = null
const customHowls: Record<string, Howl> = {}
let oneShotHowl: Howl | null = null

export const useAudioStore = defineStore('audio', {
    state: () => ({
        current: null as Track,
    }),
    actions: {
        ensureMain() {
            if (!mainHowl) {
                mainHowl = new Howl({
                    src: [themeMusic],
                    loop: true,
                    volume: 0.5,
                })
            }
            return mainHowl
        },
        ensureLobby() {
            if (!lobbyHowl) {
                lobbyHowl = new Howl({
                    src: [lobbyMusic],
                    loop: true,
                    volume: 0.5,
                })
            }
            return lobbyHowl
        },
        stopAll() {
            mainHowl?.stop()
            lobbyHowl?.stop()
            gameHowl?.stop()
            gameNsfwHowl?.stop()
            oneShotHowl?.stop()
            Object.values(customHowls).forEach((h) => h.stop())
        },
        playMain() {
            if (this.current === 'main') return
            this.stopAll()
            this.ensureMain().play()
            this.current = 'main'
        },
        playLobby() {
            if (this.current === 'lobby') return
            this.stopAll()
            this.ensureLobby().play()
            this.current = 'lobby'
        },
        ensureGame() {
            if (!gameHowl) {
                gameHowl = new Howl({
                    src: [gameMusic],
                    loop: true,
                    volume: 0.5,
                })
            }
            return gameHowl
        },
        ensureGameNsfw() {
            if (!gameNsfwHowl) {
                gameNsfwHowl = new Howl({
                    src: [gameNsfwMusic],
                    loop: true,
                    volume: 0.5,
                })
            }
            return gameNsfwHowl
        },
        playGame() {
            if (this.current === 'game') return
            this.stopAll()
            this.ensureGame().play()
            this.current = 'game'
        },
        playGameNsfw() {
            if (this.current === 'game_nsfw') return
            this.stopAll()
            this.ensureGameNsfw().play()
            this.current = 'game_nsfw'
        },
        ensureCustom(key: string, src: string) {
            if (!customHowls[key]) {
                customHowls[key] = new Howl({
                    src: [src],
                    loop: true,
                    volume: 0.5,
                })
            }
            return customHowls[key]
        },
        playCustom(key: string, src: string) {
            if (this.current === key) return
            this.stopAll()
            this.ensureCustom(key, src).play()
            this.current = key
        },

        playCustomOnce(key: string, src: string) {
            if (this.current === `once:${key}`) return
            this.stopAll()
            oneShotHowl?.unload()
            oneShotHowl = new Howl({
                src: [src],
                loop: false,
                volume: 0.5,
            })
            oneShotHowl.play()
            this.current = `once:${key}`
        },
    },
})

import { createRouter, createWebHistory, RouteRecordRaw } from 'vue-router'
import CreateLobby from '@/pages/CreateLobby.vue'
import Main from '@/pages/MainPage.vue'
import Game from '@/pages/Game.vue'
import Dev from '@/pages/Dev.vue'
import ConnectionError from '@/pages/ConnectionError.vue'

const routes: RouteRecordRaw[] = [
    {
        path: '/',
        name: 'main',
        component: Main,
    },
    {
        path: '/lobby',
        name: 'lobby',
        component: CreateLobby,
    },
    {
        path: '/game/:id',
        name: 'game',
        component: Game,
    },
    {
        path: '/error',
        name: 'error',
        component: ConnectionError,
    },
    {
        path: '/dev',
        name: 'dev',
        component: Dev,
    },

]

const router = createRouter({
    history: createWebHistory(import.meta.env.BASE_URL),
    routes,
})

export default router

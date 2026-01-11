import { defineConfig, loadEnv } from "vite"
import vue from "@vitejs/plugin-vue"
import path from "path"
import tailwindcss from "@tailwindcss/vite"

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, process.cwd(), "")

    return {
        plugins: [vue(), tailwindcss()],
        base: '/card-madness/',
        define: {
            'import.meta.env.STAGE': JSON.stringify(env.STAGE),
            'import.meta.env.DEV_PLAY_INTRO': JSON.stringify(env.DEV_PLAY_INTRO),
            'import.meta.env.DEV_PHASE_BUTTONS': JSON.stringify(env.DEV_PHASE_BUTTONS),
        },

        resolve: {
            alias: {
                "@": path.resolve(__dirname, "./src"),
                "@components": path.resolve(__dirname, "./src/components"),
                "@game": path.resolve(__dirname, "./src/game"),
                "@store": path.resolve(__dirname, "./src/store"),
                "@ws": path.resolve(__dirname, "./src/ws"),
                "@assets": path.resolve(__dirname, "./src/assets"),
            },
        },

        server: {
            port: Number(env.VITE_DEV_PORT || 5173),
            open: true,
        },

        build: {
            sourcemap: false,
            target: "esnext",
            outDir: "dist",
            rollupOptions: {
                output: {
                    manualChunks: {
                        vue: ["vue"],
                        vendor: ["gsap", "howler", "interactjs"],
                    },
                },
            },
        },
    }
})

import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router/index'
import './styles/base.css' 

import { strLimit } from '@/utils/str'

const app = createApp(App)

app.use(createPinia())
app.use(router)

app.mount('#app')

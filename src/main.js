/**
 * Main entry point | 主入口
 */
import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import { pinia } from './stores/pinia'
import './style.css'
import './styles/tokens.css'

const app = createApp(App)

app.use(pinia)
app.use(router)
app.mount('#app')

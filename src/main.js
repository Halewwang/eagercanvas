/**
 * Main entry point | 主入口
 */
import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import './style.css'

try {
  localStorage.removeItem('apiKey')
} catch {
  // ignore
}

const app = createApp(App)

app.use(router)
app.mount('#app')

/**
 * Main entry point | 主入口
 */
import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import { pinia } from './stores/pinia'
import { recoverRouteAssetLoadFailure } from './utils/routeLoadRecovery.js'
import './style.css'
import './styles/tokens.css'

const app = createApp(App)

router.onError((error) => recoverRouteAssetLoadFailure({ error }))
app.use(pinia)
app.use(router)
app.mount('#app')

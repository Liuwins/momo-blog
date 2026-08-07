import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import { createPinia } from 'pinia'
import { installPlugins } from './plugins'
import { Lazyload } from 'vant'
import 'vant/es/lazyload/style'
import './styles/variables.css'
// import './mock'  // 已切换到真实后端，关闭 mock

const app = createApp(App)
app.use(router)
app.use(createPinia())
app.use(installPlugins)
app.use(Lazyload, { lazyComponent: true })
app.mount('#app')

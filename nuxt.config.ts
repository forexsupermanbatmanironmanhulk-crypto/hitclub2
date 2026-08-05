export default defineNuxtConfig({
  devtools: { enabled: true },
  css: ['~/assets/css/main.css'],
  app: {
    head: {
      title: 'Lumen Play — Demo Coin',
      meta: [{ name: 'description', content: 'Nền tảng game giải trí dùng demo coin.' }]
    }
  },
  runtimeConfig: {
    public: { apiBase: process.env.NUXT_PUBLIC_API_BASE || 'http://127.0.0.1:8787' }
  }
})

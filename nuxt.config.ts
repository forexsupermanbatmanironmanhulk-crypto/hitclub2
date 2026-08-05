export default defineNuxtConfig({
  devtools: { enabled: true },
  css: ['~/assets/css/main.css', '~/assets/css/casino-theme.css'],
  app: {
    head: {
      title: 'HIT CLUB',
      meta: [{ name: 'description', content: 'HIT CLUB — Nền tảng game giải trí trực tuyến.' }]
    }
  },
  runtimeConfig: {
    public: { apiBase: process.env.NUXT_PUBLIC_API_BASE || 'http://127.0.0.1:8787' }
  }
})

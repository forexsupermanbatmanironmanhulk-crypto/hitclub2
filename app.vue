<script setup lang="ts">
import logoUrl from '~/assets/img/logo.png'
import imgBannerMini from '~/assets/img/banner mini.png'
import imgRuong from '~/assets/img/ruong.png'
import imgKhuyenMai from '~/assets/img/khuyen-mai.png'
import imgTaiXiu from '~/assets/img/tai-xiu.png'
import imgXocDia from '~/assets/img/xoc-dia.png'
import imgBauCua from '~/assets/img/bau-cua.png'
import imgNoHu from '~/assets/img/no-hu.png'
import imgKeno from '~/assets/img/keno.png'
import imgMines from '~/assets/img/mines.png'
import imgTienLenDemLa from '~/assets/img/tien-len-dem-la.png'
import imgMauBinh from '~/assets/img/mau-binh.png'
import imgPoker from '~/assets/img/pocker.png'
import imgSam from '~/assets/img/sam.png'
import imgCatte from '~/assets/img/cattie.png'
import imgTienLenMienNam from '~/assets/img/tien-len-mien-nam.png'
import imgPhom from '~/assets/img/phom.png'
import imgLieng from '~/assets/img/lieng.png'
import imgXiTo from '~/assets/img/xi-to.png'
import imgXiDach from '~/assets/img/xi-dach.png'

type Tab = 'home' | 'wallet' | 'admin'
type AdminSection = 'overview' | 'payments' | 'users' | 'transactions'
type AdminUser = { id: string; email: string; username: string; role: 'player' | 'admin'; status: 'active' | 'suspended'; demoBalance: number; createdAt: string }
type Request = { id: string; user: string; method: string; txType: string; amount: number; status: 'Chờ duyệt' | 'Đã duyệt' | 'Từ chối'; created: string; note?: string }

const tab = ref<Tab>('home')
const showAuth = ref(false)
const authMode = ref<'login' | 'register'>('login')
const loggedIn = ref(false)
const isAdmin = ref(false)
const fullName = ref('')
const email = ref('')
const password = ref('')
const balance = ref(0)
const toast = ref('')
const walletAction = ref<'deposit' | 'withdraw'>('deposit')
const method = ref<'bank' | 'binance'>('bank')
const amount = ref<number | null>(100000)
const bankName = ref('Vietcombank')
const bankAccount = ref('')
const bankHolder = ref('')
const bankQrUrl = ref('')
const qrCacheBust = ref(0)
const trc20Address = ref('')
const trc20QrUrl = ref('')
const minDeposit = ref(100000)
const minWithdraw = ref(200000)
const withdrawBankName = ref('')
const withdrawAccount = ref('')
const withdrawAccountName = ref('')
const withdrawWallet = ref('')
const walletBusy = ref(false)
const qrUploadBusy = ref(false)
const trc20QrUploadBusy = ref(false)
const showMaintenance = ref(false)
const maintenanceName = ref('')
const activeGame = ref<string | null>(null)
const activeGameName = ref('')
const activeGameIcon = ref('✦')
const activeGameImage = ref('')
const gameBet = ref(10000)
const gameChoice = ref('Mặc định')
const gameBusy = ref(false)
const gameResult = ref<{ won: boolean; payout: number; multiplier: number; message: string } | null>(null)
const roomOnline = ref(0)
const sicbo = ref<{ phase: string; closesAt: number; tai: number; xiu: number; dice?: number[]; result?: string } | null>(null)
const secondsLeft = ref(60)
let clockHandle: ReturnType<typeof setInterval> | null = null
let gameSocket: WebSocket | null = null
const requests = ref<Request[]>([])
const apiToken = ref('')
const apiBase = useRuntimeConfig().public.apiBase.replace(/\/$/, '')
const activeCategory = ref('all')
const captchaInput = ref('')
const captchaAnswer = ref('')
const captchaChars = ref<{ char: string; cls: string }[]>([])
const showWalletModal = ref(false)
const showMenu = ref(false)
const favoriteIds = ref<string[]>([])
const adminSection = ref<AdminSection>('overview')
const adminStats = ref({ totalUsers: 0, activePlayers: 0, pendingRequests: 0, totalBalance: 0, todayTransactions: 0 })
const adminUsers = ref<AdminUser[]>([])
const userSearch = ref('')
const userEdits = ref<Record<string, { role: AdminUser['role']; status: AdminUser['status']; balance: number }>>({})
const adminMenu = [
  { id: 'overview' as AdminSection, label: 'Tổng quan', icon: '📊' },
  { id: 'payments' as AdminSection, label: 'Nạp / Rút', icon: '💳' },
  { id: 'users' as AdminSection, label: 'Quản lý user', icon: '👥' },
  { id: 'transactions' as AdminSection, label: 'Lịch sử GD', icon: '📋' }
]

const tickerItems = [
  'Tài Xỉu Hayanhaylam9999 thắng 25.610.000',
  'Xóc Đĩa minhpro88 thắng 12.400.000',
  'Tài Xỉu Van251299 thắng 98.500.000',
  'Nổ Hũ lucky777 thắng 5.200.000'
]

const categories = [
  { id: 'all', label: 'ALL GAMES' },
  { id: 'favorite', label: 'YÊU THÍCH ★' },
  { id: 'card', label: 'GAME BÀI' },
  { id: 'slots', label: 'SLOTS' },
  { id: 'live', label: 'LIVE ●' },
  { id: 'other', label: 'KHÁC' }
]

type GameCard = {
  name: string
  id: string
  icon: string
  image?: string
  artClass: string
  category: string
  jackpot?: string
  bonus?: string
  isNew?: boolean
  isLive?: boolean
  stats?: { black: number; white: number }
  showDots?: boolean
  showPlay?: boolean
  defaultFavorite?: boolean
  maintenance?: boolean
}

const lobbyGames: GameCard[] = [
  { name: 'TÀI XỈU', id: 'sic-bo-aurora', icon: '⚅⚅', image: imgTaiXiu, artClass: 'gc-taixiu', category: 'live', jackpot: '₫ 4,092,407,298', defaultFavorite: true, isLive: true },
  { name: 'XÓC ĐĨA', id: 'nova-roulette', icon: '🥣', image: imgXocDia, artClass: 'gc-xocdia', category: 'live', jackpot: '₫ 73,022,646,500', defaultFavorite: true, isLive: true },
  { name: 'BẦU CUA', id: 'skyfall-slots', icon: '🎲', image: imgBauCua, artClass: 'gc-baucua', category: 'card', isNew: true },
  { name: 'NỔ HŨ', id: 'prism-plinko', icon: '🎰', image: imgNoHu, artClass: 'gc-baucua', category: 'slots', jackpot: '₫ 8,420,500,000' },
  { name: 'KENO', id: 'keno-pulse', icon: '▦', image: imgKeno, artClass: 'gc-xocdia', category: 'other' },
  { name: 'MINES', id: 'mines-orbit', icon: '💣', image: imgMines, artClass: 'gc-taixiu-md5', category: 'other' }
]

const cardGames: GameCard[] = [
  { name: 'TIẾN LÊN ĐẾM LÁ', id: 'velvet-blackjack', icon: '🃏', image: imgTienLenDemLa, artClass: 'gc-card-red', category: 'card' },
  { name: 'MẬU BINH', id: 'royal-baccarat', icon: '🂡', image: imgMauBinh, artClass: 'gc-card-gold', category: 'card' },
  { name: 'POKER', id: 'neon-poker', icon: '♠', image: imgPoker, artClass: 'gc-card-blue', category: 'card' },
  { name: 'SÂM', id: 'velvet-blackjack', icon: '🂮', image: imgSam, artClass: 'gc-card-green', category: 'card' },
  { name: 'CATTE', id: 'royal-baccarat', icon: '🃁', image: imgCatte, artClass: 'gc-card-purple', category: 'card' },
  { name: 'TIẾN LÊN MIỀN NAM', id: 'neon-poker', icon: '🂭', image: imgTienLenMienNam, artClass: 'gc-card-red', category: 'card' },
  { name: 'PHỎM', id: 'velvet-blackjack', icon: '🃎', image: imgPhom, artClass: 'gc-card-gold', category: 'card' },
  { name: 'LIÊNG', id: 'royal-baccarat', icon: '🂻', image: imgLieng, artClass: 'gc-card-blue', category: 'card' },
  { name: 'XÌ TỐ', id: 'neon-poker', icon: '🂾', image: imgXiTo, artClass: 'gc-card-green', category: 'card' },
  { name: 'XÌ DÁCH', id: 'velvet-blackjack', icon: '🂱', image: imgXiDach, artClass: 'gc-card-purple', category: 'card' }
]

const allHomeGames: GameCard[] = [
  ...lobbyGames,
  cardGames[5],
  cardGames[1],
  cardGames[2],
  cardGames[3],
  cardGames[4],
  cardGames[6],
  cardGames[7],
  cardGames[8],
  cardGames[9]
]

type TopHuItem = { id: string; name: string; value: number; minStep: number; maxStep: number }
const topHuItems = ref<TopHuItem[]>([
  { id: 'taixiu', name: 'TÀI XỈU', value: 2955733340, minStep: 600, maxStep: 2800 },
  { id: 'nohu', name: 'NỔ HŨ', value: 8420500000, minStep: 900, maxStep: 4200 },
  { id: 'xocdia', name: 'XÓC ĐĨA', value: 4721590079, minStep: 700, maxStep: 3100 },
  { id: 'baucua', name: 'BẦU CUA', value: 2312735058, minStep: 500, maxStep: 2400 },
  { id: 'mines', name: 'MINES', value: 1968250000, minStep: 400, maxStep: 2000 }
])
const heroJackpot = ref(2955733340)
const heroSlide = ref(0)
let jackpotHandle: ReturnType<typeof setInterval> | null = null

function tickJackpots() {
  topHuItems.value = topHuItems.value.map(item => ({
    ...item,
    value: item.value + item.minStep + Math.floor(Math.random() * (item.maxStep - item.minStep + 1))
  }))
  heroJackpot.value += 350 + Math.floor(Math.random() * 1100)
}

function formatJackpot(v: number) {
  return Math.floor(v).toLocaleString('vi-VN').replace(/,/g, '.')
}

function assetUrl(url: string) {
  if (!url) return ''
  if (url.startsWith('http')) return url
  return `${apiBase}${url.startsWith('/') ? '' : '/'}${url}`
}
function withQrCacheBust(url: string) {
  if (!url) return ''
  const base = assetUrl(url)
  if (base.includes('?v=')) return base
  const bust = qrCacheBust.value || Date.now()
  return `${base}${base.includes('?') ? '&' : '?'}v=${bust}`
}
const qrImageUrl = computed(() => withQrCacheBust(bankQrUrl.value))
const trc20QrImageUrl = computed(() => withQrCacheBust(trc20QrUrl.value))
const pendingRequestCount = computed(() => requests.value.filter(r => r.status === 'Chờ duyệt').length)
const depositRequests = computed(() => requests.value.filter(r => r.txType === 'Nạp tiền'))
const withdrawRequests = computed(() => requests.value.filter(r => r.txType === 'Rút tiền'))
const pendingDepositCount = computed(() => depositRequests.value.filter(r => r.status === 'Chờ duyệt').length)
const pendingWithdrawCount = computed(() => withdrawRequests.value.filter(r => r.status === 'Chờ duyệt').length)
const otherRequests = computed(() => requests.value.filter(r => r.txType !== 'Nạp tiền' && r.txType !== 'Rút tiền'))

function gameKey(game: GameCard, index: number) {
  return `${game.id}-${game.name}-${index}`
}

function isFavorite(game: GameCard) {
  return favoriteIds.value.includes(`${game.id}:${game.name}`)
}

function toggleFavorite(game: GameCard, event?: Event) {
  event?.stopPropagation()
  const key = `${game.id}:${game.name}`
  if (favoriteIds.value.includes(key)) {
    favoriteIds.value = favoriteIds.value.filter(id => id !== key)
  } else {
    favoriteIds.value = [...favoriteIds.value, key]
  }
  if (import.meta.client) localStorage.setItem('hitclub-favorites', JSON.stringify(favoriteIds.value))
}

const filteredGames = computed(() => {
  if (activeCategory.value === 'all') return allHomeGames
  if (activeCategory.value === 'card') return cardGames
  if (activeCategory.value === 'favorite') {
    const pool = [...lobbyGames, ...cardGames]
    const fav = pool.filter(g => isFavorite(g))
    return fav.length ? fav : lobbyGames.filter(g => g.defaultFavorite)
  }
  if (activeCategory.value === 'live') return lobbyGames.filter(g => g.category === 'live')
  if (activeCategory.value === 'slots') return lobbyGames.filter(g => g.category === 'slots')
  if (activeCategory.value === 'other') return lobbyGames.filter(g => g.category === 'other')
  return allHomeGames
})

const gridRowCount = computed(() => Math.max(1, Math.ceil(filteredGames.value.length / 6)))

const showLobbyHero = computed(() => activeCategory.value === 'all')

const activeCategoryLabel = computed(() => {
  const cat = categories.find(c => c.id === activeCategory.value)
  return (cat?.label || 'ALL GAMES').replace(/[★●]/g, '').trim()
})

const sidebarHotGames = computed(() => [lobbyGames[0], lobbyGames[1], lobbyGames[3]].filter(Boolean))

const sidebarWinners = computed(() =>
  tickerItems.map(item => {
    const match = item.match(/^(.+?)\s+(\S+)\s+thắng\s+([\d.]+)/i)
    if (!match) return { game: item, user: '', amount: '' }
    return { game: match[1], user: match[2], amount: match[3] }
  })
)

function generateCaptcha() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const otherColors = ['c-green', 'c-red', 'c-blue']
  const blackCount = 2 + Math.floor(Math.random() * 2)
  const blackPositions = new Set<number>()
  while (blackPositions.size < blackCount) blackPositions.add(Math.floor(Math.random() * 6))
  captchaAnswer.value = ''
  captchaChars.value = Array.from({ length: 6 }, (_, i) => {
    const char = chars[Math.floor(Math.random() * chars.length)]
    if (blackPositions.has(i)) {
      captchaAnswer.value += char
      return { char, cls: 'c-black' }
    }
    return { char, cls: otherColors[Math.floor(Math.random() * otherColors.length)] }
  })
  captchaInput.value = ''
}

function flash(message: string) {
  toast.value = message
  setTimeout(() => { toast.value = '' }, 2800)
}

function openAuth(mode: 'login' | 'register') {
  authMode.value = mode
  showAuth.value = true
  showMenu.value = false
  generateCaptcha()
}

async function api<T>(path: string, init: RequestInit = {}) {
  const response = await fetch(`${apiBase}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(apiToken.value ? { Authorization: `Bearer ${apiToken.value}` } : {}),
      ...init.headers
    }
  })
  const text = await response.text()
  let data = {} as T & { error?: string }
  try { data = JSON.parse(text) } catch { throw new Error(text.slice(0, 120) || 'Không thể kết nối API.') }
  if (!response.ok) throw new Error(data.error || 'Không thể kết nối API.')
  return data
}

function readableStatus(status: string): Request['status'] {
  if (status === 'approved' || status === 'completed') return 'Đã duyệt'
  if (status === 'rejected') return 'Từ chối'
  return 'Chờ duyệt'
}

function methodLabel(method: string) {
  if (method === 'admin_manual') return 'Admin thủ công'
  if (method === 'binance_trc20' || method === 'binance_demo') return 'Binance TRC20'
  return 'Chuyển khoản ngân hàng'
}

function fromTx(item: any): Request {
  let note = ''
  try { note = item.metadata ? JSON.parse(item.metadata)?.note || '' : '' } catch { /* ignore */ }
  const txType = item.type === 'DEMO_TOPUP'
    ? 'Nạp tiền'
    : item.type === 'DEMO_WITHDRAW'
      ? 'Rút tiền'
      : item.type === 'ADMIN_ADJUST'
        ? 'Điều chỉnh admin'
        : item.type
  return {
    id: item.id,
    user: item.username || fullName.value || 'Bạn',
    method: methodLabel(item.method),
    txType,
    amount: item.amount,
    status: readableStatus(item.status),
    created: new Date(item.created_at).toLocaleString('vi-VN'),
    note
  }
}

function applyPaymentConfigs(configs: Record<string, string>) {
  bankName.value = configs['payment.bank_name'] || bankName.value
  bankAccount.value = configs['payment.bank_account'] || bankAccount.value
  bankHolder.value = configs['payment.bank_holder'] || bankHolder.value
  bankQrUrl.value = configs['payment.bank_qr_url'] || ''
  trc20Address.value = configs['payment.binance_trc20'] || trc20Address.value
  trc20QrUrl.value = configs['payment.binance_qr_url'] || ''
  minDeposit.value = Number(configs['payment.min_deposit'] || minDeposit.value)
  minWithdraw.value = Number(configs['payment.min_withdraw'] || minWithdraw.value)
  if (configs['payment.bank_qr_url'] || configs['payment.binance_qr_url']) {
    qrCacheBust.value = Date.now()
  }
}

async function loadPublicConfigs() {
  const configs = await api<{ configs: Record<string, string> }>('/configs/public')
  applyPaymentConfigs(configs.configs)
}

function isMaintenanceGame(game: GameCard) {
  return activeCategory.value === 'live'
}

watch(activeCategory, (cat) => {
  if (cat === 'live') {
    maintenanceName.value = 'LIVE CASINO'
    showMaintenance.value = true
  }
})

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text)
    flash('Đã sao chép.')
  } catch {
    flash('Không sao chép được, hãy chọn và copy thủ công.')
  }
}

async function enterAdminDashboard() {
  tab.value = 'admin'
  adminSection.value = 'overview'
  showAuth.value = false
  showMenu.value = false
  showWalletModal.value = false
  try {
    const data = await api<{ configs: Array<{ key: string; value: string }> }>('/admin/configs')
    const map: Record<string, string> = {}
    for (const row of data.configs) map[row.key] = row.value
    applyPaymentConfigs(map)
  } catch { /* public configs already loaded */ }
  await refreshAdminSection()
}

function userEdit(user: AdminUser) {
  if (!userEdits.value[user.id]) {
    userEdits.value[user.id] = { role: user.role, status: user.status, balance: user.demoBalance }
  }
  return userEdits.value[user.id]
}

async function loadAdminStats() {
  const data = await api<{ stats: typeof adminStats.value }>('/admin/stats')
  adminStats.value = data.stats
}

async function loadAdminUsers() {
  const q = userSearch.value.trim()
  const path = q ? `/admin/users?q=${encodeURIComponent(q)}` : '/admin/users'
  const data = await api<{ users: AdminUser[] }>(path)
  adminUsers.value = data.users
  for (const user of data.users) userEdit(user)
}

async function loadAdminTransactions() {
  const data = await api<{ transactions: any[] }>('/admin/transactions')
  requests.value = data.transactions.map(fromTx)
}

async function loadAdmin() {
  await loadAdminTransactions()
}

async function refreshAdminSection() {
  if (adminSection.value === 'overview') {
    await Promise.all([loadAdminStats(), loadAdminTransactions()])
  } else if (adminSection.value === 'payments') {
    await loadAdminTransactions()
  } else if (adminSection.value === 'users') {
    await loadAdminUsers()
  } else {
    await loadAdminTransactions()
  }
}

async function switchAdminSection(section: AdminSection) {
  adminSection.value = section
  await refreshAdminSection()
}

async function saveAdminUser(user: AdminUser) {
  const edit = userEdit(user)
  try {
    await api(`/admin/users/${user.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ role: edit.role, status: edit.status, balanceSet: edit.balance })
    })
    await Promise.all([loadAdminUsers(), loadAdminStats()])
    flash(`Đã cập nhật user ${user.username}.`)
  } catch (error: any) {
    flash(error.message)
  }
}

async function uploadQrImage(event: Event) {
  await uploadPaymentQr(event, 'bank')
}

async function uploadTrc20QrImage(event: Event) {
  await uploadPaymentQr(event, 'trc20')
}

async function uploadPaymentQr(event: Event, kind: 'bank' | 'trc20') {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  const busy = kind === 'bank' ? qrUploadBusy : trc20QrUploadBusy
  busy.value = true
  try {
    const form = new FormData()
    form.append('file', file)
    const path = kind === 'bank' ? 'payment-qr' : 'payment-qr-trc20'
    const response = await fetch(`${apiBase}/admin/upload/${path}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiToken.value}` },
      body: form
    })
    const text = await response.text()
    let data: { url?: string; error?: string } = {}
    try { data = JSON.parse(text) } catch { throw new Error(text.slice(0, 120) || 'Upload thất bại.') }
    if (!response.ok) throw new Error(data.error || 'Upload thất bại.')
    if (kind === 'bank') bankQrUrl.value = data.url || ''
    else trc20QrUrl.value = data.url || ''
    qrCacheBust.value = Date.now()
    flash(kind === 'bank' ? 'Đã upload QR ngân hàng.' : 'Đã upload QR Binance TRC20.')
  } catch (error: any) {
    flash(error.message)
  } finally {
    busy.value = false
    input.value = ''
  }
}
async function refreshProfile() {
  const profile = await api<{ user: any }>('/auth/me')
  fullName.value = profile.user.username
  balance.value = profile.user.demoBalance
  isAdmin.value = profile.user.role === 'admin'
}

async function loadWallet() {
  const data = await api<{ transactions: any[] }>('/wallet/transactions')
  requests.value = data.transactions.map(fromTx)
}

async function submitAuth() {
  if (!email.value || !password.value) return flash('Hãy nhập tên đăng nhập và mật khẩu.')
  if (password.value.length < 8) return flash('Mật khẩu phải có ít nhất 8 ký tự.')
  if (authMode.value === 'register' && !/^[a-zA-Z0-9_]{3,30}$/.test(email.value)) {
    return flash('Tên đăng nhập chỉ gồm chữ, số và dấu gạch dưới (3–30 ký tự).')
  }
  if (authMode.value === 'login') {
    const entered = captchaInput.value.toUpperCase().replace(/\s/g, '')
    if (entered !== captchaAnswer.value) {
      generateCaptcha()
      return flash('Captcha sai. Hãy nhập các ký tự màu đen theo thứ tự.')
    }
  }
  const loginEmail = email.value.includes('@') ? email.value : `${email.value}@hitclub.local`
  try {
    const payload = authMode.value === 'register'
      ? { email: loginEmail, password: password.value, username: email.value.replace(/[^a-zA-Z0-9_]/g, '').slice(0, 30) || 'player' }
      : { email: loginEmail, password: password.value }
    const data = await api<{ token: string; user: any }>(`/auth/${authMode.value === 'register' ? 'register' : 'login'}`, {
      method: 'POST',
      body: JSON.stringify(payload)
    })
    apiToken.value = data.token
    if (import.meta.client) localStorage.setItem('lumen-token', data.token)
    loggedIn.value = true
    fullName.value = data.user.username
    balance.value = data.user.demoBalance
    isAdmin.value = data.user.role === 'admin'
    showAuth.value = false
    password.value = ''
    if (isAdmin.value) {
      await enterAdminDashboard()
      flash(authMode.value === 'register' ? 'Tài khoản admin đã được tạo.' : 'Đăng nhập admin thành công.')
    } else {
      await loadWallet()
      flash(authMode.value === 'register' ? 'Tài khoản đã được tạo. Vui lòng nạp tiền để chơi.' : 'Đăng nhập thành công.')
    }
  } catch (error: any) {
    if (authMode.value === 'login') generateCaptcha()
    flash(error.message === 'Invalid credentials' ? 'Sai tên đăng nhập hoặc mật khẩu.' : error.message)
  }
}

function logout() {
  apiToken.value = ''
  if (import.meta.client) localStorage.removeItem('lumen-token')
  loggedIn.value = false
  isAdmin.value = false
  fullName.value = ''
  balance.value = 0
  requests.value = []
  showMenu.value = false
  showWalletModal.value = false
  tab.value = 'home'
  closeGame()
  showAuth.value = true
  flash('Đã đăng xuất.')
}

async function openWallet(action: 'deposit' | 'withdraw') {
  if (!loggedIn.value) return openAuth('login')
  walletAction.value = action
  showMenu.value = false
  try {
    await loadPublicConfigs()
    await refreshProfile()
    await loadWallet()
    showWalletModal.value = true
  } catch (error: any) {
    flash(error.message)
  }
}

async function submitRequest() {
  if (!loggedIn.value) return openAuth('login')
  if (!amount.value || amount.value < minDeposit.value) return flash(`Số tiền tối thiểu là ${format(minDeposit.value)} đ.`)
  if (walletAction.value === 'withdraw') {
    if (amount.value < minWithdraw.value) return flash(`Rút tối thiểu ${format(minWithdraw.value)} đ.`)
    if (amount.value > balance.value) return flash('Số dư không đủ.')
  }
  walletBusy.value = true
  try {
    await api('/wallet/requests', {
      method: 'POST',
      body: JSON.stringify({
        type: walletAction.value === 'deposit' ? 'DEMO_TOPUP' : 'DEMO_WITHDRAW',
        method: method.value === 'bank' ? 'bank_transfer' : 'binance_trc20',
        amount: amount.value,
        withdrawInfo: walletAction.value === 'withdraw' ? {
          bankName: withdrawBankName.value,
          accountNumber: withdrawAccount.value,
          accountName: withdrawAccountName.value,
          walletAddress: withdrawWallet.value
        } : undefined
      })
    })
    await loadWallet()
    flash(walletAction.value === 'deposit' ? 'Đã gửi yêu cầu nạp · chờ admin xác nhận.' : 'Đã gửi yêu cầu rút · chờ admin xác nhận.')
  } catch (error: any) {
    flash(error.message)
  } finally {
    walletBusy.value = false
  }
}

async function savePaymentConfig() {
  try {
    await Promise.all([
      api('/admin/configs/payment.bank_name', { method: 'PUT', body: JSON.stringify({ value: bankName.value }) }),
      api('/admin/configs/payment.bank_account', { method: 'PUT', body: JSON.stringify({ value: bankAccount.value }) }),
      api('/admin/configs/payment.bank_holder', { method: 'PUT', body: JSON.stringify({ value: bankHolder.value }) }),
      api('/admin/configs/payment.binance_trc20', { method: 'PUT', body: JSON.stringify({ value: trc20Address.value }) }),
      api('/admin/configs/payment.min_deposit', { method: 'PUT', body: JSON.stringify({ value: String(minDeposit.value) }) }),
      api('/admin/configs/payment.min_withdraw', { method: 'PUT', body: JSON.stringify({ value: String(minWithdraw.value) }) })
    ])
    flash('Đã lưu cấu hình nạp/rút.')
  } catch (error: any) {
    flash(error.message)
  }
}

async function updateStatus(request: Request, status: Request['status']) {
  try {
    await api(`/admin/transactions/${request.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: status === 'Đã duyệt' ? 'approved' : 'rejected' })
    })
    await Promise.all([loadAdminTransactions(), loadAdminStats()])
    flash(`Yêu cầu #${request.id.slice(0, 8)} đã ${status.toLowerCase()}.`)
  } catch (error: any) {
    flash(error.message)
  }
}

async function openAdmin() {
  if (!isAdmin.value) return flash('Chỉ admin mới truy cập được.')
  await enterAdminDashboard()
}

function updateSicbo(round: any) {
  sicbo.value = round
  secondsLeft.value = Math.max(0, Math.ceil((round.closesAt - Date.now()) / 1000))
  if (!clockHandle) {
    clockHandle = setInterval(() => {
      if (sicbo.value) secondsLeft.value = Math.max(0, Math.ceil((sicbo.value.closesAt - Date.now()) / 1000))
    }, 250)
  }
}

function openGame(game: GameCard) {
  if (!loggedIn.value) return openAuth('login')
  if (isMaintenanceGame(game)) {
    maintenanceName.value = game.name
    showMaintenance.value = true
    return
  }
  gameSocket?.close()
  gameSocket = null
  activeGame.value = game.id
  activeGameName.value = game.name
  activeGameIcon.value = game.icon
  activeGameImage.value = game.image || ''
  gameResult.value = null
  gameChoice.value = 'Mặc định'
  roomOnline.value = 0
  sicbo.value = null
}

function closeGame() {
  gameSocket?.close()
  gameSocket = null
  activeGame.value = null
  activeGameImage.value = ''
  sicbo.value = null
  if (clockHandle) {
    clearInterval(clockHandle)
    clockHandle = null
  }
}

function placeSicbo(choice: 'TAI' | 'XIU') {
  if (!gameSocket || gameSocket.readyState !== WebSocket.OPEN) return flash('Đang kết nối room…')
  gameSocket.send(JSON.stringify({ type: 'sicbo_bet', choice, amount: gameBet.value }))
  setTimeout(() => refreshProfile().catch(() => {}), 400)
}

async function playGame() {
  if (!activeGame.value || gameBusy.value) return
  gameBusy.value = true
  gameResult.value = null
  gameSocket?.send(JSON.stringify({ type: 'round_action', action: gameChoice.value }))
  try {
    const result = await api<{ won: boolean; payout: number; multiplier: number; balance: number }>('/games/play', {
      method: 'POST',
      body: JSON.stringify({ gameId: activeGame.value, bet: gameBet.value, choice: gameChoice.value })
    })
    balance.value = result.balance
    gameResult.value = {
      ...result,
      message: result.won ? `Thắng ${format(result.payout)} đ · x${result.multiplier}` : `Chưa may mắn · mất ${format(gameBet.value)} đ`
    }
    await loadWallet()
  } catch (error: any) {
    flash(error.message)
  } finally {
    gameBusy.value = false
  }
}

onMounted(async () => {
  generateCaptcha()
  if (!import.meta.client) return
  jackpotHandle = setInterval(tickJackpots, 140)
  const savedFav = localStorage.getItem('hitclub-favorites')
  if (savedFav) {
    try { favoriteIds.value = JSON.parse(savedFav) } catch { /* ignore */ }
  }
  try {
    await loadPublicConfigs()
  } catch { /* ignore */ }
  apiToken.value = localStorage.getItem('lumen-token') || ''
  if (!apiToken.value) {
    showAuth.value = true
    return
  }
  try {
    const profile = await api<{ user: any }>('/auth/me')
    loggedIn.value = true
    fullName.value = profile.user.username
    balance.value = profile.user.demoBalance
    isAdmin.value = profile.user.role === 'admin'
    if (isAdmin.value) {
      await enterAdminDashboard()
    } else {
      await loadWallet()
    }
  } catch {
    apiToken.value = ''
    localStorage.removeItem('lumen-token')
    showAuth.value = true
  }
})

onBeforeUnmount(() => {
  closeGame()
  if (jackpotHandle) clearInterval(jackpotHandle)
})

function format(v: number) {
  return new Intl.NumberFormat('vi-VN').format(v)
}
</script>

<template>
  <main>
    <!-- Auth -->
    <div v-if="showAuth || (tab === 'home' && !loggedIn)" class="auth-screen">
      <div class="auth-screen-inner">
        <form class="auth-modal-hitclub" @submit.prevent="submitAuth">
          <button v-if="loggedIn" type="button" class="close" @click="showAuth = false">×</button>
          <div class="auth-logo-wrap">
            <img :src="logoUrl" alt="HIT CLUB" class="auth-logo">
          </div>
          <div class="auth-tabs-switch">
            <button type="button" :class="{ active: authMode === 'login' }" @click="authMode = 'login'; generateCaptcha()">ĐĂNG NHẬP</button>
            <button type="button" :class="{ active: authMode === 'register' }" @click="authMode = 'register'">ĐĂNG KÝ</button>
          </div>
          <label>Tên đăng nhập<input v-model="email" type="text" placeholder="hoangnam401" autocomplete="username"></label>
          <label>Mật khẩu<input v-model="password" type="password" placeholder="••••••••" autocomplete="current-password"></label>
          <div v-if="authMode === 'login'" class="auth-captcha">
            <p class="hint">Hãy nhập {{ captchaAnswer.length }} ký tự màu đen (theo thứ tự trái → phải)</p>
            <input
              v-model="captchaInput"
              type="text"
              maxlength="6"
              placeholder="Nhập captcha"
              autocomplete="off"
              class="auth-captcha-input"
              spellcheck="false"
            >
            <div class="auth-captcha-row">
              <div class="auth-captcha-img">
                <span v-for="(c, i) in captchaChars" :key="i" :class="c.cls">{{ c.char }}</span>
              </div>
              <button type="button" class="auth-captcha-reload" @click="generateCaptcha">↻</button>
            </div>
          </div>
          <div class="auth-submit-wrap">
            <button type="submit" class="auth-submit">{{ authMode === 'login' ? 'ĐĂNG NHẬP' : 'ĐĂNG KÝ' }}</button>
          </div>
          <p class="auth-switch">
            {{ authMode === 'login' ? 'Chưa có tài khoản?' : 'Đã có tài khoản?' }}
            <button type="button" @click="authMode = authMode === 'login' ? 'register' : 'login'; generateCaptcha()">{{ authMode === 'login' ? 'Đăng ký ngay' : 'Đăng nhập' }}</button>
          </p>
          <p class="auth-note">Nạp/rút thủ công · Admin xác nhận · Mật khẩu tối thiểu 8 ký tự</p>
          <p class="auth-api-hint">API: {{ apiBase }}</p>
        </form>
      </div>
      <div class="auth-sidebar">
        <button type="button" class="auth-side-btn"><span class="side-icon">⬇</span>TẢI APP</button>
        <button type="button" class="auth-side-btn"><span class="side-icon">🎧</span>HỖ TRỢ</button>
      </div>
      <span class="auth-version">3.18.0</span>
    </div>

    <!-- Lobby -->
    <section v-if="tab === 'home' && loggedIn && !isAdmin" class="hitclub-lobby vip-home">
      <div class="vip-ticker hitclub-ticker">
        <div class="ticker-track">
          <span v-for="(item, i) in [...tickerItems, ...tickerItems]" :key="i">{{ item }}</span>
        </div>
      </div>

      <header class="vip-brand-row">
        <button class="vip-brand-hit" @click="tab = 'home'; activeCategory = 'all'">
          <img :src="logoUrl" alt="HIT CLUB" class="vip-brand-logo">
        </button>
      </header>

      <div class="vip-nav-row">
        <nav class="hitclub-categories vip-categories">
          <button
            v-for="cat in categories"
            :key="cat.id"
            class="cat-btn"
            :class="{ active: activeCategory === cat.id }"
            @click="activeCategory = cat.id"
          >
            <template v-if="cat.id === 'live'">LIVE <span class="live-dot">●</span></template>
            <template v-else-if="cat.id === 'favorite'">YÊU THÍCH <span class="star">★</span></template>
            <template v-else>{{ cat.label }}</template>
          </button>
          <button type="button" class="cat-btn warning" @click="flash('Cảnh báo: Chỉ chơi có trách nhiệm · 18+')">
            <span class="warn-icon">⚠</span>
            <span>CẢNH BÁO</span>
          </button>
        </nav>
        <div class="vip-announce">
          <span class="speaker">🔊</span>
          <span><em>NẠP/RÚT</em> nhanh qua <em>NGÂN HÀNG</em> hoặc <em>BINANCE TRC20</em></span>
        </div>
      </div>

      <div class="vip-main">
        <aside class="vip-sidebar">
          <div class="top-hu-panel">
            <h3 class="top-hu-title">TOP HŨ</h3>
            <div class="top-hu-chest-scroll">
              <img :src="imgRuong" alt="Top Hũ" class="top-hu-chest-img">
            </div>
            <ul class="top-hu-list">
              <li v-for="item in topHuItems" :key="item.id">
                <span class="top-hu-name">{{ item.name }}</span>
                <span class="top-hu-value jackpot-tick">{{ formatJackpot(item.value) }}</span>
              </li>
            </ul>
          </div>

          <div v-if="showLobbyHero" class="vip-promo-panel">
            <button type="button" class="vip-promo-scroll" @click="flash('Khuyến mãi demo · chi tiết sẽ cập nhật sau')">
              <img :src="imgKhuyenMai" alt="Khuyến mãi thể thao" class="vip-promo-img">
            </button>
          </div>

          <div v-if="showLobbyHero" class="vip-sidebar-hot">
            <h4 class="vip-sidebar-title">HOT NHẤT</h4>
            <button
              v-for="(game, index) in sidebarHotGames"
              :key="gameKey(game, index)"
              type="button"
              class="vip-hot-item"
              @click="openGame(game)"
            >
              <span class="vip-hot-thumb">
                <img v-if="game.image" :src="game.image" :alt="game.name">
                <span v-else>{{ game.icon }}</span>
              </span>
              <span class="vip-hot-meta">
                <strong>{{ game.name }}</strong>
                <small>{{ game.isLive ? '● LIVE' : 'Chơi ngay' }}</small>
              </span>
            </button>
          </div>

          <div v-if="showLobbyHero" class="vip-sidebar-winners">
            <h4 class="vip-sidebar-title">THẮNG LỚN HÔM NAY</h4>
            <ul>
              <li v-for="(win, i) in sidebarWinners" :key="i">
                <span class="vip-win-user">{{ win.user }}</span>
                <span class="vip-win-game">{{ win.game }}</span>
                <strong class="vip-win-amount">{{ win.amount }}</strong>
              </li>
            </ul>
          </div>

          <div v-if="showLobbyHero" class="vip-sidebar-quick">
            <button type="button" class="vip-quick-btn deposit" @click="openWallet('deposit')">NẠP NHANH</button>
            <button type="button" class="vip-quick-btn withdraw" @click="openWallet('withdraw')">RÚT NHANH</button>
          </div>

          <div v-else class="vip-cat-info">
            <h3 class="vip-cat-info-title">{{ activeCategoryLabel }}</h3>
            <p class="vip-cat-info-count">{{ filteredGames.length }} trò chơi</p>
            <button type="button" class="vip-cat-back" @click="activeCategory = 'all'">← Về ALL GAMES</button>
          </div>
        </aside>

        <div class="vip-content">
          <div v-if="showLobbyHero" class="vip-hero-carousel">
            <button type="button" class="hero-arrow hero-arrow-left" aria-label="Banner trước" @click="heroSlide = heroSlide > 0 ? heroSlide - 1 : 6">‹</button>
            <div class="vip-hero-slide">
              <button type="button" class="vip-hero-banner-hit" @click="openGame(lobbyGames[0])">
                <img :src="imgBannerMini" alt="Tài Xỉu - Săn tài lộc thắng cực lớn" class="vip-hero-mini-banner">
                <div class="vip-hero-jackpot-overlay">
                  <span class="vip-hero-tag">JACKPOT</span>
                  <strong class="jackpot-tick vip-hero-jackpot-num">{{ formatJackpot(heroJackpot) }}</strong>
                </div>
              </button>
            </div>
            <button type="button" class="hero-arrow hero-arrow-right" aria-label="Banner sau" @click="heroSlide = heroSlide < 6 ? heroSlide + 1 : 0">›</button>
            <div class="vip-hero-dots">
              <button
                v-for="n in 7"
                :key="n"
                type="button"
                class="hero-dot"
                :class="{ active: heroSlide === n - 1 }"
                @click="heroSlide = n - 1"
              ></button>
            </div>
          </div>

          <div class="vip-game-grid" :style="{ '--vip-rows': gridRowCount }">
            <article
              v-for="(game, index) in filteredGames"
              :key="gameKey(game, index)"
              class="vip-game-tile"
              @click="openGame(game)"
            >
              <button class="vip-tile-fav" :class="{ active: isFavorite(game) }" @click="toggleFavorite(game, $event)">★</button>
              <span v-if="game.isLive" class="vip-tile-live">● LIVE</span>
              <span v-if="isMaintenanceGame(game)" class="vip-tile-maint">BẢO TRÌ</span>
              <div class="vip-game-thumb">
                <img v-if="game.image" :src="game.image" :alt="game.name" loading="lazy">
                <div v-else class="vip-img-placeholder"><span>{{ game.icon }}</span></div>
              </div>
            </article>
          </div>
        </div>
      </div>

      <footer class="vip-footer">
        <div class="vip-footer-user">
          <div class="vip-footer-avatar">{{ fullName.slice(0, 1).toUpperCase() }}</div>
          <div class="vip-footer-meta">
            <div class="vip-footer-name">{{ fullName }}</div>
            <div class="vip-footer-balance">
              <span class="coin">🪙</span>
              <span>SỐ DƯ</span>
              <strong>{{ format(balance) }}</strong>
            </div>
          </div>
        </div>
        <div class="footer-actions-dock">
          <button type="button" class="footer-action-btn footer-action-deposit" @click="openWallet('deposit')">
            <span class="footer-btn-icon footer-btn-icon-coin" aria-hidden="true">$</span>
            <span class="footer-btn-label">NẠP TIỀN</span>
          </button>
          <button type="button" class="footer-action-btn footer-action-withdraw" @click="openWallet('withdraw')">
            <span class="footer-btn-icon footer-btn-icon-bill" aria-hidden="true">$</span>
            <span class="footer-btn-label">RÚT TIỀN</span>
          </button>
        </div>
        <div class="vip-footer-menu">
          <button type="button" class="vip-menu-item"><span class="badge" data-count="1">📋</span> NHIỆM VỤ</button>
          <button type="button" class="vip-menu-item" @click="flash('Hộp thư trống')"><span>✉</span> HỘP THƯ</button>
          <button type="button" class="vip-menu-item" @click="flash('Sự kiện sắp ra mắt')"><span>🎉</span> SỰ KIỆN</button>
          <button type="button" class="vip-menu-item" @click="flash('Hỗ trợ 24/7')"><span>🎧</span> HỖ TRỢ</button>
          <button type="button" class="vip-menu-item" @click="showMenu = true"><span>☰</span> MENU</button>
        </div>
      </footer>
    </section>

    <!-- Menu drawer -->
    <div v-if="showMenu" class="menu-backdrop" @click.self="showMenu = false">
      <aside class="menu-drawer">
        <button class="close" @click="showMenu = false">×</button>
        <img :src="logoUrl" alt="HIT CLUB" class="menu-logo">
        <p class="menu-user">{{ fullName || 'Khách' }}</p>
        <p class="menu-balance">₫ {{ format(balance) }}</p>
        <button @click="openWallet('deposit')">↓ Nạp tiền</button>
        <button @click="openWallet('withdraw')">↑ Rút tiền</button>
        <button @click="tab = 'wallet'; showMenu = false; loadWallet()">Ví & lịch sử</button>
        <button v-if="isAdmin" @click="openAdmin()">Quản trị admin</button>
        <button class="danger" @click="logout()">Đăng xuất</button>
      </aside>
    </div>

    <!-- Wallet modal -->
    <div v-if="showWalletModal" class="modal-backdrop wallet-backdrop" @click.self="showWalletModal = false">
      <section class="wallet-modal wallet-modal-premium">
        <button class="close" @click="showWalletModal = false">×</button>
        <div class="wallet-modal-head">
          <p class="eyebrow">VÍ HIT CLUB</p>
          <h2>{{ walletAction === 'deposit' ? 'Nạp tiền' : 'Rút tiền' }}</h2>
          <p class="wallet-balance-pill">Số dư: <strong>₫ {{ format(balance) }}</strong></p>
        </div>

        <div class="wallet-tabs">
          <button :class="{ active: walletAction === 'deposit' }" @click="walletAction = 'deposit'">NẠP TIỀN</button>
          <button :class="{ active: walletAction === 'withdraw' }" @click="walletAction = 'withdraw'">RÚT TIỀN</button>
        </div>

        <div class="method-switch wallet-method-switch">
          <button :class="{ active: method === 'bank' }" @click="method = 'bank'"><b>🏦</b><span>Ngân hàng</span></button>
          <button :class="{ active: method === 'binance' }" @click="method = 'binance'"><b>◈</b><span>Binance TRC20</span></button>
        </div>

        <template v-if="walletAction === 'deposit' && method === 'bank'">
          <div class="bank-info-card">
            <div class="bank-info-row"><span>Ngân hàng</span><strong>{{ bankName || '—' }}</strong></div>
            <div class="bank-info-row"><span>Số TK</span><strong>{{ bankAccount || '—' }}</strong><button type="button" class="copy-chip" @click="copyText(bankAccount)">Copy</button></div>
            <div class="bank-info-row"><span>Chủ TK</span><strong>{{ bankHolder || '—' }}</strong></div>
          </div>
          <div class="qr-frame">
            <img v-if="qrImageUrl" :key="qrImageUrl" :src="qrImageUrl" alt="QR ngân hàng" class="qr-image">
            <div v-else class="qr-placeholder">Admin chưa cập nhật QR ngân hàng</div>
          </div>
        </template>

        <template v-else-if="walletAction === 'deposit' && method === 'binance'">
          <div class="crypto-card">
            <p class="eyebrow">Ví Binance · TRC20 (USDT)</p>
            <code class="crypto-address">{{ trc20Address || 'Admin chưa cập nhật ví' }}</code>
            <button type="button" class="copy-chip wide" @click="copyText(trc20Address)">Sao chép địa chỉ</button>
            <p class="muted">Chỉ chuyển USDT mạng TRC20. Sai mạng có thể mất tiền.</p>
          </div>
          <div class="qr-frame">
            <img v-if="trc20QrImageUrl" :key="trc20QrImageUrl" :src="trc20QrImageUrl" alt="QR Binance TRC20" class="qr-image">
            <div v-else class="qr-placeholder">Admin chưa cập nhật QR Binance TRC20</div>
          </div>
        </template>

        <template v-else-if="walletAction === 'withdraw' && method === 'bank'">
          <label class="input-label">Ngân hàng<input v-model="withdrawBankName" placeholder="Vietcombank"></label>
          <label class="input-label">Số tài khoản<input v-model="withdrawAccount" placeholder="1029384756"></label>
          <label class="input-label">Tên chủ TK<input v-model="withdrawAccountName" placeholder="NGUYEN VAN A"></label>
        </template>

        <template v-else>
          <label class="input-label">Địa chỉ ví TRC20<input v-model="withdrawWallet" placeholder="T..."></label>
        </template>

        <label class="input-label">Số tiền (VNĐ)<input v-model.number="amount" type="number" :min="walletAction === 'deposit' ? minDeposit : minWithdraw" step="10000"></label>
        <div class="quick wallet-quick">
          <button v-for="n in [100000, 200000, 500000, 1000000, 2000000]" :key="n" @click="amount = n">{{ format(n) }}</button>
        </div>

        <button v-if="walletAction === 'deposit'" class="primary wide wallet-confirm-btn pulse-gold" :disabled="walletBusy" @click="submitRequest">
          {{ walletBusy ? 'Đang gửi…' : '✓ ĐÃ NẠP TIỀN' }}
        </button>
        <button v-else class="primary wide wallet-confirm-btn" :disabled="walletBusy" @click="submitRequest">
          {{ walletBusy ? 'Đang gửi…' : 'Gửi yêu cầu rút tiền' }}
        </button>
        <p class="wallet-hint">Giao dịch chờ admin xác nhận thủ công trong vài phút.</p>

        <div v-if="requests.length" class="wallet-modal-history">
          <p class="eyebrow">Lịch sử gần đây</p>
          <div v-for="item in requests.slice(0, 5)" :key="item.id" class="history-row compact">
            <div><b>{{ item.txType }} · #{{ item.id.slice(0, 8) }}</b><p>{{ item.method }} · {{ item.created }}</p></div>
            <strong>₫ {{ format(item.amount) }}</strong>
            <span class="status" :class="item.status.replaceAll(' ', '-').toLowerCase()">{{ item.status }}</span>
          </div>
        </div>
      </section>
    </div>

    <!-- Internal nav for wallet (players only) -->
    <header v-if="tab !== 'home' && loggedIn && !isAdmin" class="nav shell">
      <button class="brand" @click="tab = 'home'"><img :src="logoUrl" alt="HIT CLUB" class="nav-logo"><span>HIT</span> <i>CLUB</i></button>
      <nav>
        <button :class="{ active: tab === 'home' }" @click="tab = 'home'">Sảnh game</button>
        <button :class="{ active: tab === 'wallet' }" @click="tab = 'wallet'; loadWallet()">Ví</button>
      </nav>
      <div class="nav-right">
        <button class="balance" @click="tab = 'wallet'">₫ {{ format(balance) }}</button>
        <button class="avatar" @click="showMenu = true" :title="fullName">{{ fullName.slice(0, 1).toUpperCase() }}</button>
      </div>
    </header>

    <section v-if="tab === 'wallet' && loggedIn" class="shell wallet-page">
      <div class="page-title">
        <div>
          <p class="eyebrow">VÍ LUMEN COIN</p>
          <h1>Quản lý coin demo</h1>
          <p class="muted">Nạp/rút chỉ mô phỏng. Admin duyệt thủ công trong bảng quản trị.</p>
        </div>
        <div class="coin-card"><span>Số dư khả dụng</span><b>{{ format(balance) }} <small>LC</small></b></div>
      </div>
      <div class="wallet-layout">
        <aside class="wallet-menu">
          <button :class="{ active: walletAction === 'deposit' }" @click="walletAction = 'deposit'">↓ Nạp coin demo</button>
          <button :class="{ active: walletAction === 'withdraw' }" @click="walletAction = 'withdraw'">↑ Rút coin demo</button>
          <hr>
          <p>Không hỗ trợ tiền thật, ngân hàng thật hoặc ví Binance thật.</p>
        </aside>
        <section class="wallet-panel">
          <div class="panel-head">
            <div>
              <h2>{{ walletAction === 'deposit' ? 'Nạp Lumen Coin' : 'Rút Lumen Coin' }}</h2>
              <p>Tạo yêu cầu mô phỏng để admin duyệt.</p>
            </div>
            <span class="demo-pill">DEMO ONLY</span>
          </div>
          <div class="method-switch">
            <button :class="{ active: method === 'bank' }" @click="method = 'bank'"><b>▦</b><span>QR tài khoản ngân hàng<br><small>Ảnh QR minh hoạ</small></span></button>
            <button :class="{ active: method === 'binance' }" @click="method = 'binance'"><b>◈</b><span>Ví BNB Chain<br><small>Địa chỉ giả lập</small></span></button>
          </div>
          <div class="payment-demo">
            <div class="qr"><div class="qr-code">{{ method === 'bank' ? bankQr : 'LUMEN • BNB' }}</div></div>
            <div>
              <p class="eyebrow">{{ method === 'bank' ? 'QR DEMO LOCAL' : 'VÍ DEMO LOCAL' }}</p>
              <h3>{{ method === 'bank' ? 'Lumen Play Bank' : 'BNB Chain (test address)' }}</h3>
              <code>{{ method === 'bank' ? 'LP-DEMO-QR-2026' : binanceAddress }}</code>
              <p class="muted">Không gửi tiền hay tài sản thật tới thông tin này.</p>
            </div>
          </div>
          <label class="input-label">Số lượng Lumen Coin <input v-model.number="amount" type="number" min="10000" step="10000"></label>
          <div class="quick">
            <button v-for="n in [50000, 100000, 250000, 500000]" :key="n" @click="amount = n">{{ format(n) }}</button>
          </div>
          <button class="primary wide" @click="submitRequest">Gửi yêu cầu {{ walletAction === 'deposit' ? 'nạp' : 'rút' }} demo</button>
        </section>
      </div>
      <section class="history">
        <h2>Lịch sử yêu cầu</h2>
        <p v-if="!requests.length" class="muted">Chưa có yêu cầu nào.</p>
        <div v-for="item in requests" :key="item.id" class="history-row">
          <span class="round-icon">{{ item.method.includes('BNB') ? '◈' : '▦' }}</span>
          <div><b>#{{ item.id.slice(0, 8) }} · {{ item.method }}</b><p>{{ item.created }}</p></div>
          <strong>{{ format(item.amount) }} LC</strong>
          <span class="status" :class="item.status.replaceAll(' ', '-').toLowerCase()">{{ item.status }}</span>
        </div>
      </section>
    </section>

    <header v-if="isAdmin && loggedIn" class="nav shell admin-topbar">
      <button class="brand" type="button"><img :src="logoUrl" alt="HIT CLUB" class="nav-logo"><span>ADMIN</span> <i>PANEL</i></button>
      <div class="nav-right">
        <span class="admin-user-pill">{{ fullName }}</span>
        <button class="primary compact" @click="refreshAdminSection()">Làm mới</button>
        <button class="danger compact" @click="logout()">Đăng xuất</button>
      </div>
    </header>

    <section v-if="tab === 'admin' && isAdmin" class="shell admin-page">
      <div class="admin-layout">
        <aside class="admin-sidebar">
          <p class="admin-sidebar-title">Quản trị</p>
          <button
            v-for="item in adminMenu"
            :key="item.id"
            type="button"
            class="admin-menu-btn"
            :class="{ active: adminSection === item.id }"
            @click="switchAdminSection(item.id)"
          >
            <span class="admin-menu-icon">{{ item.icon }}</span>
            <span>{{ item.label }}</span>
            <span v-if="item.id === 'payments' && pendingRequestCount" class="admin-menu-badge">{{ pendingRequestCount }}</span>
          </button>
        </aside>

        <div class="admin-content">
          <!-- Tổng quan -->
          <template v-if="adminSection === 'overview'">
            <div class="page-title">
              <div>
                <p class="eyebrow">ADMIN · HIT CLUB</p>
                <h1>Tổng quan hệ thống</h1>
                <p class="muted">Thống kê nhanh user, số dư và giao dịch.</p>
              </div>
            </div>
            <div class="admin-stats-grid">
              <article class="admin-stat-card"><span>Tổng user</span><strong>{{ adminStats.totalUsers }}</strong></article>
              <article class="admin-stat-card"><span>Player hoạt động</span><strong>{{ adminStats.activePlayers }}</strong></article>
              <article class="admin-stat-card highlight"><span>Chờ duyệt nạp/rút</span><strong>{{ adminStats.pendingRequests }}</strong></article>
              <article class="admin-stat-card"><span>Tổng số dư</span><strong>₫ {{ format(adminStats.totalBalance) }}</strong></article>
              <article class="admin-stat-card"><span>GD hôm nay</span><strong>{{ adminStats.todayTransactions }}</strong></article>
            </div>
            <section class="admin-card requests">
              <div class="panel-head">
                <div>
                  <h2>Giao dịch chờ xử lý gần đây</h2>
                  <p>Các yêu cầu nạp/rút đang chờ admin xác nhận.</p>
                </div>
                <button class="primary compact" @click="switchAdminSection('payments')">Xem tất cả</button>
              </div>
              <p v-if="!pendingRequestCount" class="muted">Không có giao dịch chờ duyệt.</p>
              <div v-for="item in requests.filter(r => r.status === 'Chờ duyệt').slice(0, 5)" :key="item.id" class="request-row">
                <div>
                  <b>{{ item.txType }} · #{{ item.id.slice(0, 8) }} · {{ item.user }}</b>
                  <p>{{ item.method }} · ₫ {{ format(item.amount) }} · {{ item.created }}</p>
                </div>
                <div class="request-actions">
                  <button @click="updateStatus(item, 'Đã duyệt')">Xác nhận</button>
                  <button class="danger" @click="updateStatus(item, 'Từ chối')">Từ chối</button>
                </div>
              </div>
            </section>
          </template>

          <!-- Nạp / Rút -->
          <template v-else-if="adminSection === 'payments'">
            <div class="page-title">
              <div>
                <p class="eyebrow">ADMIN · HIT CLUB</p>
                <h1>Quản lý nạp/rút</h1>
                <p class="muted">Cấu hình tài khoản nhận tiền, upload QR và duyệt giao dịch.</p>
              </div>
            </div>
            <div class="admin-grid">
              <section class="admin-card">
                <h2>Cấu hình ngân hàng</h2>
                <label>Tên ngân hàng<input v-model="bankName"></label>
                <label>Số tài khoản<input v-model="bankAccount"></label>
                <label>Chủ tài khoản<input v-model="bankHolder"></label>
                <label class="upload-label">
                  Ảnh QR ngân hàng
                  <input type="file" accept="image/jpeg,image/png,image/webp" @change="uploadQrImage">
                </label>
                <p v-if="qrUploadBusy" class="muted">Đang upload lên R2…</p>
                <div v-if="qrImageUrl" class="admin-qr-preview"><img :key="qrImageUrl" :src="qrImageUrl" alt="QR preview"></div>
              </section>
              <section class="admin-card">
                <h2>Binance TRC20 & hạn mức</h2>
                <label>Địa chỉ ví TRC20<input v-model="trc20Address"></label>
                <label class="upload-label">
                  Ảnh QR Binance TRC20
                  <input type="file" accept="image/jpeg,image/png,image/webp" @change="uploadTrc20QrImage">
                </label>
                <p v-if="trc20QrUploadBusy" class="muted">Đang upload lên R2…</p>
                <div v-if="trc20QrImageUrl" class="admin-qr-preview"><img :key="trc20QrImageUrl" :src="trc20QrImageUrl" alt="QR TRC20 preview"></div>
                <label>Nạp tối thiểu<input v-model.number="minDeposit" type="number"></label>
                <label>Rút tối thiểu<input v-model.number="minWithdraw" type="number"></label>
                <button class="primary" @click="savePaymentConfig()">Lưu cấu hình</button>
              </section>
            </div>
            <section class="admin-card requests">
              <div class="panel-head">
                <div>
                  <h2>Giao dịch chờ xác nhận</h2>
                  <p>User bấm "Đã nạp tiền" hoặc gửi yêu cầu rút sẽ hiện ở đây.</p>
                </div>
                <span class="pending-badge">{{ pendingRequestCount }} chờ duyệt</span>
              </div>
              <div class="admin-tx-split">
                <div class="admin-tx-column deposit">
                  <div class="admin-tx-column-head">
                    <h3>Nạp tiền</h3>
                    <span v-if="pendingDepositCount" class="pending-badge small">{{ pendingDepositCount }} chờ</span>
                  </div>
                  <p v-if="!depositRequests.length" class="admin-tx-empty muted">Chưa có giao dịch nạp.</p>
                  <div v-for="item in depositRequests" :key="item.id" class="request-row">
                    <div>
                      <b>#{{ item.id.slice(0, 8) }} · {{ item.user }}</b>
                      <p>{{ item.method }} · ₫ {{ format(item.amount) }} · {{ item.created }}</p>
                    </div>
                    <div class="request-actions">
                      <span class="status" :class="item.status.replaceAll(' ', '-').toLowerCase()">{{ item.status }}</span>
                      <template v-if="item.status === 'Chờ duyệt'">
                        <button @click="updateStatus(item, 'Đã duyệt')">Xác nhận</button>
                        <button class="danger" @click="updateStatus(item, 'Từ chối')">Từ chối</button>
                      </template>
                    </div>
                  </div>
                </div>
                <div class="admin-tx-column withdraw">
                  <div class="admin-tx-column-head">
                    <h3>Rút tiền</h3>
                    <span v-if="pendingWithdrawCount" class="pending-badge small">{{ pendingWithdrawCount }} chờ</span>
                  </div>
                  <p v-if="!withdrawRequests.length" class="admin-tx-empty muted">Chưa có giao dịch rút.</p>
                  <div v-for="item in withdrawRequests" :key="item.id" class="request-row">
                    <div>
                      <b>#{{ item.id.slice(0, 8) }} · {{ item.user }}</b>
                      <p>{{ item.method }} · ₫ {{ format(item.amount) }} · {{ item.created }}</p>
                    </div>
                    <div class="request-actions">
                      <span class="status" :class="item.status.replaceAll(' ', '-').toLowerCase()">{{ item.status }}</span>
                      <template v-if="item.status === 'Chờ duyệt'">
                        <button @click="updateStatus(item, 'Đã duyệt')">Xác nhận</button>
                        <button class="danger" @click="updateStatus(item, 'Từ chối')">Từ chối</button>
                      </template>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          </template>

          <!-- Quản lý user -->
          <template v-else-if="adminSection === 'users'">
            <div class="page-title">
              <div>
                <p class="eyebrow">ADMIN · HIT CLUB</p>
                <h1>Quản lý user</h1>
                <p class="muted">Tìm kiếm, chỉnh quyền, khóa/mở tài khoản và điều chỉnh số dư.</p>
              </div>
            </div>
            <section class="admin-card">
              <div class="admin-user-toolbar">
                <input v-model="userSearch" type="search" placeholder="Tìm username hoặc email…" @keyup.enter="loadAdminUsers()">
                <button class="primary compact" @click="loadAdminUsers()">Tìm</button>
              </div>
              <p v-if="!adminUsers.length" class="muted">Không tìm thấy user.</p>
              <div class="admin-user-table-wrap">
                <table v-if="adminUsers.length" class="admin-user-table">
                  <thead>
                    <tr>
                      <th>User</th>
                      <th>Email</th>
                      <th>Quyền</th>
                      <th>Trạng thái</th>
                      <th>Số dư</th>
                      <th>Ngày tạo</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="user in adminUsers" :key="user.id">
                      <td><b>{{ user.username }}</b></td>
                      <td>{{ user.email }}</td>
                      <td>
                        <select v-model="userEdit(user).role" :disabled="user.username === fullName">
                          <option value="player">Player</option>
                          <option value="admin">Admin</option>
                        </select>
                      </td>
                      <td>
                        <select v-model="userEdit(user).status" :disabled="user.username === fullName">
                          <option value="active">Hoạt động</option>
                          <option value="suspended">Khóa</option>
                        </select>
                      </td>
                      <td><input v-model.number="userEdit(user).balance" type="number" min="0" step="10000" class="balance-input"></td>
                      <td>{{ new Date(user.createdAt).toLocaleDateString('vi-VN') }}</td>
                      <td><button class="primary compact" @click="saveAdminUser(user)">Lưu</button></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>
          </template>

          <!-- Lịch sử giao dịch -->
          <template v-else>
            <div class="page-title">
              <div>
                <p class="eyebrow">ADMIN · HIT CLUB</p>
                <h1>Lịch sử giao dịch</h1>
                <p class="muted">Toàn bộ lịch sử nạp, rút và điều chỉnh số dư.</p>
              </div>
            </div>
            <section class="admin-card requests">
              <div class="admin-tx-split">
                <div class="admin-tx-column deposit">
                  <div class="admin-tx-column-head">
                    <h3>Lịch sử nạp tiền</h3>
                    <span class="admin-tx-count">{{ depositRequests.length }} giao dịch</span>
                  </div>
                  <p v-if="!depositRequests.length" class="admin-tx-empty muted">Chưa có giao dịch nạp.</p>
                  <div v-for="item in depositRequests" :key="item.id" class="request-row">
                    <div>
                      <b>#{{ item.id.slice(0, 8) }} · {{ item.user }}</b>
                      <p>{{ item.method }} · ₫ {{ format(item.amount) }} · {{ item.created }}</p>
                    </div>
                    <div class="request-actions">
                      <span class="status" :class="item.status.replaceAll(' ', '-').toLowerCase()">{{ item.status }}</span>
                    </div>
                  </div>
                </div>
                <div class="admin-tx-column withdraw">
                  <div class="admin-tx-column-head">
                    <h3>Lịch sử rút tiền</h3>
                    <span class="admin-tx-count">{{ withdrawRequests.length }} giao dịch</span>
                  </div>
                  <p v-if="!withdrawRequests.length" class="admin-tx-empty muted">Chưa có giao dịch rút.</p>
                  <div v-for="item in withdrawRequests" :key="item.id" class="request-row">
                    <div>
                      <b>#{{ item.id.slice(0, 8) }} · {{ item.user }}</b>
                      <p>{{ item.method }} · ₫ {{ format(item.amount) }} · {{ item.created }}</p>
                    </div>
                    <div class="request-actions">
                      <span class="status" :class="item.status.replaceAll(' ', '-').toLowerCase()">{{ item.status }}</span>
                    </div>
                  </div>
                </div>
              </div>
              <div v-if="otherRequests.length" class="admin-tx-other">
                <h3>Giao dịch khác</h3>
                <div v-for="item in otherRequests" :key="item.id" class="request-row">
                  <div>
                    <b>{{ item.txType }} · #{{ item.id.slice(0, 8) }} · {{ item.user }}</b>
                    <p>{{ item.method }} · ₫ {{ format(item.amount) }} · {{ item.created }}</p>
                  </div>
                  <div class="request-actions">
                    <span class="status" :class="item.status.replaceAll(' ', '-').toLowerCase()">{{ item.status }}</span>
                  </div>
                </div>
              </div>
            </section>
          </template>
        </div>
      </div>
    </section>

    <footer v-if="tab !== 'home' && loggedIn && !isAdmin" class="shell"><span>© 2026 HIT CLUB</span><span>Chơi có trách nhiệm · 18+</span></footer>
    <div v-if="toast" class="toast">{{ toast }}</div>

    <!-- Maintenance modal -->
    <div v-if="showMaintenance" class="modal-backdrop" @click.self="showMaintenance = false">
      <section class="maintenance-modal">
        <button class="close" @click="showMaintenance = false">×</button>
        <div class="maint-icon">🔧</div>
        <h2>{{ maintenanceName }}</h2>
        <p>Game đang bảo trì hệ thống.</p>
        <p class="muted">Vui lòng chọn game khác hoặc quay lại sau.</p>
        <button class="primary wide" @click="showMaintenance = false">Đã hiểu</button>
      </section>
    </div>

    <!-- Game modal -->
    <div v-if="activeGame" class="modal-backdrop" @click.self="closeGame">
      <section class="game-modal">
        <button class="close" @click="closeGame">×</button>
        <div class="game-stage">
          <div v-if="activeGameImage" class="game-stage-art">
            <img :src="activeGameImage" :alt="activeGameName">
          </div>
          <span v-else>{{ activeGameIcon }}</span>
          <p>{{ activeGameName }}</p>
        </div>
        <p class="eyebrow">ARCADE · HIT CLUB</p>
        <h2>{{ activeGameName }}</h2>
        <p class="muted">Chọn mức cược và bắt đầu chơi.</p>
        <div class="choice-row">
          <button v-for="option in ['Đỏ', 'Xanh', 'Cao', 'Thấp', 'May mắn']" :key="option" :class="{ active: gameChoice === option }" @click="gameChoice = option">{{ option }}</button>
        </div>
        <label class="input-label">Mức chơi (VNĐ)<input v-model.number="gameBet" type="number" min="1000" max="500000" step="1000"></label>
        <div class="quick"><button v-for="n in [1000, 5000, 10000, 50000]" :key="n" @click="gameBet = n">{{ format(n) }}</button></div>
        <div v-if="gameResult" class="game-result" :class="{ won: gameResult.won }">{{ gameResult.message }}</div>
        <button class="primary wide pulse-gold" :disabled="gameBusy" @click="playGame">{{ gameBusy ? 'Đang kết quả…' : `Chơi ₫ ${format(gameBet)}` }}</button>
      </section>
    </div>
  </main>
</template>

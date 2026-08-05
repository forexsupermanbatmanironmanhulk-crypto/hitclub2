<script setup lang="ts">
type Tab = 'home' | 'wallet' | 'admin'
type Request = { id: string; user: string; method: string; amount: number; status: 'Chờ duyệt' | 'Đã duyệt' | 'Từ chối'; created: string }

const tab = ref<Tab>('home')
const showAuth = ref(false)
const authMode = ref<'login' | 'register'>('login')
// TODO: bật lại auth — đặt loggedIn = false khi uncomment màn hình đăng nhập
const loggedIn = ref(true)
const isAdmin = ref(false)
const fullName = ref('Cadofull')
const email = ref('')
const password = ref('')
const balance = ref(0)
const toast = ref('')
const walletAction = ref<'deposit' | 'withdraw'>('deposit')
const method = ref<'bank' | 'binance'>('bank')
const amount = ref<number | null>(50000)
const bankQr = ref('LP • BANK QR')
const binanceAddress = ref('0x84aB...dE20')
const activeGame = ref<string | null>(null)
const activeGameName = ref('')
const activeGameIcon = ref('✦')
const gameBet = ref(10000)
const gameChoice = ref('Mặc định')
const gameBusy = ref(false)
const gameResult = ref<{ won:boolean; payout:number; multiplier:number; message:string } | null>(null)
const roomOnline = ref(0)
const sicbo = ref<{ phase:string; closesAt:number; tai:number; xiu:number; dice?:number[]; result?:string } | null>(null)
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
  artClass: string
  category: string
  jackpot?: string
  bonus?: string
  isNew?: boolean
  isLive?: boolean
  stats?: { black: number; white: number }
  showDots?: boolean
  showPlay?: boolean
}

const games: GameCard[] = [
  { name: 'BẦU CUA', id: 'skyfall-slots', icon: '🎲', artClass: 'gc-baucua', category: 'card', bonus: 'x50 BONUS', isNew: true, showPlay: true },
  { name: 'TÀI XỈU', id: 'sic-bo-aurora', icon: '⚅⚅', artClass: 'gc-taixiu', category: 'live', jackpot: '$ 21,133,761,604', showDots: true },
  { name: 'TÀI XỈU MD5', id: 'meteor-crash', icon: '🎲', artClass: 'gc-taixiu-md5', category: 'live', stats: { black: 0, white: 13000 }, showDots: true },
  { name: 'XÓC ĐĨA', id: 'nova-roulette', icon: '🥣', artClass: 'gc-xocdia', category: 'live', jackpot: '$ 50,347,764,250', showDots: true },
  { name: 'TÀI XỈU LIVE', id: 'sic-bo-aurora', icon: '👩', artClass: 'gc-taixiu-live', category: 'live', jackpot: '$ 18,920,155,657', isLive: true, showDots: true },
  { name: 'NỔ HŨ', id: 'prism-plinko', icon: '🎰', artClass: 'gc-baucua', category: 'slots', jackpot: '$ 8,420,500,000', showDots: true },
  { name: 'GAME BÀI', id: 'velvet-blackjack', icon: '♠', artClass: 'gc-taixiu', category: 'card', showPlay: true },
  { name: 'KENO', id: 'keno-pulse', icon: '▦', artClass: 'gc-xocdia', category: 'other', showDots: true }
]

const filteredGames = computed(() => {
  if (activeCategory.value === 'all') return games
  if (activeCategory.value === 'favorite') return games.filter((_, i) => i < 3)
  if (activeCategory.value === 'live') return games.filter(g => g.category === 'live')
  if (activeCategory.value === 'slots') return games.filter(g => g.category === 'slots')
  if (activeCategory.value === 'card') return games.filter(g => g.category === 'card')
  return games.filter(g => g.category === 'other')
})

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

function flash(message: string) { toast.value = message; setTimeout(() => toast.value = '', 2800) }
function openAuth(mode: 'login' | 'register') { authMode.value = mode; showAuth.value = true; generateCaptcha() }
async function api<T>(path: string, init: RequestInit = {}) {
  const response = await fetch(`${apiBase}${path}`, { ...init, headers: { 'Content-Type':'application/json', ...(apiToken.value ? { Authorization:`Bearer ${apiToken.value}` } : {}), ...init.headers } })
  const data = await response.json() as T & { error?: string }
  if (!response.ok) throw new Error(data.error || 'Không thể kết nối API.')
  return data
}
function readableStatus(status: string): Request['status'] { return status === 'approved' ? 'Đã duyệt' : status === 'rejected' ? 'Từ chối' : 'Chờ duyệt' }
function fromTx(item: any): Request { return { id:item.id, user:item.username || fullName.value || 'Bạn', method:item.method === 'binance_demo' ? 'Ví BNB Chain demo' : 'QR ngân hàng demo', amount:item.amount, status:readableStatus(item.status), created:new Date(item.created_at).toLocaleString('vi-VN') } }
async function loadWallet() { const data = await api<{transactions:any[]}>('/wallet/transactions'); requests.value = data.transactions.map(fromTx) }
async function loadAdmin() { const data = await api<{transactions:any[]}>('/admin/transactions'); requests.value = data.transactions.map(fromTx) }
async function submitAuth() {
  if (!email.value || !password.value) return flash('Hãy nhập tên đăng nhập và mật khẩu.')
  if (password.value.length < 8) return flash('Mật khẩu phải có ít nhất 8 ký tự.')
  if (authMode.value === 'login') {
    const entered = captchaInput.value.toUpperCase().replace(/\s/g, '')
    if (entered !== captchaAnswer.value) {
      generateCaptcha()
      return flash(`Captcha sai. Hãy nhập các ký tự màu đen theo thứ tự (đáp án: ${captchaAnswer.value.length} ký tự).`)
    }
  }
  const loginEmail = email.value.includes('@') ? email.value : `${email.value}@hitclub.local`
  try {
    const payload = authMode.value === 'register' ? { email:loginEmail, password:password.value, username:email.value.replace(/[^a-z0-9_]/gi,'_').slice(0,30) || 'player' } : { email:loginEmail, password:password.value }
    const data = await api<{token:string;user:any}>(`/auth/${authMode.value === 'register' ? 'register' : 'login'}`, { method:'POST', body:JSON.stringify(payload) })
    apiToken.value=data.token; if (import.meta.client) localStorage.setItem('lumen-token',data.token)
    loggedIn.value=true; fullName.value=data.user.username; balance.value=data.user.demoBalance; isAdmin.value=data.user.role === 'admin'; showAuth.value=false; await loadWallet()
    flash(authMode.value === 'register' ? 'Tài khoản demo đã được tạo.' : 'Đăng nhập thành công.')
  } catch (error:any) {
    if (authMode.value === 'login') generateCaptcha()
    flash(error.message === 'Invalid credentials' ? 'Sai tên đăng nhập hoặc mật khẩu. Chưa có tài khoản? Bấm Đăng ký.' : error.message)
  }
}
async function submitRequest() {
  if (!loggedIn.value) return openAuth('login')
  if (!amount.value || amount.value < 10000) return flash('Số coin tối thiểu là 10.000.')
  if (walletAction.value === 'withdraw' && amount.value > balance.value) return flash('Số dư demo không đủ.')
  try { await api('/wallet/requests', { method:'POST', body:JSON.stringify({ type:walletAction.value === 'deposit' ? 'DEMO_TOPUP':'DEMO_WITHDRAW', method:method.value === 'bank' ? 'bank_qr_demo':'binance_demo', amount:amount.value }) }); await loadWallet(); flash('Đã gửi yêu cầu demo. Admin sẽ duyệt trong bảng quản trị.') } catch(error:any) { flash(error.message) }
}
async function updateStatus(request: Request, status: Request['status']) { try { await api(`/admin/transactions/${request.id}`, { method:'PATCH', body:JSON.stringify({ status:status === 'Đã duyệt' ? 'approved':'rejected' }) }); await loadAdmin(); flash(`Yêu cầu #${request.id.slice(0,8)} đã ${status.toLowerCase()}.`) } catch(error:any) { flash(error.message) } }
async function openAdmin() { tab.value='admin'; await loadAdmin() }
function updateSicbo(round:any) { sicbo.value=round; secondsLeft.value=Math.max(0,Math.ceil((round.closesAt-Date.now())/1000)); if(!clockHandle) clockHandle=setInterval(()=>{ if(sicbo.value) secondsLeft.value=Math.max(0,Math.ceil((sicbo.value.closesAt-Date.now())/1000)) },250) }
function openGame(game: GameCard) { if (!loggedIn.value) return openAuth('login'); gameSocket?.close(); activeGame.value=game.id; activeGameName.value=game.name; activeGameIcon.value=game.icon; gameResult.value=null; gameChoice.value='Mặc định'; roomOnline.value=0; sicbo.value=null; if(import.meta.client) { const url=`${apiBase.replace(/^http/,'ws')}/realtime/${game.id}?token=${encodeURIComponent(apiToken.value)}`; gameSocket=new WebSocket(url); gameSocket.onopen=()=>gameSocket?.send(JSON.stringify({type:'ready'})); gameSocket.onmessage=(event)=>{ const data=JSON.parse(event.data); if(typeof data.online==='number') roomOnline.value=data.online; if(data.type==='sicbo_state') updateSicbo(data.round); if(data.type==='error') flash(data.message) } } }
function closeGame() { gameSocket?.close(); gameSocket=null; activeGame.value=null; sicbo.value=null; if(clockHandle) { clearInterval(clockHandle); clockHandle=null } }
function placeSicbo(choice:'TAI'|'XIU') { if(!gameSocket || gameSocket.readyState!==WebSocket.OPEN) return flash('Đang kết nối room…'); gameSocket.send(JSON.stringify({type:'sicbo_bet',choice,amount:gameBet.value})) }
async function playGame() { if (!activeGame.value || gameBusy.value) return; gameBusy.value=true; gameResult.value=null; gameSocket?.send(JSON.stringify({type:'round_action',action:gameChoice.value})); try { const result = await api<{won:boolean;payout:number;multiplier:number;balance:number}>('/games/play',{method:'POST',body:JSON.stringify({gameId:activeGame.value,bet:gameBet.value,choice:gameChoice.value})}); balance.value=result.balance; gameResult.value={...result,message:result.won ? `Thắng ${format(result.payout)} LC · x${result.multiplier}` : `Chưa may mắn · mất ${format(gameBet.value)} LC`}; await loadWallet() } catch(error:any) { flash(error.message) } finally { gameBusy.value=false } }
onMounted(async () => { generateCaptcha(); if (!import.meta.client) return; apiToken.value=localStorage.getItem('lumen-token') || ''; try { const [profile,configs] = await Promise.all([api<{user:any}>('/auth/me'),api<{configs:Record<string,string>}>('/configs/public')]); loggedIn.value=true; fullName.value=profile.user.username; balance.value=profile.user.demoBalance; isAdmin.value=profile.user.role==='admin'; bankQr.value=configs.configs['demo_payment.bank_qr_label'] || bankQr.value; binanceAddress.value=configs.configs['demo_payment.binance_address'] || binanceAddress.value; await loadWallet() } catch { apiToken.value='' /* showAuth.value=true — tắt tạm, vào thẳng lobby */ } })
onBeforeUnmount(() => closeGame())
function format(v: number) { return new Intl.NumberFormat('vi-VN').format(v) }
</script>

<template>
  <main>
    <!-- Auth screen (login / register) — TẠM TẮT, bỏ comment để bật lại
    <div v-if="showAuth || (tab === 'home' && !loggedIn)" class="auth-screen">
      <div class="auth-screen-inner">
        <form class="auth-modal-hitclub" @submit.prevent="submitAuth">
          <button v-if="loggedIn" type="button" class="close" @click="showAuth = false">×</button>
          <div class="auth-tabs-switch">
            <button type="button" :class="{ active: authMode === 'login' }" @click="authMode = 'login'; generateCaptcha()">ĐĂNG NHẬP</button>
            <button type="button" :class="{ active: authMode === 'register' }" @click="authMode = 'register'">ĐĂNG KÝ</button>
          </div>
          <label>Tên đăng nhập<input v-model="email" type="text" placeholder="hoangnam401" autocomplete="username"></label>
          <label>Mật khẩu<input v-model="password" type="password" placeholder="••••••••" autocomplete="current-password"></label>
          <div v-if="authMode === 'login'" class="auth-captcha">
            <p class="hint">Hãy nhập các ký tự màu đen</p>
            <div class="auth-captcha-row">
              <input v-model="captchaInput" type="text" maxlength="6" placeholder="" autocomplete="off">
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
        </form>
      </div>
      <div class="auth-sidebar">
        <button type="button" class="auth-side-btn"><span class="side-icon">⬇</span>TẢI APP</button>
        <button type="button" class="auth-side-btn"><span class="side-icon">🎧</span>HỖ TRỢ</button>
      </div>
      <span class="auth-version">3.18.0</span>
    </div>
    -->

    <!-- HIT CLUB Lobby -->
    <section v-if="tab === 'home'" class="hitclub-lobby">
      <header class="hitclub-header">
        <div class="hitclub-header-left">Tài Xỉu</div>
        <button class="hitclub-logo" @click="tab = 'home'">
          <span class="hitclub-logo-text"><span>HIT</span> <i>CLUB</i></span>
        </button>
        <div class="hitclub-header-right">
          <span class="speaker">🔊</span>
          <span><em>NẠP/RÚT</em> bằng <em>TIỀN ẢO</em> để được xử lý nhanh hơn</span>
        </div>
      </header>

      <nav class="hitclub-categories">
        <button
          v-for="cat in categories"
          :key="cat.id"
          class="cat-btn"
          :class="{ active: activeCategory === cat.id, warning: cat.id === 'other' && activeCategory === 'other' }"
          @click="activeCategory = cat.id"
        >
          <template v-if="cat.id === 'live'">LIVE <span class="live-dot">●</span></template>
          <template v-else-if="cat.id === 'other' && activeCategory !== 'other'">KHÁC</template>
          <template v-else>{{ cat.label }}</template>
        </button>
        <button class="cat-btn warning" @click="flash('Cảnh báo: Chỉ chơi có trách nhiệm · 18+')">CẢNH BÁO</button>
      </nav>

      <div class="hitclub-games-wrap">
        <div class="hitclub-games-scroll">
          <article
            v-for="(game, index) in filteredGames"
            :key="game.name + index"
            class="game-card"
            @click="openGame(game)"
          >
            <span v-if="game.isNew" class="game-card-ribbon">MỚI</span>
            <span v-if="game.isLive" class="game-card-live">● LIVE</span>
            <div class="game-card-art" :class="game.artClass">
              <span class="icon">{{ game.icon }}</span>
              <span v-if="game.bonus" class="bonus">{{ game.bonus }}</span>
            </div>
            <div class="game-card-info">
              <h3>{{ game.name }}</h3>
              <p v-if="game.jackpot" class="jackpot">{{ game.jackpot }}</p>
              <div v-if="game.stats" class="stats">
                <span><i class="dot-black"></i> {{ game.stats.black }}</span>
                <span><i class="dot-white"></i> {{ format(game.stats.white) }}</span>
              </div>
              <button v-if="game.showPlay" class="play-btn" @click.stop="openGame(game)">THỬ NGAY</button>
              <div v-if="game.showDots" class="game-card-dots">
                <span v-for="d in 5" :key="d" :class="{ active: d === 1 }"></span>
              </div>
            </div>
          </article>
        </div>
      </div>

      <footer class="hitclub-footer">
        <div class="footer-user">
          <div class="footer-avatar">{{ fullName.slice(0, 1).toUpperCase() }}</div>
          <div class="footer-user-info">
            <span class="footer-phone-btn">Hãy kích hoạt SĐT</span>
            <div class="footer-username">{{ fullName }}</div>
            <span class="footer-balance">$ {{ format(balance) }}</span>
          </div>
        </div>
        <div class="footer-actions">
          <button class="footer-action-btn" @click="tab = 'wallet'; walletAction = 'deposit'">NẠP</button>
          <button class="footer-action-btn" @click="tab = 'wallet'; walletAction = 'withdraw'">RÚT</button>
        </div>
        <div class="footer-nav">
          <div class="footer-nav-item" @click="openGame(games[5])"><span class="icon">🎰</span><span>Nổ Hũ</span></div>
          <div class="footer-nav-item"><span class="icon badge" data-count="1">🎁</span><span>Nhiệm Vụ</span></div>
          <div class="footer-nav-item" @click="flash('Hộp thư trống')"><span class="icon">✉</span><span>Hộp Thư</span></div>
          <div class="footer-minigame">xiu<br>MINI<br>GAME</div>
          <div class="footer-nav-item" @click="isAdmin ? openAdmin() : flash('Menu')"><span class="icon">☰</span><span>Menu</span></div>
        </div>
      </footer>
    </section>

    <!-- Internal nav for wallet/admin -->
    <header v-if="tab !== 'home' && loggedIn" class="nav shell">
      <button class="brand" @click="tab = 'home'"><span>HIT</span> <i>CLUB</i></button>
      <nav><button :class="{ active: tab === 'home' }" @click="tab = 'home'">Sảnh game</button><button :class="{ active: tab === 'wallet' }" @click="tab = 'wallet'">Ví</button><button v-if="isAdmin" :class="{ active: tab === 'admin' }" @click="openAdmin">Quản trị</button></nav>
      <div class="nav-right">
        <button v-if="loggedIn" class="balance" @click="tab = 'wallet'">$ {{ format(balance) }}</button>
        <template v-if="!loggedIn"><button class="text-btn" @click="openAuth('login')">Đăng nhập</button><button class="primary compact" @click="openAuth('register')">Đăng ký</button></template>
        <button v-else class="avatar" @click="tab = 'wallet'" title="Tài khoản">{{ fullName.slice(0,1).toUpperCase() }}</button>
      </div>
    </header>

    <section v-else-if="tab === 'wallet'" class="shell wallet-page">
      <div class="page-title"><div><p class="eyebrow">VÍ LUMEN COIN</p><h1>Quản lý coin demo</h1><p class="muted">Các yêu cầu dưới đây chỉ mô phỏng cho môi trường local.</p></div><div class="coin-card"><span>Số dư khả dụng</span><b>{{ format(balance) }} <small>LC</small></b></div></div>
      <div class="wallet-layout"><aside class="wallet-menu"><button :class="{ active: walletAction === 'deposit' }" @click="walletAction='deposit'">↓ Nạp coin demo</button><button :class="{ active: walletAction === 'withdraw' }" @click="walletAction='withdraw'">↑ Rút coin demo</button><hr><p>Không hỗ trợ tiền thật, ngân hàng thật hoặc ví Binance thật.</p></aside>
      <section class="wallet-panel"><div class="panel-head"><div><h2>{{ walletAction === 'deposit' ? 'Nạp Lumen Coin' : 'Rút Lumen Coin' }}</h2><p>Tạo yêu cầu mô phỏng để admin duyệt.</p></div><span class="demo-pill">DEMO ONLY</span></div>
        <div class="method-switch"><button :class="{ active: method === 'bank' }" @click="method='bank'"><b>▦</b><span>QR tài khoản ngân hàng<br><small>Ảnh QR minh hoạ</small></span></button><button :class="{ active: method === 'binance' }" @click="method='binance'"><b>◈</b><span>Ví BNB Chain<br><small>Địa chỉ giả lập</small></span></button></div>
        <div class="payment-demo"><div class="qr"><div class="qr-code">{{ method === 'bank' ? bankQr : 'LUMEN • BNB' }}</div></div><div><p class="eyebrow">{{ method === 'bank' ? 'QR DEMO LOCAL' : 'VÍ DEMO LOCAL' }}</p><h3>{{ method === 'bank' ? 'Lumen Play Bank' : 'BNB Chain (test address)' }}</h3><code>{{ method === 'bank' ? 'LP-DEMO-QR-2026' : binanceAddress }}</code><p class="muted">Không gửi tiền hay tài sản thật tới thông tin này.</p></div></div>
        <label class="input-label">Số lượng Lumen Coin <input v-model.number="amount" type="number" min="10000" step="10000"></label>
        <div class="quick"><button v-for="n in [50000,100000,250000,500000]" :key="n" @click="amount=n">{{ format(n) }}</button></div><button class="primary wide" @click="submitRequest">Gửi yêu cầu {{ walletAction === 'deposit' ? 'nạp' : 'rút' }} demo</button>
      </section></div>
      <section class="history"><h2>Lịch sử yêu cầu</h2><p v-if="!requests.length" class="muted">Chưa có yêu cầu nào.</p><div v-for="item in requests" :key="item.id" class="history-row"><span class="round-icon">{{ item.method.includes('BNB') ? '◈' : '▦' }}</span><div><b>#{{ item.id.slice(0,8) }} · {{ item.method }}</b><p>{{ item.created }}</p></div><strong>{{ format(item.amount) }} LC</strong><span class="status" :class="item.status.replaceAll(' ', '-').toLowerCase()">{{ item.status }}</span></div></section>
    </section>

    <section v-else class="shell admin-page"><div class="page-title"><div><p class="eyebrow">ADMIN · LOCAL DEMO</p><h1>Quản lý ví & nội dung</h1><p class="muted">Dữ liệu được lưu trong D1; chỉ dành cho demo coin.</p></div></div><div class="admin-grid"><section class="admin-card"><h2>Thiết lập QR demo</h2><label>Nhận diện QR ngân hàng<input v-model="bankQr"></label><label>Địa chỉ BNB Chain demo<input v-model="binanceAddress"></label><button class="primary" @click="Promise.all([api('/admin/configs/demo_payment.bank_qr_label',{method:'PUT',body:JSON.stringify({value:bankQr})}),api('/admin/configs/demo_payment.binance_address',{method:'PUT',body:JSON.stringify({value:binanceAddress})})]).then(()=>flash('Đã lưu cấu hình QR demo.')).catch((e)=>flash(e.message))">Lưu thay đổi</button></section><section class="admin-card"><h2>Tổng quan hôm nay</h2><div class="metrics"><div><span>Yêu cầu chờ</span><b>{{ requests.filter(r => r.status === 'Chờ duyệt').length }}</b></div><div><span>Giao dịch</span><b>{{ requests.length }}</b></div><div><span>Game đang mở</span><b>10</b></div></div></section></div><section class="admin-card requests"><div class="panel-head"><div><h2>Yêu cầu nạp/rút demo</h2><p>Duyệt thủ công, cập nhật số dư atomically trong D1.</p></div></div><div v-for="item in requests" :key="item.id" class="request-row"><div><b>#{{ item.id.slice(0,8) }} · {{ item.user }}</b><p>{{ item.method }} · {{ format(item.amount) }} LC · {{ item.created }}</p></div><div class="request-actions"><span class="status" :class="item.status.replaceAll(' ', '-').toLowerCase()">{{ item.status }}</span><template v-if="item.status === 'Chờ duyệt'"><button @click="updateStatus(item, 'Đã duyệt')">Duyệt</button><button class="danger" @click="updateStatus(item, 'Từ chối')">Từ chối</button></template></div></div></section></section>

    <footer v-if="tab !== 'home'" class="shell"><span>© 2026 HIT CLUB</span><span>Chơi có trách nhiệm · 18+</span></footer>
    <div v-if="toast" class="toast">{{ toast }}</div>
    <div v-if="activeGame" class="modal-backdrop" @click.self="closeGame"><section class="game-modal"><button class="close" @click="closeGame">×</button><template v-if="activeGame === 'sic-bo-aurora'"><div class="sicbo-board"><p class="eyebrow">SIC BO LIVE · {{ roomOnline }}/100 ONLINE</p><h2>Tài Xỉu Aurora</h2><div class="countdown" :class="{revealed:sicbo?.phase==='REVEALED'}">{{ sicbo?.phase === 'REVEALED' ? 'KẾT QUẢ' : `${secondsLeft}s` }}</div><div class="dice"><b v-for="(die,index) in (sicbo?.dice || [1,1,1])" :key="index">{{ die }}</b></div><p v-if="sicbo?.result" class="result-name">{{ sicbo.result === 'TAI' ? 'TÀI' : sicbo.result === 'XIU' ? 'XỈU' : 'BỘ BA — HOÀN TIỀN' }}</p><p v-else class="muted">Ván đang mở · Đặt cược trước khi đồng hồ về 0.</p><label class="input-label">Mức cược (LC)<input v-model.number="gameBet" type="number" min="1000" max="500000" step="1000"></label><div class="quick"><button v-for="n in [1000,5000,10000,50000]" :key="n" @click="gameBet=n">{{ format(n) }}</button></div><div class="sicbo-bets"><button :disabled="sicbo?.phase !== 'OPEN'" @click="placeSicbo('TAI')"><span>TÀI</span><b>{{ format(sicbo?.tai || 0) }} LC</b><small>11–17 · x2</small></button><button :disabled="sicbo?.phase !== 'OPEN'" @click="placeSicbo('XIU')"><span>XỈU</span><b>{{ format(sicbo?.xiu || 0) }} LC</b><small>4–10 · x2</small></button></div></div></template><template v-else><div class="game-stage"><span>{{ activeGameIcon }}</span><p>{{ activeGameName }}</p></div><p class="eyebrow">ROOM REALTIME · {{ roomOnline }} ONLINE</p><h2>{{ activeGameName }}</h2><p class="muted">Chọn mức Lumen Coin và mục tiêu chơi. Mỗi lượt được ghi vào lịch sử demo của bạn.</p><div class="choice-row"><button v-for="option in ['Đỏ','Xanh','Cao','Thấp','May mắn']" :key="option" :class="{active:gameChoice===option}" @click="gameChoice=option">{{ option }}</button></div><label class="input-label">Mức chơi (LC)<input v-model.number="gameBet" type="number" min="1000" max="500000" step="1000"></label><div class="quick"><button v-for="n in [1000,5000,10000,50000]" :key="n" @click="gameBet=n">{{ format(n) }}</button></div><div v-if="gameResult" class="game-result" :class="{won:gameResult.won}">{{ gameResult.message }}</div><button class="primary wide" :disabled="gameBusy" @click="playGame">{{ gameBusy ? 'Đang kết quả…' : `Chơi ${format(gameBet)} LC` }}</button></template></section></div>
  </main>
</template>

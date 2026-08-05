<script setup lang="ts">
type Tab = 'home' | 'wallet' | 'admin'
type Request = { id: string; user: string; method: string; amount: number; status: 'Chờ duyệt' | 'Đã duyệt' | 'Từ chối'; created: string }

const tab = ref<Tab>('home')
const showAuth = ref(false)
const authMode = ref<'login' | 'register'>('login')
const loggedIn = ref(false)
const isAdmin = ref(false)
const fullName = ref('')
const email = ref('')
const password = ref('')
const balance = ref(250000)
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

const games = [
  ['Skyfall Slots', 'SLOTS', '✦', 'Tia chớp & jackpot', 'skyfall-slots'], ['Meteor Crash', 'CRASH', '◒', 'Rút coin trước khi thiên thạch rơi', 'meteor-crash'],
  ['Velvet Blackjack', 'TABLE', '♠', 'Bàn 21 cổ điển', 'velvet-blackjack'], ['Nova Roulette', 'TABLE', '◉', 'Vòng quay châu Âu', 'nova-roulette'],
  ['Royal Baccarat', 'TABLE', '♦', 'Player · Banker · Tie', 'royal-baccarat'], ['Neon Poker', 'CARD', '♣', 'Texas Hold’em demo', 'neon-poker'],
  ['Keno Pulse', 'NUMBER', '▦', 'Chọn số, chờ kết quả', 'keno-pulse'], ['Prism Plinko', 'ARCADE', '◇', 'Thả bóng qua các chốt sáng', 'prism-plinko'],
  ['Mines Orbit', 'ARCADE', '✹', 'Mở ô, tránh hố đen', 'mines-orbit'], ['Sic Bo Aurora', 'DICE', '⚄', 'Ba xúc xắc, nhiều cửa cược', 'sic-bo-aurora']
]

function flash(message: string) { toast.value = message; setTimeout(() => toast.value = '', 2800) }
function openAuth(mode: 'login' | 'register') { authMode.value = mode; showAuth.value = true }
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
  if (!email.value || !password.value) return flash('Hãy nhập email và mật khẩu.')
  try {
    const payload = authMode.value === 'register' ? { email:email.value, password:password.value, username:email.value.split('@')[0].replace(/[^a-z0-9_]/gi,'_').slice(0,30) || 'player' } : { email:email.value, password:password.value }
    const data = await api<{token:string;user:any}>(`/auth/${authMode.value === 'register' ? 'register' : 'login'}`, { method:'POST', body:JSON.stringify(payload) })
    apiToken.value=data.token; if (import.meta.client) localStorage.setItem('lumen-token',data.token)
    loggedIn.value=true; fullName.value=data.user.username; balance.value=data.user.demoBalance; isAdmin.value=data.user.role === 'admin'; showAuth.value=false; await loadWallet()
    flash(authMode.value === 'register' ? 'Tài khoản demo đã được tạo.' : 'Đăng nhập thành công.')
  } catch (error:any) { flash(error.message) }
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
function openGame(game: string[]) { if (!loggedIn.value) return openAuth('login'); gameSocket?.close(); activeGame.value=game[4]; activeGameName.value=game[0]; activeGameIcon.value=game[2]; gameResult.value=null; gameChoice.value='Mặc định'; roomOnline.value=0; sicbo.value=null; if(import.meta.client) { const url=`${apiBase.replace(/^http/,'ws')}/realtime/${game[4]}?token=${encodeURIComponent(apiToken.value)}`; gameSocket=new WebSocket(url); gameSocket.onopen=()=>gameSocket?.send(JSON.stringify({type:'ready'})); gameSocket.onmessage=(event)=>{ const data=JSON.parse(event.data); if(typeof data.online==='number') roomOnline.value=data.online; if(data.type==='sicbo_state') updateSicbo(data.round); if(data.type==='error') flash(data.message) } } }
function closeGame() { gameSocket?.close(); gameSocket=null; activeGame.value=null; sicbo.value=null; if(clockHandle) { clearInterval(clockHandle); clockHandle=null } }
function placeSicbo(choice:'TAI'|'XIU') { if(!gameSocket || gameSocket.readyState!==WebSocket.OPEN) return flash('Đang kết nối room…'); gameSocket.send(JSON.stringify({type:'sicbo_bet',choice,amount:gameBet.value})) }
async function playGame() { if (!activeGame.value || gameBusy.value) return; gameBusy.value=true; gameResult.value=null; gameSocket?.send(JSON.stringify({type:'round_action',action:gameChoice.value})); try { const result = await api<{won:boolean;payout:number;multiplier:number;balance:number}>('/games/play',{method:'POST',body:JSON.stringify({gameId:activeGame.value,bet:gameBet.value,choice:gameChoice.value})}); balance.value=result.balance; gameResult.value={...result,message:result.won ? `Thắng ${format(result.payout)} LC · x${result.multiplier}` : `Chưa may mắn · mất ${format(gameBet.value)} LC`}; await loadWallet() } catch(error:any) { flash(error.message) } finally { gameBusy.value=false } }
onMounted(async () => { if (!import.meta.client) return; apiToken.value=localStorage.getItem('lumen-token') || ''; try { const [profile,configs] = await Promise.all([api<{user:any}>('/auth/me'),api<{configs:Record<string,string>}>('/configs/public')]); loggedIn.value=true; fullName.value=profile.user.username; balance.value=profile.user.demoBalance; isAdmin.value=profile.user.role==='admin'; bankQr.value=configs.configs['demo_payment.bank_qr_label'] || bankQr.value; binanceAddress.value=configs.configs['demo_payment.binance_address'] || binanceAddress.value; await loadWallet() } catch { apiToken.value='' } })
onBeforeUnmount(() => closeGame())
function format(v: number) { return new Intl.NumberFormat('vi-VN').format(v) }
</script>

<template>
  <main>
    <header class="nav shell">
      <button class="brand" @click="tab = 'home'"><span>✦</span> LUMEN <i>PLAY</i></button>
      <nav><button :class="{ active: tab === 'home' }" @click="tab = 'home'">Sảnh game</button><button :class="{ active: tab === 'wallet' }" @click="tab = 'wallet'">Ví demo</button><button v-if="isAdmin" :class="{ active: tab === 'admin' }" @click="openAdmin">Quản trị</button></nav>
      <div class="nav-right">
        <button v-if="loggedIn" class="balance" @click="tab = 'wallet'">◈ {{ format(balance) }} <small>LC</small></button>
        <template v-if="!loggedIn"><button class="text-btn" @click="openAuth('login')">Đăng nhập</button><button class="primary compact" @click="openAuth('register')">Đăng ký</button></template>
        <button v-else class="avatar" @click="tab = 'wallet'" title="Tài khoản">{{ fullName.slice(0,1).toUpperCase() }}</button>
      </div>
    </header>

    <section v-if="tab === 'home'" class="shell home">
      <div class="notice">✦ Chỉ dùng <b>demo coin</b> · Không nạp/rút tiền thật · 18+</div>
      <section class="hero">
        <div class="hero-copy"><p class="eyebrow">DEMO ARCADE · SEASON 01</p><h1>Chơi vui.<br><em>Không tiền thật.</em></h1><p class="muted">Khám phá các game bàn, arcade và slots với Lumen Coin — chỉ dùng cho trải nghiệm local.</p><div class="hero-actions"><button class="primary" @click="loggedIn ? tab = 'wallet' : openAuth('register')">Nhận 250.000 LC</button><button class="ghost" @click="tab = 'wallet'">Xem ví demo →</button></div></div>
        <div class="hero-art"><div class="orb one"></div><div class="orb two"></div><div class="card-float">♠<br><span>LUCK<br>IS A<br>MOOD</span></div><div class="coin">✦</div></div>
      </section>
      <div class="section-head"><div><p class="eyebrow">CHỌN PHÒNG</p><h2>Game nổi bật</h2></div><span>10 game demo</span></div>
      <section class="game-grid"><article v-for="(game, index) in games" :key="game[0]" class="game" :style="{ '--delay': `${index * 0.05}s` }"><div class="game-art" :class="`art-${index % 5}`"><span>{{ game[2] }}</span><label>{{ game[1] }}</label></div><div class="game-info"><div><h3>{{ game[0] }}</h3><p>{{ game[3] }}</p></div><button @click="openGame(game)">Chơi</button></div></article></section>
    </section>

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

    <footer class="shell"><span>© 2026 Lumen Play</span><span>Demo coin · Không có giá trị tiền tệ</span></footer>
    <div v-if="toast" class="toast">{{ toast }}</div>
    <div v-if="activeGame" class="modal-backdrop" @click.self="closeGame"><section class="game-modal"><button class="close" @click="closeGame">×</button><template v-if="activeGame === 'sic-bo-aurora'"><div class="sicbo-board"><p class="eyebrow">SIC BO LIVE · {{ roomOnline }}/100 ONLINE</p><h2>Tài Xỉu Aurora</h2><div class="countdown" :class="{revealed:sicbo?.phase==='REVEALED'}">{{ sicbo?.phase === 'REVEALED' ? 'KẾT QUẢ' : `${secondsLeft}s` }}</div><div class="dice"><b v-for="(die,index) in (sicbo?.dice || [1,1,1])" :key="index">{{ die }}</b></div><p v-if="sicbo?.result" class="result-name">{{ sicbo.result === 'TAI' ? 'TÀI' : sicbo.result === 'XIU' ? 'XỈU' : 'BỘ BA — HOÀN TIỀN' }}</p><p v-else class="muted">Ván đang mở · Đặt cược trước khi đồng hồ về 0.</p><label class="input-label">Mức cược (LC)<input v-model.number="gameBet" type="number" min="1000" max="500000" step="1000"></label><div class="quick"><button v-for="n in [1000,5000,10000,50000]" :key="n" @click="gameBet=n">{{ format(n) }}</button></div><div class="sicbo-bets"><button :disabled="sicbo?.phase !== 'OPEN'" @click="placeSicbo('TAI')"><span>TÀI</span><b>{{ format(sicbo?.tai || 0) }} LC</b><small>11–17 · x2</small></button><button :disabled="sicbo?.phase !== 'OPEN'" @click="placeSicbo('XIU')"><span>XỈU</span><b>{{ format(sicbo?.xiu || 0) }} LC</b><small>4–10 · x2</small></button></div></div></template><template v-else><div class="game-stage"><span>{{ activeGameIcon }}</span><p>{{ activeGameName }}</p></div><p class="eyebrow">ROOM REALTIME · {{ roomOnline }} ONLINE</p><h2>{{ activeGameName }}</h2><p class="muted">Chọn mức Lumen Coin và mục tiêu chơi. Mỗi lượt được ghi vào lịch sử demo của bạn.</p><div class="choice-row"><button v-for="option in ['Đỏ','Xanh','Cao','Thấp','May mắn']" :key="option" :class="{active:gameChoice===option}" @click="gameChoice=option">{{ option }}</button></div><label class="input-label">Mức chơi (LC)<input v-model.number="gameBet" type="number" min="1000" max="500000" step="1000"></label><div class="quick"><button v-for="n in [1000,5000,10000,50000]" :key="n" @click="gameBet=n">{{ format(n) }}</button></div><div v-if="gameResult" class="game-result" :class="{won:gameResult.won}">{{ gameResult.message }}</div><button class="primary wide" :disabled="gameBusy" @click="playGame">{{ gameBusy ? 'Đang kết quả…' : `Chơi ${format(gameBet)} LC` }}</button></template></section></div>
    <div v-if="showAuth" class="modal-backdrop" @click.self="showAuth=false"><form class="auth-modal" @submit.prevent="submitAuth"><button type="button" class="close" @click="showAuth=false">×</button><p class="eyebrow">LUMEN PLAY</p><h2>{{ authMode === 'login' ? 'Chào mừng trở lại' : 'Tạo tài khoản demo' }}</h2><p class="muted">Không sử dụng dữ liệu thanh toán thật.</p><label>Email<input v-model="email" type="email" placeholder="ban@example.com"></label><label>Mật khẩu<input v-model="password" type="password" placeholder="Tối thiểu 6 ký tự"></label><button class="primary wide">{{ authMode === 'login' ? 'Đăng nhập' : 'Đăng ký & nhận 250.000 LC' }}</button><p class="switch">{{ authMode === 'login' ? 'Chưa có tài khoản?' : 'Đã có tài khoản?' }} <button type="button" @click="authMode = authMode === 'login' ? 'register' : 'login'">{{ authMode === 'login' ? 'Đăng ký' : 'Đăng nhập' }}</button></p></form></div>
  </main>
</template>

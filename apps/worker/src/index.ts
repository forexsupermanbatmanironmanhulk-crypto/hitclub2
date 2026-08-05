import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { z } from 'zod'
import { DurableObject } from 'cloudflare:workers'

type Bindings = { DB: D1Database; JWT_SECRET: string; APP_ORIGIN: string; DEMO_PAYMENTS_ENABLED: string; GAME_ROOM: DurableObjectNamespace<GameRoom> }
type Variables = { user: { id: string; role: 'player' | 'admin'; email: string; username: string } }
const app = new Hono<{ Bindings: Bindings; Variables: Variables }>()
app.use('*', cors({ origin: (origin, c) => origin === c.env.APP_ORIGIN ? origin : c.env.APP_ORIGIN, allowHeaders: ['Authorization','Content-Type'], allowMethods: ['GET','POST','PATCH','PUT','OPTIONS'] }))

const authSchema = z.object({ email: z.string().email(), password: z.string().min(8).max(128), username: z.string().min(3).max(30).regex(/^[a-zA-Z0-9_]+$/).optional() })
const uuid = () => crypto.randomUUID()
const json = (data: unknown, status = 200) => Response.json(data, { status })
const enc = new TextEncoder()
const b64 = (value: Uint8Array | string) => btoa(typeof value === 'string' ? value : String.fromCharCode(...value)).replaceAll('+','-').replaceAll('/','_').replaceAll('=','')
const unb64 = (value: string) => Uint8Array.from(atob(value.replaceAll('-','+').replaceAll('_','/')), c => c.charCodeAt(0))
async function hmac(value: string, secret: string) { const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name:'HMAC', hash:'SHA-256' }, false, ['sign']); return b64(new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(value)))) }
async function token(payload: Record<string, unknown>, secret: string) { const head = b64(JSON.stringify({ alg:'HS256', typ:'JWT' })); const body = b64(JSON.stringify(payload)); return `${head}.${body}.${await hmac(`${head}.${body}`, secret)}` }
async function parseToken(value: string, secret: string) { const [head, body, sig] = value.split('.'); if (!head || !body || !sig || sig !== await hmac(`${head}.${body}`, secret)) return null; const data = JSON.parse(new TextDecoder().decode(unb64(body))); return data.exp > Math.floor(Date.now()/1000) ? data : null }
async function hashPassword(password: string, salt = b64(crypto.getRandomValues(new Uint8Array(16)))) { const material = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']); const bits = await crypto.subtle.deriveBits({ name:'PBKDF2', hash:'SHA-256', salt:unb64(salt), iterations:120000 }, material, 256); return { salt, hash:b64(new Uint8Array(bits)) } }
async function requireUser(c: any, next: any) { const raw = c.req.header('Authorization')?.replace(/^Bearer\s+/i,''); const claims = raw ? await parseToken(raw, c.env.JWT_SECRET) : null; if (!claims) return json({ error:'Unauthorized' },401); c.set('user', claims); await next() }
async function requireAdmin(c: any, next: any) { if (c.get('user').role !== 'admin') return json({ error:'Admin only' },403); await next() }
function safeUser(row: any) { return { id:row.id, email:row.email, username:row.username, role:row.role, status:row.status, demoBalance:row.demo_balance } }
async function issueUserToken(user: any, secret: string) { return token({ id:user.id, role:user.role, email:user.email, username:user.username, exp:Math.floor(Date.now()/1000)+60*60*8 }, secret) }

app.get('/health', c => json({ ok:true, demoPayments: c.env.DEMO_PAYMENTS_ENABLED === 'true' }))
app.get('/realtime/:gameId', async c => {
  if (c.req.header('Upgrade') !== 'websocket') return json({ error:'WebSocket upgrade required' },426)
  const claims = await parseToken(c.req.query('token') || '', c.env.JWT_SECRET)
  if (!claims) return json({ error:'Unauthorized' },401)
  const room = c.env.GAME_ROOM.get(c.env.GAME_ROOM.idFromName(c.req.param('gameId')))
  const headers = new Headers(c.req.raw.headers); headers.set('x-lumen-player', JSON.stringify({ id:claims.id, username:claims.username }))
  return room.fetch(new Request(c.req.raw.url, { headers }))
})
app.post('/auth/register', async c => { const input = authSchema.safeParse(await c.req.json()); if (!input.success || !input.data.username) return json({ error:'Invalid registration details' },400); const exists = await c.env.DB.prepare('SELECT id FROM users WHERE email=? OR username=?').bind(input.data.email.toLowerCase(), input.data.username).first(); if (exists) return json({ error:'Email or username already exists' },409); const {salt,hash} = await hashPassword(input.data.password); const user = { id:uuid(), email:input.data.email.toLowerCase(), username:input.data.username, role:'player' }; await c.env.DB.prepare('INSERT INTO users (id,email,username,password_hash,password_salt,role) VALUES (?,?,?,?,?,?)').bind(user.id,user.email,user.username,hash,salt,user.role).run(); return json({ user:{...user,demoBalance:250000}, token:await issueUserToken(user,c.env.JWT_SECRET) },201) })
app.post('/auth/login', async c => { const body = await c.req.json(); const email = typeof body.email === 'string' ? body.email.toLowerCase() : ''; const password = typeof body.password === 'string' ? body.password : ''; if (!email || password.length < 8) return json({error:'Invalid credentials'},400); let user = await c.env.DB.prepare('SELECT * FROM users WHERE email=?').bind(email).first<any>(); if (!user && !email.includes('@')) user = await c.env.DB.prepare('SELECT * FROM users WHERE username=?').bind(body.email).first<any>(); if (!user && email.endsWith('@hitclub.local')) user = await c.env.DB.prepare('SELECT * FROM users WHERE username=?').bind(email.replace(/@hitclub\.local$/, '')).first<any>(); if(!user || user.status !== 'active') return json({error:'Invalid credentials'},401); const check = await hashPassword(password,user.password_salt); if(check.hash !== user.password_hash) return json({error:'Invalid credentials'},401); return json({user:safeUser(user),token:await issueUserToken(user,c.env.JWT_SECRET)}) })
app.get('/auth/me', requireUser, async c => { const row = await c.env.DB.prepare('SELECT * FROM users WHERE id=?').bind(c.get('user').id).first(); return row ? json({user:safeUser(row)}) : json({error:'Unauthorized'},401) })
app.get('/configs/public', async c => { const rows = await c.env.DB.prepare("SELECT key,value FROM app_configs WHERE is_active=1").all<{key:string,value:string}>(); return json({ configs:Object.fromEntries(rows.results.map(x=>[x.key,x.value])) }) })
app.get('/wallet/transactions', requireUser, async c => { const rows = await c.env.DB.prepare('SELECT * FROM demo_transactions WHERE user_id=? ORDER BY created_at DESC LIMIT 50').bind(c.get('user').id).all(); return json({transactions:rows.results}) })
app.post('/wallet/requests', requireUser, async c => { if(c.env.DEMO_PAYMENTS_ENABLED !== 'true') return json({error:'Demo payments are disabled'},403); const input = z.object({type:z.enum(['DEMO_TOPUP','DEMO_WITHDRAW']), method:z.enum(['bank_qr_demo','binance_demo']), amount:z.number().int().min(10000).max(10000000)}).safeParse(await c.req.json()); if(!input.success) return json({error:'Invalid request'},400); const user = await c.env.DB.prepare('SELECT demo_balance FROM users WHERE id=?').bind(c.get('user').id).first<{demo_balance:number}>(); if(!user || (input.data.type === 'DEMO_WITHDRAW' && user.demo_balance < input.data.amount)) return json({error:'Insufficient demo balance'},400); const id=uuid(); await c.env.DB.prepare('INSERT INTO demo_transactions (id,user_id,type,method,amount,balance_before,balance_after,status,reference_id) VALUES (?,?,?,?,?,?,?,?,?)').bind(id,c.get('user').id,input.data.type,input.data.method,input.data.amount,user.demo_balance,user.demo_balance,'pending',`req_${id}`).run(); return json({requestId:id,status:'pending'},201) })
const gameRules = {
  'skyfall-slots': { title:'Skyfall Slots', chance:44, multiplier:2.2 },
  'meteor-crash': { title:'Meteor Crash', chance:46, multiplier:2 },
  'velvet-blackjack': { title:'Velvet Blackjack', chance:43, multiplier:2.1 },
  'nova-roulette': { title:'Nova Roulette', chance:35, multiplier:2.7 },
  'royal-baccarat': { title:'Royal Baccarat', chance:45, multiplier:2 },
  'neon-poker': { title:'Neon Poker', chance:40, multiplier:2.35 },
  'keno-pulse': { title:'Keno Pulse', chance:38, multiplier:2.5 },
  'prism-plinko': { title:'Prism Plinko', chance:48, multiplier:1.9 },
  'mines-orbit': { title:'Mines Orbit', chance:42, multiplier:2.25 },
  'sic-bo-aurora': { title:'Sic Bo Aurora', chance:41, multiplier:2.3 }
} as const
app.post('/games/play', requireUser, async c => {
  const input = z.object({ gameId:z.enum(['skyfall-slots','meteor-crash','velvet-blackjack','nova-roulette','royal-baccarat','neon-poker','keno-pulse','prism-plinko','mines-orbit','sic-bo-aurora']), bet:z.number().int().min(1000).max(500000), choice:z.string().max(40).optional() }).safeParse(await c.req.json())
  if(!input.success) return json({error:'Invalid game round'},400)
  const user = await c.env.DB.prepare('SELECT demo_balance FROM users WHERE id=?').bind(c.get('user').id).first<{demo_balance:number}>()
  if(!user || user.demo_balance < input.data.bet) return json({error:'Số dư Lumen Coin không đủ.'},400)
  const rule = gameRules[input.data.gameId]
  const roll = crypto.getRandomValues(new Uint32Array(1))[0] % 10000
  const won = roll < rule.chance * 100
  const payout = won ? Math.round(input.data.bet * rule.multiplier) : 0
  const afterBet = user.demo_balance - input.data.bet
  const afterRound = afterBet + payout
  const roundId = uuid()
  const bets = [
    c.env.DB.prepare('UPDATE users SET demo_balance=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').bind(afterRound,c.get('user').id),
    c.env.DB.prepare('INSERT INTO demo_transactions (id,user_id,type,method,amount,balance_before,balance_after,status,reference_id,metadata) VALUES (?,?,?,?,?,?,?,?,?,?)').bind(uuid(),c.get('user').id,'BET','game_demo',input.data.bet,user.demo_balance,afterBet,'completed',roundId,JSON.stringify({gameId:input.data.gameId,choice:input.data.choice||null,roll})),
    c.env.DB.prepare('INSERT INTO game_rounds (id,room_id,round_number,status,result_data) VALUES (?,?,?,?,?)').bind(roundId,'demo-room',Date.now(),'SETTLED',JSON.stringify({gameId:input.data.gameId,won,payout,roll}))
  ]
  if(payout) bets.push(c.env.DB.prepare('INSERT INTO demo_transactions (id,user_id,type,method,amount,balance_before,balance_after,status,reference_id,metadata) VALUES (?,?,?,?,?,?,?,?,?,?)').bind(uuid(),c.get('user').id,'WIN','game_demo',payout,afterBet,afterRound,'completed',roundId,JSON.stringify({gameId:input.data.gameId,multiplier:rule.multiplier})))
  await c.env.DB.batch(bets)
  return json({ roundId, game:rule.title, won, multiplier:won?rule.multiplier:0, payout, balance:afterRound, roll })
})
app.get('/admin/transactions', requireUser, requireAdmin, async c => { const rows = await c.env.DB.prepare('SELECT t.*,u.username,u.email FROM demo_transactions t JOIN users u ON u.id=t.user_id ORDER BY t.created_at DESC LIMIT 100').all(); return json({transactions:rows.results}) })
app.patch('/admin/transactions/:id', requireUser, requireAdmin, async c => { const input=z.object({status:z.enum(['approved','rejected']),adminNote:z.string().max(500).optional()}).safeParse(await c.req.json()); if(!input.success)return json({error:'Invalid update'},400); const tx=await c.env.DB.prepare("SELECT * FROM demo_transactions WHERE id=? AND status='pending'").bind(c.req.param('id')).first<any>(); if(!tx)return json({error:'Pending request not found'},404); const user=await c.env.DB.prepare('SELECT demo_balance FROM users WHERE id=?').bind(tx.user_id).first<any>(); if(!user)return json({error:'User not found'},404); if(input.data.status==='approved' && tx.type==='DEMO_WITHDRAW' && user.demo_balance<tx.amount)return json({error:'Balance changed; cannot approve withdrawal'},409); const next=input.data.status==='approved' ? (tx.type==='DEMO_TOPUP'?user.demo_balance+tx.amount:user.demo_balance-tx.amount) : user.demo_balance; await c.env.DB.batch([c.env.DB.prepare('UPDATE users SET demo_balance=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').bind(next,tx.user_id),c.env.DB.prepare('UPDATE demo_transactions SET status=?,balance_before=?,balance_after=?,admin_note=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').bind(input.data.status,user.demo_balance,next,input.data.adminNote||null,tx.id)]); return json({ok:true,balance:next}) })
app.get('/admin/configs', requireUser, requireAdmin, async c => { const rows=await c.env.DB.prepare('SELECT * FROM app_configs ORDER BY key').all(); return json({configs:rows.results}) })
app.put('/admin/configs/:key', requireUser, requireAdmin, async c => { const input=z.object({value:z.string().min(1).max(500),type:z.enum(['text','boolean']).default('text'),isActive:z.boolean().default(true)}).safeParse(await c.req.json()); if(!input.success)return json({error:'Invalid config'},400); const key=decodeURIComponent(c.req.param('key')); await c.env.DB.prepare('INSERT INTO app_configs (id,key,value,type,is_active) VALUES (?,?,?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,type=excluded.type,is_active=excluded.is_active,updated_at=CURRENT_TIMESTAMP').bind(uuid(),key,input.data.value,input.data.type,input.data.isActive?1:0).run(); return json({ok:true}) })
export default app

/** A single named room per game type. State broadcasts are authoritative for presence and phase. */
type SicBoRound = { id:string; phase:'OPEN'|'REVEALED'; closesAt:number; tai:number; xiu:number; dice?:number[]; result?:'TAI'|'XIU'|'TRIPLE' }
export class GameRoom extends DurableObject<Bindings> {
  constructor(ctx: DurableObjectState, env: Bindings) { super(ctx, env) }
  async fetch(request: Request) {
    const player = request.headers.get('x-lumen-player')
    if (!player) return new Response('Unauthorized', { status:401 })
    if (this.ctx.getWebSockets().length >= 100) return new Response('Room is full', { status:429 })
    const round = await this.currentRound()
    const pair = new WebSocketPair(); const [client, server] = Object.values(pair)
    this.ctx.acceptWebSocket(server)
    server.serializeAttachment({ ...JSON.parse(player), joinedAt:Date.now() })
    server.send(JSON.stringify({ type:'sicbo_state', round, online:this.ctx.getWebSockets().length }))
    this.broadcast({ type:'presence', online:this.ctx.getWebSockets().length })
    return new Response(null, { status:101, webSocket:client })
  }
  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer) {
    const player = ws.deserializeAttachment() as { id:string; username:string }
    try {
      const data = JSON.parse(typeof message === 'string' ? message : new TextDecoder().decode(message))
      if (data.type === 'sicbo_bet') await this.placeBet(ws, player, data)
      if (data.type === 'ready') this.broadcast({ type:'presence', online:this.ctx.getWebSockets().length })
    } catch { ws.send(JSON.stringify({ type:'error', message:'Dữ liệu không hợp lệ.' })) }
  }
  async alarm() {
    const round = await this.currentRound()
    if (round.phase === 'OPEN') await this.reveal(round)
    else await this.startRound()
  }
  webSocketClose(ws: WebSocket) { ws.close(1000, 'Closed'); this.broadcast({ type:'presence', online:this.ctx.getWebSockets().length }) }
  private async currentRound(): Promise<SicBoRound> { return (await this.ctx.storage.get<SicBoRound>('sicbo-round')) || this.startRound() }
  private async startRound(): Promise<SicBoRound> {
    const round:SicBoRound = { id:crypto.randomUUID(), phase:'OPEN', closesAt:Date.now()+60_000, tai:0, xiu:0 }
    await this.ctx.storage.put('sicbo-round',round)
    await this.ctx.storage.setAlarm(round.closesAt)
    await this.env.DB.prepare('INSERT INTO game_rounds (id,room_id,round_number,status,opens_at,closes_at) VALUES (?,?,?,?,datetime(\'now\'),datetime(\'now\',\'+60 seconds\'))').bind(round.id,'demo-room',Date.now(),'OPEN').run()
    this.broadcast({ type:'sicbo_state', round, online:this.ctx.getWebSockets().length })
    return round
  }
  private async placeBet(ws: WebSocket, player:{id:string;username:string}, input:any) {
    const amount = Number(input.amount); const choice = input.choice
    if (!Number.isInteger(amount) || amount < 1000 || amount > 500000 || !['TAI','XIU'].includes(choice)) return ws.send(JSON.stringify({type:'error',message:'Cược không hợp lệ.'}))
    const round = await this.currentRound()
    if (round.phase !== 'OPEN' || Date.now() >= round.closesAt) return ws.send(JSON.stringify({type:'error',message:'Ván đã đóng cược.'}))
    const user = await this.env.DB.prepare('SELECT demo_balance FROM users WHERE id=?').bind(player.id).first<{demo_balance:number}>()
    if (!user || user.demo_balance < amount) return ws.send(JSON.stringify({type:'error',message:'Không đủ Lumen Coin.'}))
    const betId=crypto.randomUUID(), after=user.demo_balance-amount
    await this.env.DB.batch([
      this.env.DB.prepare('UPDATE users SET demo_balance=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').bind(after,player.id),
      this.env.DB.prepare('INSERT INTO bets (id,round_id,user_id,idempotency_key,bet_type,amount,status) VALUES (?,?,?,?,?,?,?)').bind(betId,round.id,player.id,betId,choice,amount,'placed'),
      this.env.DB.prepare('INSERT INTO demo_transactions (id,user_id,type,method,amount,balance_before,balance_after,status,reference_id,metadata) VALUES (?,?,?,?,?,?,?,?,?,?)').bind(crypto.randomUUID(),player.id,'BET','sicbo_demo',amount,user.demo_balance,after,'completed',round.id,JSON.stringify({choice}))
    ])
    choice === 'TAI' ? round.tai += amount : round.xiu += amount
    await this.ctx.storage.put('sicbo-round',round)
    this.broadcast({ type:'sicbo_state', round, online:this.ctx.getWebSockets().length })
  }
  private async reveal(round:SicBoRound) {
    const dice = Array.from(crypto.getRandomValues(new Uint8Array(3)), n => n % 6 + 1); const sum=dice.reduce((a,b)=>a+b,0)
    const result = dice[0]===dice[1] && dice[1]===dice[2] ? 'TRIPLE' : sum >= 11 ? 'TAI' : 'XIU'
    const bets = await this.env.DB.prepare('SELECT * FROM bets WHERE round_id=? AND status=\'placed\'').bind(round.id).all<any>()
    const queries:D1PreparedStatement[]=[this.env.DB.prepare('UPDATE game_rounds SET status=?,result_data=?,settled_at=CURRENT_TIMESTAMP WHERE id=?').bind('SETTLED',JSON.stringify({dice,sum,result}),round.id)]
    for (const bet of bets.results) {
      const won=bet.bet_type===result; const payout=won ? bet.amount*2 : 0
      queries.push(this.env.DB.prepare('UPDATE bets SET payout=?,status=?,settled_at=CURRENT_TIMESTAMP WHERE id=?').bind(payout,won?'won':'lost',bet.id))
      if(won) { const user=await this.env.DB.prepare('SELECT demo_balance FROM users WHERE id=?').bind(bet.user_id).first<{demo_balance:number}>(); if(user) { queries.push(this.env.DB.prepare('UPDATE users SET demo_balance=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').bind(user.demo_balance+payout,bet.user_id)); queries.push(this.env.DB.prepare('INSERT INTO demo_transactions (id,user_id,type,method,amount,balance_before,balance_after,status,reference_id) VALUES (?,?,?,?,?,?,?,?,?)').bind(crypto.randomUUID(),bet.user_id,'WIN','sicbo_demo',payout,user.demo_balance,user.demo_balance+payout,'completed',round.id)) } }
    }
    await this.env.DB.batch(queries)
    const revealed:SicBoRound={...round,phase:'REVEALED',closesAt:Date.now()+10_000,dice,result}
    await this.ctx.storage.put('sicbo-round',revealed); await this.ctx.storage.setAlarm(revealed.closesAt)
    this.broadcast({ type:'sicbo_state', round:revealed, online:this.ctx.getWebSockets().length })
  }
  private broadcast(payload: unknown) { const text=JSON.stringify(payload); for (const ws of this.ctx.getWebSockets()) { try { ws.send(text) } catch {} } }
}

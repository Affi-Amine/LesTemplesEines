const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript')
const {createHash}=require('node:crypto')
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`
const token='m'.repeat(43),hash=createHash('sha256').update(token).digest('hex'),root=path.resolve(__dirname,'..')
let tables,calls=[],queued=[],notifications=0,rpcFailure=null
function seed() {
  calls=[];queued=[];notifications=0;rpcFailure=null
  const start='2099-11-02T10:00:00.000Z'
  tables={
    appointment_client_changes:[],
    appointment_management_links:[{id:id(6),appointment_id:id(5),token_hash:hash,expires_at:'2100-01-01T00:00:00Z',revoked_at:null}],
    appointments:[{id:id(5),salon_id:id(1),staff_id:id(2),service_id:id(4),status:'confirmed',start_time:start,end_time:'2099-11-02T11:30:00.000Z',updated_at:'2026-01-01T00:00:00.000Z',payment_status:'paid',payment_method:'stripe',amount_paid_cents:14000,
      internal_notes:'PRIVATE-NOTES',stripe_payment_intent_id:'PRIVATE-STRIPE-ID',client:{first_name:'Camille',last_name:'Test',email:'private@example.test',phone:'0601020304'},
      service:{id:id(4),name:'Massage',price_cents:14000},staff:{id:id(2),first_name:'Alice',last_name:'Test'},assignments:[{staff_id:id(2),staff:{id:id(2),first_name:'Alice',last_name:'Test'}}],
      salon:{name:'Temple Test',opening_hours:Object.fromEntries(['sunday','monday','tuesday','wednesday','thursday','friday','saturday'].map(d=>[d,{open:'09:00',close:'21:00'}]))}}],
    staff:[{id:id(2),salon_id:id(1),is_active:true,role:'therapist'}],staff_availability:[],appointment_assignments:[],staff_services:[],
  }
}
function from(table) {
  const predicates=[];let operation,values
  const get=(row,key)=>key.split('.').reduce((value,part)=>value?.[part],row)
  const add=(key,check)=>{predicates.push(row=>check(get(row,key)));return query}
  const execute=single=>{
    if(operation==='insert') { const rows=(Array.isArray(values)?values:[values]).map(row=>({id:id(100+tables[table].length),...row}));tables[table].push(...rows) }
    const rows=tables[table].filter(row=>predicates.every(check=>check(row)))
    if(operation==='update')rows.forEach(row=>Object.assign(row,values))
    return {data:single?rows[0]||null:rows,error:null}
  }
  const query={select(){return query},eq:(k,v)=>add(k,x=>x===v),neq:(k,v)=>add(k,x=>x!==v),in:(k,v)=>add(k,x=>v.includes(x)),
    lt:(k,v)=>add(k,x=>x<v),gt:(k,v)=>add(k,x=>x>v),limit(){return query},filter(){return query},
    insert(value){operation='insert';values=value;return query},update(value){operation='update';values=value;return query},maybeSingle:async()=>execute(true),then(resolve,reject){return Promise.resolve(execute(false)).then(resolve,reject)}}
  return query
}
const db={from,rpc:async(name,payload)=>{
  calls.push({name,payload});if(rpcFailure)return {data:null,error:rpcFailure}
  const booking=tables.appointments[0]
  if(payload.p_action==='cancel')booking.status='cancelled'
  else {const duration=Date.parse(booking.end_time)-Date.parse(booking.start_time);booking.start_time=payload.p_start_time;booking.end_time=new Date(Date.parse(booking.start_time)+duration).toISOString()}
  booking.updated_at='2026-02-01T00:00:00.000Z'
  tables.appointment_client_changes.push({appointment_id:booking.id,request_id:payload.p_request_id,notification_status:'pending'})
  return {data:{id:booking.id,replayed:false},error:null}
}}
const modules=new Map()
function load(relative) {
  const filename=path.join(root,relative);if(modules.has(filename))return modules.get(filename).exports
  const mod={exports:{}};modules.set(filename,mod)
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{
    exports:mod.exports,process,console:{log(){},error(){}},Headers,URL,
    require(name){
      if(name==='@/lib/supabase/admin')return {createAdminClient:()=>db}
      if(name==='@/lib/appointments/create')return {resolveStaffIdsThatCanProvideService:async(_,ids)=>ids}
      if(name==='@/lib/gift-cards')return {getBaseUrl:()=> 'https://example.test'}
      if(name==='@/lib/email/appointment-management')return {sendAppointmentClientChangedNotifications:async()=>notifications++}
      if(name==='next/server')return {after:callback=>queued.push(callback),NextResponse:{json:(data,init={})=>{
        const response={data,status:init.status||200,headers:new Headers(init.headers),storedCookies:[]}
        response.cookies={set:(...args)=>response.storedCookies.push(args)}
        return response
      }}}

      if(name.startsWith('@/'))return load(name.slice(2)+'.ts')
      if(name.startsWith('.'))return load(path.relative(root,path.resolve(path.dirname(filename),name))+'.ts')
      return require(name)
    },
  },{filename})
  return mod.exports
}
function request(body,options={}) {
  return {nextUrl:new URL(options.url||'https://example.test/api/booking-management/appointment'),
    headers:new Headers({origin:options.origin||'https://example.test','content-type':'application/json',...(options.noHeader?{}:{'x-booking-action':'1'})}),
    text:async()=>JSON.stringify(body),cookies:{get:()=>options.noCookie?undefined:{value:options.token||token}}}
}

async function main() {
  const policy=load('lib/appointments/management-policy.ts')
  const future={status:'confirmed',start_time:'2026-10-26T09:00:00Z'}
  assert.equal(policy.managementPermission(future,new Date('2026-10-25T22:59:59Z')).allowed,true)
  assert.equal(policy.managementPermission(future,new Date('2026-10-25T23:00:00Z')).allowed,false)
  assert.equal(policy.managementPermission({status:'confirmed',start_time:'2026-03-29T08:00:00Z'},new Date('2026-03-28T23:00:00Z')).allowed,false)
  console.log('PASS: Paris midnight and DST deadlines are calendar-day rules, not rolling 24-hour limits')
  seed()
  const management=load('lib/appointments/management.ts')
  const link=await management.issueManagementLink(tables.appointments[0])
  const raw=new URLSearchParams(new URL(link).hash.slice(1)).get('cle')
  assert.equal(raw.length,43)
  assert.equal(tables.appointment_management_links[1].token_hash,management.hashManagementToken(raw))
  assert.ok(!JSON.stringify(tables.appointment_management_links).includes(raw))
  console.log('PASS: links use 256-bit random fragments; only a hash is stored')
  const sessionRoute=load('app/api/booking-management/session/route.ts')
  const previousEnvironment=process.env.NODE_ENV
  process.env.NODE_ENV='production'
  const sessionResponse=await sessionRoute.POST(request({token}))
  if(previousEnvironment===undefined)delete process.env.NODE_ENV
  else process.env.NODE_ENV=previousEnvironment
  assert.equal(sessionResponse.status,200)
  const cookie=sessionResponse.storedCookies[0]
  assert.equal(cookie[0],'bookingManagement')
  assert.equal(cookie[2].httpOnly,true)
  assert.equal(cookie[2].secure,true)
  assert.equal(cookie[2].sameSite,'strict')
  assert.equal(cookie[2].path,'/api/booking-management')
  assert.equal(cookie[2].maxAge,1800)
  assert.ok(!JSON.stringify(sessionResponse.data).includes(token))
  console.log('PASS: fragment exchange creates a short-lived HttpOnly, Secure, SameSite=Strict cookie scoped to management APIs')
  const routes=load('app/api/booking-management/appointment/route.ts')
  let result=await routes.GET(request({}))
  assert.equal(result.status,200)
  assert.match(result.headers.get('cache-control'),/no-store/)
  for(const forbidden of ['PRIVATE-NOTES','PRIVATE-STRIPE-ID','private@example.test',token,hash])assert.ok(!JSON.stringify(result.data).includes(forbidden))
  assert.equal(calls.length,0)
  const payload={appointment_id:id(5),request_id:id(80),expected_updated_at:'2026-01-01T00:00:00.000Z',action:'cancel'}
  assert.equal((await routes.PATCH(request(payload,{origin:'https://evil.example'}))).status,403)
  assert.equal((await routes.PATCH(request(payload,{noHeader:true}))).status,403)
  assert.equal((await routes.PATCH(request({...payload,payment_status:'paid'}))).status,400)
  assert.equal((await routes.PATCH(request({...payload,appointment_id:id(99)}))).status,409)
  assert.equal((await routes.PATCH(request(payload,{noCookie:true}))).status,401)
  assert.equal((await routes.PATCH(request(payload,{token:'z'.repeat(43)}))).status,401)
  assert.equal(calls.length,0)
  console.log('PASS: GET is read-only; responses hide private data; CSRF, forged fields and cross-tab ownership mismatches blocked')
  tables.appointment_management_links[0].revoked_at=new Date().toISOString()
  assert.equal((await routes.GET(request({}))).status,401)
  seed()
  tables.appointment_management_links[0].expires_at='2020-01-01T00:00:00Z'
  assert.equal((await routes.GET(request({}))).status,401)
  seed()
  result=await routes.PATCH(request(payload))
  assert.equal(result.status,200)
  assert.equal(result.data.status,'cancelled')
  assert.equal(result.data.payment_status,'paid')
  assert.equal(calls[0].payload.p_token_hash,hash)
  assert.ok(!JSON.stringify(calls).includes(token))
  await queued[0]()
  assert.equal(notifications,1)
  assert.equal(tables.appointment_client_changes[0].notification_status,'sent')
  seed();rpcFailure={code:'23P01',message:'Ce créneau est occupé.'}
  result=await routes.PATCH(request({...payload,action:'reschedule',start_time:'2099-11-03T13:00:00.000Z'}))
  assert.equal(result.status,409)
  assert.equal(tables.appointments[0].start_time,'2099-11-02T10:00:00.000Z')
  console.log('PASS: mutations pass only a scoped hash to the atomic RPC; paid cancellations preserve payment and slot conflicts preserve the original booking')
}
main().catch(error=>{console.error(error);process.exitCode=1})

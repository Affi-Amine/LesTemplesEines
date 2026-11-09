// Runs the actual schemas, creation code and public/Stripe/gift-card routes.
// Supabase and payment/notification services are isolated; no real data or money.
const assert = require('node:assert/strict')
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), ts = require('typescript')
const { PGlite } = require('@electric-sql/pglite')
const root = path.resolve(__dirname, '..')
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12,'0')}`
const [salon, service, client, a, b, foreign] = [1,2,3,4,5,6].map(id)
const start = '2099-11-02T10:00:00.000Z'
let tables, writes, probes, missingStorage, sequence, stripeCreates, webhookEvent
const contact = { first_name:'Camille',last_name:'Test',phone:'0601020304',email:'camille@example.test' }
function seed(required = 1) {
  writes = []; probes = 0; missingStorage = false; sequence = 100; stripeCreates = 0
  tables = {
    salons:[{id:salon,name:'Temple QA',slug:'qa',opening_hours:Object.fromEntries(['monday','tuesday','wednesday','thursday','friday','saturday','sunday'].map(day=>[day,{open:'09:00',close:'20:00'}]))}],
    services:[{id:service,name:'Massage QA',duration_minutes:60,price_cents:8000,required_staff_count:required,is_active:true}],
    service_salons:[{service_id:service,salon_id:salon}], staff_services:[], staff_availability:[],
    staff:[a,b].map(key=>({id:key,salon_id:salon,is_active:true,role:'therapist'})),
    clients:[{id:client,...contact}], appointments:[], appointment_assignments:[], payments:[], loyalty_points:[],
    stripe_checkout_sessions:[],gift_cards:[{id:id(30),code:'GIFT-QA',status:'active',used_at:null,service_id:service,amount_cents:8000,service:{required_staff_count:required}}],
  }
}
const db = { from(table) {
  assert(tables[table], `Unexpected table ${table}`)
  const filters = []; let selection = '', operation, values, maximum
  const at = (row,key) => key.split('.').reduce((value,part)=>value?.[part],row)
  const compare = (key,op,value) => {
    filters.push(row=>op==='in'?value.includes(at(row,key)):op==='eq'?at(row,key)===value:op==='neq'?at(row,key)!==value:op==='lt'?at(row,key)<value:op==='gt'?at(row,key)>value:op==='gte'?at(row,key)>=value:at(row,key)<=value)
    return query
  }
  const decorate = row => table==='appointment_assignments'
    ? {...row,appointment:tables.appointments.find(booking=>booking.id===row.appointment_id)}
    : {...row}
  const execute = single => {
    if(table==='appointments' && selection==='client_requested_staff_ids') {
      probes++
      if(missingStorage) return {data:null,error:{code:'42703',message:'Column missing'}}
    }
    let rows = tables[table].filter(row=>filters.every(test=>test(decorate(row))))
    if(operation==='insert') {
      rows = (Array.isArray(values)?values:[values]).map(row=>({id:id(sequence++),...row}))
      tables[table].push(...rows); writes.push({table,operation,rows})
    } else if(operation==='update') {
      rows.forEach(row=>Object.assign(row,values)); writes.push({table,operation,rows})
    } else if(operation==='delete') { tables[table]=tables[table].filter(row=>!rows.includes(row)); writes.push({table,operation,rows}) }
    if(maximum!==undefined) rows=rows.slice(0,maximum)
    const result=rows.map(decorate)
    return {data:single?result[0]||null:result,error:null}
  }
  const query = {
    select(value=''){selection=value;return query}, eq:(k,v)=>compare(k,'eq',v),neq:(k,v)=>compare(k,'neq',v),
    in:(k,v)=>compare(k,'in',v),lt:(k,v)=>compare(k,'lt',v),gt:(k,v)=>compare(k,'gt',v),
    gte:(k,v)=>compare(k,'gte',v),lte:(k,v)=>compare(k,'lte',v),
    filter(k,op,v){return compare(k,op,op==='in'?v.slice(1,-1).split(',').map(value=>value.replaceAll('"','')):v)},
    limit(value){maximum=value;return query}, insert(value){operation='insert';values=value;return query},
    update(value){operation='update';values=value;return query},delete(){operation='delete';return query},
    single:async()=>execute(true),maybeSingle:async()=>execute(true),
    then(resolve,reject){return Promise.resolve(execute(false)).then(resolve,reject)},
  }
  return query
}}
const modules = new Map()
function load(relative) {
  if(modules.has(relative)) return modules.get(relative).exports
  const mod={exports:{}};modules.set(relative,mod)
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(root,relative),'utf8'),{
    compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022},
  }).outputText,{
    exports:mod.exports,crypto:require('node:crypto').webcrypto,Date,Intl,Error,console:{log(){},error(){}},
    require(name){
      if(name==='@/lib/supabase/admin') return {createAdminClient:()=>db}
      if(name==='@/lib/client-auth') return {findClientByPhone:async()=>tables.clients[0],findClientByEmail:async()=>tables.clients[0]}
      if(name==='@/lib/auth/api-auth') return {getStaffAuth:()=>null,requireStaffAuth:()=>({payload:{role:'admin'}})}
      if(name==='@/lib/sync/trigger') return {syncAfterBookingChange(){},loadRemoteCopies:async()=>[],cancelRemoteCopiesAfterDelete(){}}
      if(name==='@/lib/gift-cards') return {getBaseUrl:()=> 'http://local.test',normalizeGiftCardCode:code=>code}
      if(name==='@/lib/stripe') return {stripeWebhookSecret:'local-test-only',getStripeClient:()=>({
        checkout:{sessions:{create:async()=>{stripeCreates++;return {id:'cs_choice',url:'https://checkout.example.test'}}}},
        webhooks:{constructEvent:()=>webhookEvent},paymentIntents:{update:async()=>({})},
      })}
      if(name.startsWith('@/lib/email/')) return new Proxy({},{get:()=>async()=>{}})
      if(name==='@/lib/stripe-pack-billing') return {}
      if(name==='next/server') return {after(){},NextResponse:{json:(data,init)=>({data,status:init?.status||200})}}
      return name.startsWith('@/')?load(name.slice(2)+'.ts'):require(name)
    },
  },{filename:relative})
  return mod.exports
}
const input = (extra={}) => ({salon_id:salon,service_id:service,client_id:client,staff_id:a,staff_ids:[a],start_time:start,...extra})
const request = body => ({json:async()=>body,nextUrl:new URL('http://local.test/api'),headers:new Headers(),text:async()=>''})
const list = value => Array.from(value || [])
async function main() {
  seed()
  const create=load('lib/appointments/create.ts')
  const direct=load('app/api/appointments/route.ts').POST
  const checkout=load('app/api/stripe/checkout/appointment/route.ts').POST
  const webhook=load('app/api/stripe/webhook/route.ts').POST
  const redeem=load('app/api/gift-cards/redeem/route.ts').POST
  assert.deepEqual(list(create.BookableAppointmentSchema.parse(input()).client_requested_staff_ids),[])
  assert.deepEqual(list(create.BookableAppointmentSchema.parse(input({client_requested_staff_ids:[a]})).client_requested_staff_ids),[a])
  assert.deepEqual(list(create.BookableAppointmentSchema.parse(input({booking_source:'admin',client_requested_staff_ids:[a]})).client_requested_staff_ids),[])
  for(const choice of [[a,a],['invalid'],[foreign],null]) {
    assert.equal(create.BookableAppointmentSchema.safeParse(input({client_requested_staff_ids:choice})).success,false)
    seed();await assert.rejects(()=>create.createBookableAppointment(db,input({client_requested_staff_ids:choice})))
    assert.equal(writes.length,0)
    assert.equal((await direct(request(input({client_requested_staff_ids:choice})))).status,400)
    assert.equal(writes.length,0)
  }
  console.log('PASS: explicit choices are unique assigned UUIDs; malformed, duplicate and foreign choices fail before writes, and admin input never becomes a client choice')
  for(const [choice,expected] of [[undefined,[]],[[a],[a]]]) {
    seed();const response=await direct(request(input({client_requested_staff_ids:choice,booking_source:'client'})))
    assert.equal(response.status,201);assert.deepEqual(list(tables.appointments[0].client_requested_staff_ids),expected)
  }
  seed(2);await create.createBookableAppointment(db,input({staff_ids:[a,b],client_requested_staff_ids:[b]}))
  assert.deepEqual(list(tables.appointments[0].client_requested_staff_ids),[b]);assert.equal(tables.appointment_assignments.length,2)
  seed(2);await create.createBookableAppointment(db,input({staff_ids:[a,b]}));assert.deepEqual(list(tables.appointments[0].client_requested_staff_ids),[])
  seed();await create.createBookableAppointment(db,input({booking_source:'admin',client_requested_staff_ids:[a]}));assert.deepEqual(list(tables.appointments[0].client_requested_staff_ids),[]);assert.equal(probes,0)
  console.log('PASS: public direct creation persists the exact choices, including partial duo choice; automatic/legacy/admin teams remain unmarked')
  for(const method of ['on_site','pack']) {
    seed();missingStorage=true
    const response=await direct(request(input({client_id:undefined,client_data:contact,payment_method:method,client_pack_id:method==='pack'?id(70):undefined,client_requested_staff_ids:[a]})))
    assert.equal(response.status,503);assert.equal(writes.length,0)
  }
  seed();missingStorage=true;assert.equal((await direct(request(input()))).status,201);assert.equal(probes,0)
  console.log('PASS: missing storage rejects explicit requests before client/payment/pack effects; automatic bookings keep working on the old schema')
  seed();let result=await checkout(request(input({client_requested_staff_ids:[a],booking_source:'client'})))
  assert.equal(result.status,200);assert.equal(stripeCreates,1)
  assert.deepEqual(list(tables.stripe_checkout_sessions[0].payload.client_requested_staff_ids),[a])
  webhookEvent={type:'checkout.session.completed',data:{object:{id:'cs_choice',payment_status:'paid',payment_intent:'pi_choice'}}}
  const webhookRequest=request({});webhookRequest.headers=new Headers({'stripe-signature':'local-test-signature'})
  assert.equal((await webhook(webhookRequest)).status,200)
  assert.deepEqual(list(tables.appointments[0].client_requested_staff_ids),[a]);assert.equal(tables.appointments[0].payment_status,'paid')
  assert.equal((await webhook(webhookRequest)).status,200);assert.equal(tables.appointments.length,1)
  seed();missingStorage=true;result=await checkout(request(input({client_requested_staff_ids:[a]})))
  assert.equal(result.status,503);assert.equal(stripeCreates,0);assert.equal(writes.length,0)
  seed();missingStorage=true;assert.equal((await checkout(request(input({booking_source:'admin',client_requested_staff_ids:[a]})))).status,200)
  assert.deepEqual(list(tables.stripe_checkout_sessions[0].payload.client_requested_staff_ids),[])
  console.log('PASS: Stripe checkout stores the choice and its real webhook preserves it once; missing storage prevents checkout creation and payment')
  const gift=extra=>({code:'GIFT-QA',salon_id:salon,service_id:service,start_time:start,staff_ids:[a],client_data:contact,...extra})
  seed();assert.equal((await redeem(request(gift({client_requested_staff_ids:[a]})))).status,201)
  assert.deepEqual(list(tables.appointments[0].client_requested_staff_ids),[a]);assert.equal(tables.gift_cards[0].status,'used')
  seed();missingStorage=true;assert.equal((await redeem(request(gift({client_requested_staff_ids:[a]})))).status,503)
  assert.equal(writes.length,0);assert.equal(tables.gift_cards[0].status,'active')
  seed();assert.equal((await redeem(request(gift({client_requested_staff_ids:[foreign]})))).status,400);assert.equal(writes.length,0)
  console.log('PASS: gift-card redemption records explicit choices; invalid or unavailable storage never consumes the card')
  seed();tables.appointments.push({id:id(88),staff_id:a,status:'confirmed',start_time:start,end_time:'2099-11-02T11:00:00.000Z'})
  assert.equal((await direct(request(input({client_requested_staff_ids:[a]})))).status,409);assert.equal(writes.length,0)
  console.log('PASS: client preference does not bypass ordinary scheduling conflicts')
  const pg=new PGlite()
  await pg.exec('CREATE TABLE public.appointments(id uuid PRIMARY KEY,staff_id uuid);')
  await pg.query('INSERT INTO public.appointments VALUES($1,$2)',[id(80),a])
  const sql=fs.readFileSync(path.join(root,'database/migrations/20261109005631_client_requested_staff_ids.sql'),'utf8')
  await pg.exec(sql);await pg.exec(sql)
  assert.deepEqual((await pg.query('SELECT client_requested_staff_ids FROM public.appointments')).rows[0].client_requested_staff_ids,[])
  await pg.query('INSERT INTO public.appointments(id,staff_id,client_requested_staff_ids) VALUES($1,$2,$3)',[id(81),a,[a]])
  await pg.query('UPDATE public.appointments SET staff_id=$2 WHERE id=$1',[id(81),b])
  assert.deepEqual((await pg.query('SELECT client_requested_staff_ids FROM public.appointments WHERE id=$1',[id(81)])).rows[0].client_requested_staff_ids,[a])
  await pg.close()
  console.log('PASS: migration is repeatable, old bookings default to unknown, and original choice survives later reassignment')
}
main().catch(error=>{console.error(error);process.exitCode=1})

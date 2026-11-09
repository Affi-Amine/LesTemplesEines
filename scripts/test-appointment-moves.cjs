// Pure scheduling tests: no network or production data.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript')
const root=path.resolve(__dirname,'..'), cache=new Map()
function load(file){
 const filename=path.join(root,file)
 if(cache.has(filename))return cache.get(filename)
 const exports={};cache.set(filename,exports)
 vm.runInNewContext(ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,Date,Intl,console,require(name){return name.startsWith('@/')?load(name.slice(2)+'.ts'):require(name)}},{filename})
 return exports
}
const {planAppointmentMove:plan,canMoveAppointment,appointmentMoveVersion}=load('lib/calendar/appointment-move.ts')
const date=(day=2,month=10)=>new Date(2099,month,day,12)
const hours=Object.fromEntries(['sunday','monday','tuesday','wednesday','thursday','friday','saturday'].map(day=>[day,{open:'09:00',close:'21:00'}]))
const staff=['a','b','c'].map(id=>({id,salon_id:'salon',first_name:id,role:'therapist',is_active:true,allowed_service_ids:[]}))
const booking={id:'booked',salon_id:'salon',service_id:'massage',status:'confirmed',staff_id:'a',start_time:'2099-11-02T10:00:00Z',end_time:'2099-11-02T11:30:00Z',payment_status:'paid',payment_method:'stripe',amount_paid_cents:14000,service:{id:'massage',duration_minutes:60}}
const base={appointment:booking,destination:{date:date(),hour:14,minute:0,staffId:'a'},appointments:[booking],staff,openingHours:hours,now:Date.parse('2099-11-01T00:00Z')}
const move=(overrides={})=>plan({...base,...overrides})
if(process.argv.includes('--timezone')){
 assert.equal(move({destination:{date:date(),hour:11,minute:0,staffId:'a'}}),null)
 assert.equal(move({destination:{date:date(3),hour:11,minute:0,staffId:'a'}}).start.toISOString(),'2099-11-03T10:00:00.000Z')
 assert.equal(move().start.toISOString(),'2099-11-02T13:00:00.000Z')
 console.log('PASS: browser timezone '+process.env.TZ+' preserves Paris date/time and detects day changes')
 process.exit(0)
}
let result=move()
assert.equal(result.start.toISOString(),'2099-11-02T13:00:00.000Z')
assert.equal(result.end.toISOString(),'2099-11-02T14:30:00.000Z')
assert.equal(result.end-result.start,90*60_000)
assert.equal(booking.payment_status,'paid');assert.equal(booking.start_time,'2099-11-02T10:00:00Z')
console.log('PASS: reserved duration is preserved despite catalogue changes; payment and source stay unchanged')
assert.equal(move({destination:{date:date(),hour:11,staffId:'a'}}),null)
assert.equal(move({destination:{date:date(3),hour:11,staffId:'a'}}).start.toISOString(),'2099-11-03T10:00:00.000Z')
assert.deepEqual(Array.from(move({destination:{date:date(),hour:14,staffId:'b'}}).staffIds),['b'])
console.log('PASS: no-op, date changes and single-practitioner reassignment are distinguished')
const duo={...booking,assignments:[{staff_id:'a'},{staff_id:'b'},{staff_id:'a'}]}
assert.deepEqual(Array.from(move({appointment:duo,destination:{date:date(),hour:14,staffId:'b'}}).staffIds),['a','b'])
assert.throws(()=>move({appointment:duo,destination:{date:date(),hour:14,staffId:'c'}}),/duo/)
const other={...booking,id:'other',staff_id:'b',start_time:'2099-11-02T13:15Z',end_time:'2099-11-02T14:00Z'}
assert.throws(()=>move({appointment:duo,appointments:[duo,other]}),/chevauche/)
console.log('PASS: duo keeps both distinct practitioners and checks conflicts for the entire team')
for(const status of ['confirmed','pending','in_progress','blocked']){
 assert.throws(()=>move({appointments:[booking,{...other,staff_id:'a',status}]}),/chevauche/)
}
for(const status of ['cancelled','no_show','completed'])assert.ok(move({appointments:[booking,{...other,staff_id:'a',status}]}))
assert.ok(move({appointments:[booking,{...other,staff_id:'a',start_time:'2099-11-02T14:30Z',end_time:'2099-11-02T15:00Z'}]}))
console.log('PASS: blocking statuses reject overlap; released slots and exact adjacency remain available')
assert.ok(move({destination:{date:date(),hour:19,minute:30,staffId:'a'}}))
assert.throws(()=>move({destination:{date:date(),hour:20,staffId:'a'}}),/entièrement/)
assert.throws(()=>move({openingHours:Object.fromEntries(Object.keys(hours).map(day=>[day,null]))}),/fermé/)
assert.throws(()=>move({now:Date.parse('2100-01-01')}),/passé/)
assert.throws(()=>move({destination:{date:date(),hour:14,minute:7}}),/quart/)
assert.throws(()=>move({appointment:{...booking,end_time:booking.start_time}}),/durée/)
console.log('PASS: full-duration opening boundaries, closed days, past and malformed moves are rejected')
for(const status of ['completed','cancelled','no_show','in_progress']){
 assert.equal(canMoveAppointment({status}),false);assert.throws(()=>move({appointment:{...booking,status}}),/déplacés/)
}
// A blocked slot moves like a booking (same column rules, same length) though it has no prestation.
const block={id:'block',salon_id:'salon',status:'blocked',staff_id:'b',start_time:'2099-11-02T10:00:00Z',end_time:'2099-11-02T10:45:00Z'}
assert.equal(canMoveAppointment(block),true)
result=move({appointment:block,appointments:[booking,block],destination:{date:date(),hour:15,minute:0,staffId:'c'}})
assert.equal(result.start.toISOString(),'2099-11-02T14:00:00.000Z');assert.equal(result.end.toISOString(),'2099-11-02T14:45:00.000Z');assert.deepEqual(Array.from(result.staffIds),['c'])
assert.throws(()=>move({appointment:block,appointments:[booking,block],destination:{date:date(),hour:11,minute:0,staffId:'a'}}),/chevauche/)
console.log('PASS: blocked slots move with their length kept and never onto a booking')
for(const member of [{...staff[0],salon_id:'elsewhere'},{...staff[0],is_active:false},{...staff[0],role:'receptionist'},{...staff[0],allowed_service_ids:['another']}])assert.throws(()=>move({staff:[member]}))
assert.throws(()=>move({appointment:{...booking,service_items:[{id:'massage'},{id:'extra'}]},staff:[{...staff[0],allowed_service_ids:['massage']}]}),/toutes les prestations/)
assert.notEqual(appointmentMoveVersion(booking),appointmentMoveVersion({...booking,status:'cancelled'}))
console.log('PASS: finished sessions, inactive/foreign/unqualified staff and stale snapshots are protected')

// The salon planning is an explicit exception. Other callers retain every rule above.
const originalBooking=JSON.stringify(booking)
const unrestricted=move({mode:'salon-admin',now:Date.parse('2100-01-01'),openingHours:Object.fromEntries(Object.keys(hours).map(day=>[day,null])),
 staff:[{...staff[0],allowed_service_ids:['another']}],appointments:[booking,{...other,staff_id:'a'}]})
assert.equal(unrestricted.mode,'salon-admin')
assert.equal(unrestricted.end-unrestricted.start,90*60_000)
assert.deepEqual(Array.from(unrestricted.staffIds),['a'])
assert.equal(unrestricted.warnings.length,4)
for(const phrase of [/passé/,/horaires/,/habilitée/,/chevauche/])assert(unrestricted.warnings.some(warning=>phrase.test(warning)))
assert.equal(JSON.stringify(booking),originalBooking)
assert.equal(move().mode,'strict');assert.equal(move().warnings.length,0)
for(const status of ['in_progress','completed']){
 assert.equal(canMoveAppointment({status},'salon-admin'),true)
 assert.equal(move({mode:'salon-admin',appointment:{...booking,status}}).appointment.status,status)
}
for(const status of ['cancelled','no_show','unknown']){
 assert.equal(canMoveAppointment({status},'salon-admin'),false)
 assert.throws(()=>move({mode:'salon-admin',appointment:{...booking,status}}))
}
assert.throws(()=>move({mode:'salon-admin',appointment:duo,destination:{date:date(),hour:14,staffId:'c'}}),/duo/)
assert.deepEqual(Array.from(move({mode:'salon-admin',appointment:duo,appointments:[duo,other],destination:{date:date(),hour:14,staffId:'a'}}).staffIds),['a','b'])
for(const member of [{...staff[0],salon_id:'elsewhere'},{...staff[0],is_active:false},{...staff[0],role:'receptionist'}]){
 assert.throws(()=>move({mode:'salon-admin',staff:[member]}))
}
for(const overrides of [
 {destination:{date:new Date('invalid'),hour:14,staffId:'a'}},
 {destination:{date:date(),hour:25,staffId:'a'}},
 {destination:{date:date(),hour:14,minute:7,staffId:'a'}},
 {appointment:{...booking,end_time:booking.start_time}},
 {appointment:{...booking,salon_id:undefined}},
 {appointment:{...booking,staff_id:null,assignments:[]}},
])assert.throws(()=>move({...overrides,mode:'salon-admin'}))
console.log('PASS: only salon-admin bypasses planning rules; duration, status, identity, active salon team and immutable duo stay protected')
assert.equal(move({destination:{date:date(2,6),hour:14,staffId:'a'},now:Date.parse('2099-06-01')}).start.toISOString(),'2099-07-02T12:00:00.000Z')
for(const tz of ['UTC','America/Los_Angeles','Asia/Tokyo']){
 const run=require('node:child_process').spawnSync(process.execPath,[__filename,'--timezone'],{env:{...process.env,TZ:tz},encoding:'utf8'})
 assert.equal(run.status,0,run.stderr);process.stdout.write(run.stdout)
}
console.log('PASS: winter/summer offsets and browser timezones are covered')

// Render the real hook: dropping saves once, and an ambiguous salon response can be replayed safely.
function moveHookHarness({mode='strict',fetcher=async()=>({ok:true})}={}){
 const slots=[];let cursor=0,uuidCount=0,refreshes=0;const errors=[],successes=[]
 const args={appointments:[{...booking,updated_at:'2099-10-01T00:00:00.000Z'}],staff,openingHours:hours,mode,salonId:'salon',onRefresh(){refreshes++}}
 const hookModule={}
 const react={
  useState(initial){const index=cursor++;if(index>=slots.length)slots[index]=typeof initial==='function'?initial():initial;return [slots[index],value=>{slots[index]=typeof value==='function'?value(slots[index]):value}]},
  useRef(initial){const index=cursor++;if(index>=slots.length)slots[index]={current:initial};return slots[index]},
 }
 vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(root,'lib/hooks/use-appointment-move.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{
  exports:hookModule,Date,Intl,console,Error,TypeError,crypto:{randomUUID(){return '00000000-0000-4000-8000-'+String(++uuidCount).padStart(12,'0')}},
  fetch:(...values)=>fetcher(...values),require(name){
   if(name==='react')return react
   if(name==='sonner')return {toast:{success(...args){successes.push(args)},error(...args){errors.push(args)}}}
   return name.startsWith('@/')?load(name.slice(2)+'.ts'):require(name)
  },
 })
 const render=()=>{cursor=0;return hookModule.useAppointmentMove(args)}
 const destination={date:date(),hour:14,minute:0,staffId:'b'}
 const drop=(target=destination,snapshot=args.appointments[0])=>render().handleDragEnd({active:{data:{current:{appointment:snapshot}}},over:{data:{current:target}}})
 return {args,render,drop,errors,successes,get refreshes(){return refreshes}}
}

;(async()=>{
 const strictCalls=[]
 const strict=moveHookHarness({fetcher:async(url,options)=>{strictCalls.push({url,...options,body:JSON.parse(options.body)});return {ok:true}}})
 await strict.drop()
 assert.equal(strictCalls.length,1);assert.equal(strictCalls[0].url,'/api/appointments/booked');assert.equal(strictCalls[0].method,'PATCH')
 assert.deepEqual(Object.keys(strictCalls[0].body).sort(),['expected_updated_at','staff_id','staff_ids','start_time'])
 assert.equal(strict.refreshes,1);assert.equal(strict.successes.length,1)
 for(const file of ['app/admin/calendrier/page.tsx','app/admin/salons/[id]/dashboard/page.tsx'])assert(!fs.readFileSync(path.join(root,file),'utf8').includes('AppointmentMoveDialog'))

 const salonCalls=[];let release
 const salon=moveHookHarness({mode:'salon-admin',fetcher:(url,options)=>{salonCalls.push({url,...options,body:JSON.parse(options.body)});return new Promise(resolve=>{release=()=>resolve({ok:true})})}})
 const first=salon.drop(),second=salon.drop()
 assert.equal(salonCalls.length,1,'Drop sends immediately; another drop during the save cannot duplicate it')
 assert.equal(salon.render().isMovingAppointment,true);release();await Promise.all([first,second])
 assert.equal(salonCalls[0].url,'/api/admin/salons/salon/appointments/booked/move');assert.equal(salonCalls[0].method,'POST')
 assert.deepEqual(Object.keys(salonCalls[0].body).sort(),['expected_updated_at','request_id','staff_ids','start_time'])
 assert.match(salonCalls[0].body.request_id,/^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/i)
 assert.equal(salonCalls[0].body.expected_updated_at,'2099-10-01T00:00:00.000Z')

 const retries=[];let retryHarness
 retryHarness=moveHookHarness({mode:'salon-admin',fetcher:async(url,options)=>{
  const body=JSON.parse(options.body);retries.push({url,method:options.method,body})
  if(retries.length===1){
   retryHarness.args.appointments=[{...retryHarness.args.appointments[0],start_time:body.start_time,end_time:new Date(Date.parse(body.start_time)+90*60_000).toISOString(),staff_id:'b',updated_at:'2099-10-02T00:00:00.000Z'}]
   throw new TypeError('Response lost after server commit')
  }
  return {ok:true}
 }})
 await retryHarness.drop();retryHarness.render()
 assert(retryHarness.render().moveError)
 const action=retryHarness.errors.at(-1)[1].action;assert.equal(action.label,'Réessayer')
 action.onClick();await new Promise(resolve=>setImmediate(resolve))
 assert.equal(retries.length,2);assert.deepEqual(retries[1],retries[0],'Retry retains the request ID and original version after a refetch')

 let staleCalls=0
 const stale=moveHookHarness({mode:'salon-admin',fetcher:async()=>{staleCalls++;return {ok:true}}})
 const old={...stale.args.appointments[0]};stale.args.appointments=[{...old,updated_at:'2099-10-03T00:00:00.000Z'}]
 await stale.drop(undefined,old);assert.equal(staleCalls,0);assert.match(stale.render().moveError,/modifié/)
 let missingVersionCalls=0
 for(const version of [null,undefined,'not-a-date']){
  const missing=moveHookHarness({mode:'salon-admin',fetcher:async()=>{missingVersionCalls++;return {ok:true}}})
  missing.args.appointments=[{...missing.args.appointments[0],updated_at:version}]
  await missing.drop();assert.match(missing.render().moveError,/Actualisez.*version/)
 }
 assert.equal(missingVersionCalls,0)
 const freshIds=[];const fresh=moveHookHarness({mode:'salon-admin',fetcher:async(url,options)=>{freshIds.push(JSON.parse(options.body).request_id);return {ok:true}}})
 await fresh.drop();await fresh.drop();assert.notEqual(freshIds[0],freshIds[1])
 const foreign=moveHookHarness({mode:'salon-admin',fetcher:async()=>{throw new Error('Must not fetch')}})
 foreign.args.salonId='another-salon';await foreign.drop();assert.equal(foreign.errors.length,1)
 console.log('PASS: immediate salon POST and strict PATCH, no confirmation dialog, one in-flight save, mandatory version, stable retry IDs and stale/foreign rejection')
})().catch(error=>{console.error(error);process.exitCode=1})

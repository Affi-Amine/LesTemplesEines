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
for(const status of ['completed','cancelled','no_show','blocked','in_progress']){
 assert.equal(canMoveAppointment({status}),false);assert.throws(()=>move({appointment:{...booking,status}}),/déplacés/)
}
for(const member of [{...staff[0],salon_id:'elsewhere'},{...staff[0],is_active:false},{...staff[0],role:'receptionist'},{...staff[0],allowed_service_ids:['another']}])assert.throws(()=>move({staff:[member]}))
assert.throws(()=>move({appointment:{...booking,service_items:[{id:'massage'},{id:'extra'}]},staff:[{...staff[0],allowed_service_ids:['massage']}]}),/toutes les prestations/)
assert.notEqual(appointmentMoveVersion(booking),appointmentMoveVersion({...booking,status:'cancelled'}))
console.log('PASS: finished sessions, inactive/foreign/unqualified staff and stale snapshots are protected')
assert.equal(move({destination:{date:date(2,6),hour:14,staffId:'a'},now:Date.parse('2099-06-01')}).start.toISOString(),'2099-07-02T12:00:00.000Z')
for(const tz of ['UTC','America/Los_Angeles','Asia/Tokyo']){
 const run=require('node:child_process').spawnSync(process.execPath,[__filename,'--timezone'],{env:{...process.env,TZ:tz},encoding:'utf8'})
 assert.equal(run.status,0,run.stderr);process.stdout.write(run.stdout)
}
console.log('PASS: winter/summer offsets and browser timezones are covered')



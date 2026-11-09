// Real service routes and planning enrichment; database/network dependencies use local fixtures.
const assert = require('node:assert/strict')
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), ts = require('typescript')
const { PGlite } = require('@electric-sql/pglite')
const z = require('zod').z
const root = path.resolve(__dirname, '..')
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12,'0')}`
const [salon, service, secondary, staff] = [1,2,3,4].map(id)
const plain = value => JSON.parse(JSON.stringify(value))
let state
function seed(extra={}) {
  state = { payload:{staffId:staff,salonId:salon,role:'admin',email:'local@example.test'}, writes:[], queries:[], missing:false, catalogError:false, catalogThrows:false,
    services:[{id:service,name:'Nom catalogue actuel',description:'QA',duration_minutes:60,price_cents:9000,required_staff_count:1,is_active:true,salon_id:salon,planning_color:'tangerine'},
      {id:secondary,name:'Second catalogue',duration_minutes:30,price_cents:4500,required_staff_count:1,is_active:true,salon_id:salon,planning_color:'cyan'}],
    service_salons:[{service_id:service,salon_id:salon},{service_id:secondary,salon_id:salon}],appointments:[],assignments:[], ...extra }
}
const db = { from(table) {
  const trace={table,select:'',filters:[],limit:undefined,operation:null};state.queries.push(trace)
  let values
  const execute = single => {
    const cosmetic = table==='services' && trace.select.includes('planning_color')
    if (cosmetic && state.catalogThrows && trace.select==='id, planning_color') throw new Error('Cosmetic network unavailable')
    if (cosmetic && (state.missing || (state.catalogError && trace.select==='id, planning_color'))) return {data:null,error:{code:'42703',message:'Optional cosmetic column unavailable'}}
    const source=table==='services'?state.services:table==='service_salons'?state.service_salons:table==='appointments'?state.appointments:table==='appointment_assignments'?state.assignments:[]
    let rows=source.filter(row=>trace.filters.every(([key,op,value])=>op==='in'?value.includes(row[key]):op==='eq'?row[key]===value:op==='gte'?row[key]>=value:row[key]<=value))
    if(trace.operation==='insert') { rows=(Array.isArray(values)?values:[values]).map((row,index)=>({id:id(100+state.writes.length+index),...plain(row)}));source.push(...rows);state.writes.push({table,operation:'insert',values:plain(values)}) }
    if(trace.operation==='update') { rows.forEach(row=>Object.assign(row,plain(values)));state.writes.push({table,operation:'update',values:plain(values)}) }
    if(trace.operation==='delete') { for(const row of rows)source.splice(source.indexOf(row),1);state.writes.push({table,operation:'delete'}) }
    if(trace.limit!==undefined) rows=rows.slice(0,trace.limit)
    rows=rows.map(row=>table==='services'?{...row,service_salons:state.service_salons.filter(link=>link.service_id===row.id).map(link=>({...link,salon:{id:salon,name:'Temple QA'}}))}:{...row})
    return {data:single?rows[0]||null:rows,error:null}
  }
  const filter=(key,op,value)=>{trace.filters.push([key,op,value]);return query}
  const query={select(columns='*'){trace.select=columns;return query},eq:(key,value)=>filter(key,'eq',value),in:(key,value)=>filter(key,'in',value),gte:(key,value)=>filter(key,'gte',value),lte:(key,value)=>filter(key,'lte',value),
    order(){return query},limit(value){trace.limit=value;return query},insert(value){trace.operation='insert';values=value;return query},update(value){trace.operation='update';values=value;return query},delete(){trace.operation='delete';return query},
    single:async()=>execute(true),maybeSingle:async()=>execute(true),then(resolve,reject){return Promise.resolve().then(()=>execute(false)).then(resolve,reject)}}
  return query
}}
const modules=new Map()
function load(relative) {
  if(modules.has(relative)) return modules.get(relative)
  const exports={};modules.set(relative,exports)
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(root,relative),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{
    exports,Date,Intl,Error,URL,console:{log(){},error(){}},
    require(name) {
      if(name==='next/server') return {after(){},NextResponse:{json:(data,init={})=>({data,status:init.status||200})}}
      if(name==='@/lib/supabase/admin') return {createAdminClient:()=>db}
      if(name==='@/lib/auth/jwt') return {verifyToken:token=>token==='local-session'?state.payload:null}
      if(name==='@/lib/appointments/create') return {ClientDataSchema:z.object({}).passthrough(),ClientRequestedStaffIdsSchema:z.array(z.string().uuid()).default([]),clientStaffChoiceIsAssigned:()=>true,createBookableAppointment:async()=>{throw new Error('Creation not used by read-only planning tests')}}
      if(name==='@/lib/client-auth') return {findClientByPhone:async()=>null}
      if(name==='@/lib/salons/resolve') return {isUUID:value=>/^[0-9a-f-]{36}$/i.test(value),resolveSalonGroup:async()=>({salonIds:[salon]})}
      if(name==='@/lib/sync/trigger') return {syncAfterBookingChange(){}}
      if(name.startsWith('@/lib/email/')) return new Proxy({},{get:()=>async()=>{}})
      return name.startsWith('@/')?load(name.slice(2)+'.ts'):require(name)
    },
  },{filename:relative})
  return exports
}
const request=(body={},query='')=>({json:async()=>body,nextUrl:new URL(`http://local.test/api${query}`),cookies:{get:key=>key==='accessToken'?{value:'local-session'}:undefined},headers:new Headers()})
const context={params:Promise.resolve({id:service})}
const createBody=extra=>({salon_ids:[salon],name:'Nouveau soin',duration_minutes:60,price_cents:8000,required_staff_count:1,...extra})
async function main() {
  seed()
  const colors=load('lib/services/planning-colors.ts').SERVICE_PLANNING_COLORS
  const helper=load('lib/services/planning-presentation.ts')
  const routes=load('app/api/services/route.ts'), item=load('app/api/services/[id]/route.ts')
  for(const role of [null,'therapist','assistant','receptionist']) {
    seed({payload:role?{role,staffId:staff}:null})
    assert.equal((await routes.POST(request(createBody({planning_color:'cyan'})))).status,role?403:401)
    assert.equal((await item.PUT(request({planning_color:'cyan'}),context)).status,role?403:401)
    assert.equal(state.writes.length,0)
  }
  for(const invalid of ['red','#ffffff','cyan;display:none',42,{},['cyan']]) {
    seed();assert.equal((await routes.POST(request(createBody({planning_color:invalid})))).status,400);assert.equal(state.writes.length,0)
    assert.equal((await item.PUT(request({planning_color:invalid}),context)).status,400);assert.equal(state.writes.length,0)
  }
  assert.equal(colors.length,12);assert.equal(new Set(colors.map(color=>color.id)).size,12)
  for(const color of colors) {
    seed();const response=await routes.POST(request(createBody({planning_color:color.id})))
    assert.equal(response.status,201);assert.equal(response.data.planning_color,color.id)
  }
  console.log('PASS: twelve closed palette codes are validated by real service routes; invalid colours and unauthorized writers never mutate data')
  seed();let response=await item.PUT(request({planning_color:'fuchsia'}),context)
  assert.equal(response.status,200);assert.equal(state.services[0].planning_color,'fuchsia');assert.equal(state.services[0].price_cents,9000);assert.equal(state.services[0].duration_minutes,60)
  response=await item.PUT(request({description:'Autre information'}),context)
  assert.equal(response.status,200);assert.equal(state.services[0].planning_color,'fuchsia')
  response=await item.PUT(request({planning_color:null}),context)
  assert.equal(response.status,200);assert.equal(state.services[0].planning_color,null)
  seed({missing:true});assert.equal((await routes.POST(request(createBody({planning_color:'cyan'})))).status,503);assert.equal(state.writes.length,0)
  assert.equal((await item.PUT(request({planning_color:null,price_cents:1}),context)).status,503);assert.equal(state.writes.length,0)
  assert.equal((await routes.POST(request(createBody({})))).status,201)
  assert(!Object.hasOwn(state.writes.find(write=>write.table==='services').values[0],'planning_color'))
  seed({missing:true});assert.equal((await item.PUT(request({description:'Ancien schéma compatible'}),context)).status,200)
  assert.equal(state.queries.filter(query=>query.select==='planning_color').length,0)
  console.log('PASS: editing a colour preserves price/duration; omission preserves the existing colour, null clears it, and missing storage fails before any partial write')

  const quote=[{id:service,name:'Nom historique',duration_minutes:60,price_cents:7000,required_staff_count:1},{id:secondary,name:'Second historique',duration_minutes:30,price_cents:2000,required_staff_count:1}]
  const bookings=[{id:id(10),service_id:service,status:'confirmed',service:state.services[0],service_items:quote,payment_status:'paid',amount_paid_cents:9000},
    {id:id(11),service_id:secondary,status:'confirmed',service:{id:secondary,name:'Nom direct'}},
    {id:id(12),service_id:null,status:'confirmed',service_items:[{id:'external-platform-id',name:'Soin externe',duration_minutes:60,price_cents:5000}]},
    {id:id(13),service_id:service,status:'blocked',service:state.services[0]}]
  seed();const original=plain(bookings)
  let enriched=await helper.attachAppointmentPlanningServices(db,bookings)
  assert.deepEqual(plain(bookings),original,'Cosmetic enrichment must not mutate booking snapshots')
  assert.deepEqual(plain(enriched[0].planning_services),[{id:service,name:'Nom historique',planning_color:'tangerine'},{id:secondary,name:'Second historique',planning_color:'cyan'}])
  assert.equal(enriched[0].service_items,bookings[0].service_items)
  assert.deepEqual(plain(enriched[2].planning_services),[{id:'external-platform-id',name:'Soin externe',planning_color:null}])
  assert.deepEqual(plain(enriched[3].planning_services),[])
  const catalog=state.queries.filter(query=>query.select==='id, planning_color')
  assert.equal(catalog.length,1);assert.deepEqual(plain(catalog[0].filters[0][2]),[service,secondary])
  state.services[0].planning_color='orchid'
  enriched=await helper.attachAppointmentPlanningServices(db,bookings)
  assert.equal(enriched[0].planning_services[0].planning_color,'orchid');assert.deepEqual(plain(enriched[0].service_items),quote)
  const presented=load('lib/appointments/service-selection.ts').presentAppointmentServices(enriched[0])
  assert.equal(presented.service.price_cents,9000);assert.equal(presented.service.duration_minutes,90);assert.equal(presented.amount_paid_cents,9000)
  assert.equal(presented.planning_services[0].planning_color,'orchid')
  for(const failure of [{missing:true},{catalogError:true},{catalogThrows:true}]) {
    seed(failure);enriched=await helper.attachAppointmentPlanningServices(db,bookings)
    assert.equal(enriched.length,bookings.length)
    assert(enriched.flatMap(booking=>booking.planning_services).every(service=>service.planning_color===null))
    assert.deepEqual(plain(enriched[0].service_items),quote)
  }
  seed();await helper.attachAppointmentPlanningServices(db,[bookings[2],bookings[3]])
  assert.equal(state.queries.length,0,'External IDs must never be sent to a UUID catalogue lookup')
  console.log('PASS: a single live catalogue batch produces every service star; quote names/prices/durations remain historical, and imports or cosmetic failures cannot hide the planning')

  seed({appointments:[bookings[0],bookings[1],bookings[2]]})
  const appointmentRoute=load('app/api/appointments/route.ts')
  response=await appointmentRoute.GET(request())
  assert.equal(response.status,200);assert.equal(response.data[0].planning_services.length,2)
  assert.equal(response.data[0].service.price_cents,9000);assert.equal(response.data[0].service.duration_minutes,90)
  assert.equal(state.queries.filter(query=>query.select==='id, planning_color').length,1);assert.equal(state.writes.length,0)
  seed({appointments:[bookings[0]],missing:true});response=await appointmentRoute.GET(request())
  assert.equal(response.status,200);assert.equal(response.data[0].planning_services[0].planning_color,null)
  console.log('PASS: the production appointment GET exposes planning_services without modifying the booking or requiring the optional colour column')

  const sql=fs.readFileSync(path.join(root,'database/migrations/20261109011225_service_planning_color.sql'),'utf8')
  const pg=new PGlite()
  await pg.exec('CREATE TABLE public.services(id uuid PRIMARY KEY,name text,price_cents int,duration_minutes int);')
  await pg.query('INSERT INTO public.services VALUES($1,$2,$3,$4)',[service,'Ancien soin',9000,60])
  await pg.exec(sql);await pg.exec(sql)
  assert.equal((await pg.query('SELECT planning_color FROM public.services')).rows[0].planning_color,null)
  for(const color of colors) await pg.query('UPDATE public.services SET planning_color=$1 WHERE id=$2',[color.id,service])
  await assert.rejects(()=>pg.query('UPDATE public.services SET planning_color=$1 WHERE id=$2',['red',service]),error=>error.code==='23514')
  await pg.query('UPDATE public.services SET planning_color=NULL WHERE id=$1',[service])
  assert.deepEqual((await pg.query('SELECT price_cents,duration_minutes FROM public.services')).rows[0],{price_cents:9000,duration_minutes:60})
  await pg.close()
  console.log('PASS: migration is repeatable, historical services stay uncoloured, all twelve codes persist and PostgreSQL rejects arbitrary colours without changing prices or duration')
}
main().catch(error=>{console.error(error);process.exitCode=1})

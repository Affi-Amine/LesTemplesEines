// Production PATCH with an in-memory atomic RPC stub: no database or network.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript')
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`
const version='2026-11-09T10:00:00Z'
let state
function seed(extra={}) { state={role:'admin',directWrites:0,rpcCalls:[],ledger:[],rpcError:null,ambiguous:false,
  booking:{id:id(1),salon_id:id(2),staff_id:id(3),status:'confirmed',payment_status:'partial',payment_method:'gift_card',amount_paid_cents:6500,
    updated_at:version,start_time:'2099-11-02T10:00:00Z',end_time:'2099-11-02T11:00:00Z',assignments:[{staff_id:id(3)},{staff_id:id(4)}],
    service_items:[{price_cents:3500},{price_cents:4500}]},...extra} }
const db={from(table){const query={select(){return query},eq(){return query},single:async()=>({data:{...state.booking},error:null}),
  update(){state.directWrites++;return query},insert(){state.directWrites++;return query},delete(){state.directWrites++;return query}}
  assert.equal(table,'appointments','Encashment must not read or rewrite the team or check scheduling conflicts');return query},
  async rpc(name,payload) {
    state.rpcCalls.push({name,payload});assert.equal(name,'admin_checkout_appointment_atomic')
    assert.deepEqual(Object.keys(payload).sort(),['p_appointment_id','p_expected_updated_at','p_payments'])
    if(state.rpcError)return {data:null,error:state.rpcError}
    if(Date.parse(payload.p_expected_updated_at)!==Date.parse(state.booking.updated_at)||state.booking.payment_status==='paid')return {data:null,error:{code:'PT409',message:'Déjà réglé ou version modifiée'}}
    const total=payload.p_payments.reduce((sum,line)=>sum+line.amount_cents,0)
    assert.equal(total,1500)
    Object.assign(state.booking,{payment_status:'paid',payment_method:'mixed',amount_paid_cents:8000,updated_at:'2026-11-09T10:00:01Z'})
    state.ledger.push(...payload.p_payments)
    if(state.ambiguous)throw new Error('Réponse interrompue après validation')
    return {data:{...state.booking},error:null}
  }}
const exportsObject={}
vm.runInNewContext(ts.transpileModule(fs.readFileSync('app/api/appointments/[id]/route.ts','utf8'),{
  compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022},
}).outputText,{exports:exportsObject,Date,console,require(name){
  if(name==='@/lib/supabase/admin')return {createAdminClient:()=>db}
  if(name==='@/lib/auth/api-auth')return {requireStaffAuth:(_request,roles)=>roles.includes(state.role)?{payload:{role:state.role,staffId:id(3)}}:{response:{status:403}}}
  if(name==='@/lib/appointments/create')return {validateAppointmentScheduling:async()=>{throw new Error('Payment must not revalidate a freely moved overlapping appointment')},assertStaffAvailable:async()=>{throw new Error('No slot check during payment')}}
  if(name==='@/lib/appointments/service-change')return {planServiceChangePayment:()=>{throw new Error('No service change during payment')}}
  if(name==='@/lib/appointments/rules')return {SchedulingError:class extends Error{}}
  if(name==='@/lib/appointments/status')return {blocksAppointmentSchedule:()=>true,canRescheduleAppointmentStatus:()=>true}
  if(name==='@/lib/appointments/service-selection')return {presentAppointmentServices:value=>value}
  if(name==='@/lib/sync/trigger')return {syncAfterBookingChange(){},loadRemoteCopies:async()=>[],cancelRemoteCopiesAfterDelete(){}}
  if(name==='next/server')return {NextResponse:{json:(data,init)=>({data,status:init?.status||200})}}
  return require(name)
}})
const body=extra=>({expected_updated_at:version,payment_status:'paid',payment_method:'card',amount_paid_cents:8000,payments:[{method:'card',amount_cents:1500}],...extra})
const patch=value=>exportsObject.PATCH({json:async()=>value},{params:Promise.resolve({id:id(1)})})
async function main() {
  for(const role of ['admin','manager','receptionist','assistant','therapist']) {
    seed({role});const before=JSON.stringify(state.booking.assignments)
    const response=await patch(body());assert.equal(response.status,200);assert.equal(response.data.amount_paid_cents,8000)
    assert.equal(JSON.stringify(state.booking.assignments),before);assert.equal(state.booking.status,'confirmed');assert.equal(state.directWrites,0)
    assert.equal(state.rpcCalls.length,1);assert.equal(state.ledger.length,1)
  }
  seed({role:'client'});assert.equal((await patch(body())).status,403);assert.equal(state.rpcCalls.length,0)
  seed();assert.equal((await patch(body({expected_updated_at:'2026-11-08T10:00:00Z'}))).status,409);assert.equal(state.rpcCalls.length,0)
  for(const payments of [[],[{method:'card',amount_cents:0}],[{method:'card',amount_cents:-1}],[{method:'card',amount_cents:1.5}],[{method:'mixed',amount_cents:1500}],[{method:'card',amount_cents:Infinity}]]) {
    seed();assert.equal((await patch(body({payments,amount_paid_cents:undefined}))).status,400);assert.equal(state.rpcCalls.length,0);assert.equal(state.directWrites,0)
  }
  seed();assert.equal((await patch(body({status:'in_progress'}))).status,400);assert.equal(state.rpcCalls.length,0)
  seed();assert.equal((await patch(body({payments:undefined,payment_method:'cash'}))).status,200)
  assert.equal(state.rpcCalls[0].payload.p_payments[0].amount_cents,1500,'Legacy cumulative amount becomes only the supplement')
  for(const [code,status] of [['PT409',409],['40001',409],['23514',409],['22023',400],['P0002',404],['42501',403],['PGRST202',503]]) {
    seed({rpcError:{code,message:'Test rollback'}});const response=await patch(body());assert.equal(response.status,status);assert.equal(state.directWrites,0);assert.equal(state.ledger.length,0);assert.equal(state.rpcCalls.length,1)
    if(code==='PT409'||code==='40001')assert.equal(response.data.error,'Test rollback','Business and real serialization conflicts preserve the server explanation')
  }
  seed();assert.equal((await patch(body())).status,200);assert.equal((await patch(body())).status,409);assert.equal(state.ledger.length,1)
  seed({ambiguous:true});assert.equal((await patch(body())).status,500);assert.equal((await patch(body())).status,409);assert.equal(state.ledger.length,1)
  seed();assert.equal((await patch(body({expected_updated_at:undefined}))).status,200)
  assert.equal((await patch(body({expected_updated_at:undefined}))).status,409);assert.equal(state.ledger.length,1)
  console.log('PASS: real payment PATCH preserves five staff roles, uses only the atomic versioned RPC, maps PT409 and genuine 40001 to 409, and rejects stale/double/ambiguous retries without direct writes')
}
main().catch(error=>{console.error(error);process.exitCode=1})

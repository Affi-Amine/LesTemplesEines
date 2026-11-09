// Verify the production PATCH route selects the atomic path without direct partial writes.
const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript'),assert=require('node:assert/strict')
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`
async function scenario(rpcError=null,options={}){
 let rpcCalls=[],directWrites=0,validation,availability
 const existing={id:id(1),salon_id:id(2),service_id:id(3),staff_id:id(4),assignments:[{staff_id:id(4)}],status:options.status||'confirmed',start_time:'2099-11-02T10:00Z',end_time:'2099-11-02T11:30Z',updated_at:'2026-01-01T00:00Z',payment_status:'paid',amount_paid_cents:14000}
 const db={from(table){const q={select(){return q},eq(){return q},in(){return q},single:async()=>({data:existing,error:null}),insert(){directWrites++;return q},update(){directWrites++;return q},delete(){directWrites++;return q},then(resolve){return Promise.resolve({data:table==='staff'?[{id:id(4),is_active:!options.inactiveActor},{id:id(5),is_active:!options.inactiveTarget}]:[],error:null}).then(resolve)}};return q},rpc:async(name,payload)=>{rpcCalls.push({name,payload});return {data:{...existing,...payload.p_updates,staff_id:payload.p_staff_ids[0]},error:rpcError}}}
 const mod={exports:{}}
 vm.runInNewContext(ts.transpileModule(fs.readFileSync('app/api/appointments/[id]/route.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{exports:mod.exports,Date,console,require(name){
  if(name==='@/lib/supabase/admin')return {createAdminClient:()=>db}
  if(name==='@/lib/appointments/create')return {validateAppointmentScheduling:async(_,data)=>{validation=data;return {endTime:new Date(Date.parse(data.start_time)+90*60000).toISOString()}},assertStaffAvailable:async(...args)=>{availability=args.slice(1)}}
  if(name==='@/lib/appointments/rules')return {SchedulingError:class extends Error{}}
  if(name==='@/lib/appointments/service-change')return {planServiceChangePayment:()=>({updates:{}})}
  if(name==='@/lib/appointments/status')return {blocksAppointmentSchedule:status=>!['cancelled','completed','no_show'].includes(status),canRescheduleAppointmentStatus:status=>['confirmed','pending'].includes(status)}
  if(name==='@/lib/appointments/service-selection')return {presentAppointmentServices:value=>value}
  if(name==='@/lib/auth/api-auth')return {requireStaffAuth:()=>({payload:{role:'admin',staffId:id(4)}})}
  // Synchronization runs after the route; this test covers the versioned database write only.
  if(name==='@/lib/sync/trigger')return {syncAfterBookingChange(){},loadRemoteCopies:async()=>[],cancelRemoteCopiesAfterDelete(){}}
  if(name==='next/server')return {NextResponse:{json:(data,init)=>({data,status:init?.status||200})}}
  if(name==='@/lib/sync/trigger')return { syncAfterBookingChange: () => {}, loadRemoteCopies: async () => [], cancelRemoteCopiesAfterDelete: () => {} }
  return require(name)
 }})
 const response=await mod.exports.PATCH({json:async()=>({start_time:'2099-11-02T13:00:00.000Z',staff_ids:[options.sameTeam?id(4):id(5)],staff_id:options.sameTeam?id(4):id(5),expected_updated_at:options.stale?'2026-02-01T00:00Z':existing.updated_at})},{params:Promise.resolve({id:id(1)})})
 if(options.stale || options.inactiveActor || options.inactiveTarget || (options.status && !options.movable)){assert.equal(rpcCalls.length,0);assert.equal(directWrites,0);return response}
 assert.equal(rpcCalls.length,1);assert.equal(directWrites,0);assert.equal(rpcCalls[0].name,'admin_reschedule_appointment_atomic');assert.equal(rpcCalls[0].payload.p_expected_updated_at,existing.updated_at);assert.equal(rpcCalls[0].payload.p_updates.end_time,'2099-11-02T14:30:00.000Z');assert.deepEqual(Array.from(rpcCalls[0].payload.p_staff_ids),[options.sameTeam?id(4):id(5)])
 return Object.assign(response,{availability,validation})
}
async function main(){
 assert.equal((await scenario(null,{inactiveActor:true})).status,403)
 assert.equal((await scenario(null,{inactiveTarget:true})).status,400)
 assert.equal((await scenario(null,{sameTeam:true})).status,200)
 assert.equal((await scenario(null,{stale:true})).status,409)
 for(const status of ['in_progress','completed','cancelled','no_show'])assert.equal((await scenario(null,{status})).status,400)
 const blocked=await scenario(null,{status:'blocked',movable:true});assert.equal(blocked.status,200);assert.equal(blocked.validation,undefined)
 assert.deepEqual(blocked.availability,[[id(5)],'2099-11-02T13:00:00.000Z','2099-11-02T14:30:00.000Z',id(1)])
 assert.equal((await scenario()).status,200)
 assert.equal((await scenario({code:'23P01',message:'Conflict'})).status,409)
 assert.equal((await scenario({code:'40001',message:'Stale'})).status,409)
 assert.equal((await scenario({code:'PGRST202',message:'Missing function'})).status,503)
 console.log('PASS: API rejects inactive actors/destinations, validates and invokes one versioned atomic move; conflicts and missing migration never fall back to partial writes')
}
main().catch(error=>{console.error(error);process.exitCode=1})

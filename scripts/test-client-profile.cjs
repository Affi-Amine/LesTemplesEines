const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), ts = require('typescript')
const root = path.resolve(__dirname, '..'), id = n => `00000000-0000-4000-8000-${String(n).padStart(12,'0')}`
let rows, role, fail, race, writes
function seed() {
  role = 'admin'; fail = null; race = false; writes = 0
  rows = [
    { id:id(1),first_name:'Camille',last_name:'Test',phone:'0600000001',email:'camille@example.test',internal_notes:'Note existante',auth_user_id:id(8),updated_at:'2026-10-25T09:00:00.000Z',visit_count:7,total_spent_cents:45000,loyalty_status:'vip' },
    { id:id(2),first_name:'Autre',last_name:'Client',phone:'+33699999999',email:'OTHER@example.test',updated_at:'2026-10-25T09:00:00.000Z' },
  ]
}
const db = { from(table) {
  assert.equal(table,'clients','Profile correction must never rewrite related tables')
  const filters=[];let values, maximum
  const query={
    select(){return query},eq(k,v){filters.push(r=>r[k]===v);return query},neq(k,v){filters.push(r=>r[k]!==v);return query},
    is(k,v){filters.push(r=>(r[k]??null)===v);return query},in(k,v){filters.push(r=>v.includes(r[k]));return query},
    ilike(k,v){const literal=v.replace(/\\([\\%_])/g,'$1');filters.push(r=>r[k]?.toLowerCase()===literal.toLowerCase());return query},
    limit(n){maximum=n;return query},
    update(v){values=v;if(race){rows[0].updated_at='2026-10-25T10:00:00.000Z';race=false}return query},
    maybeSingle:async()=>execute(true),then(resolve,reject){return Promise.resolve(execute(false)).then(resolve,reject)},
  }
  function execute(single){
    if(fail)return {data:null,error:{code:fail}}
    let found=rows.filter(r=>filters.every(test=>test(r)));if(maximum)found=found.slice(0,maximum)
    if(values){writes+=found.length;found.forEach(r=>Object.assign(r,values))}
    const data=found.map(r=>({...r}));return {data:single?data[0]||null:data,error:null}
  }
  return query
} }
const modules=new Map()
function load(relative){
  if(modules.has(relative))return modules.get(relative).exports
  const mod={exports:{}};modules.set(relative,mod)
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(root,relative),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{
    exports:mod.exports,console:{error(){}},require(name){
      if(name==='@/lib/supabase/admin')return {createAdminClient:()=>db}
      if(name==='@/lib/auth/api-auth')return {requireStaffAuth:(_,roles)=>!role?{response:{status:401}}:!roles.includes(role)?{response:{status:403}}:{payload:{role}}}
      if(name==='next/server')return {NextResponse:{json:(data,init={})=>({data,status:init.status||200,headers:init.headers})}}
      if(name.startsWith('@/'))return load(name.slice(2)+'.ts')
      return require(name)
    },
  })
  return mod.exports
}
async function main(){
  const api=load('app/api/clients/[id]/route.ts')
  const put=(body,clientId=id(1))=>api.PUT({json:async()=>body},{params:Promise.resolve({id:clientId})})
  seed();const original={...rows[0]}
  const saved=await put({first_name:'  Camille corrigée ',last_name:' Martin ',phone:'06 12.34-56-78',email:' CORRECTED@Example.test ',internal_notes:' Nouvelle note ',expected_updated_at:original.updated_at})
  assert.equal(saved.status,200);assert.equal(saved.data.id,original.id);assert.equal(rows.length,2)
  assert.equal(rows[0].first_name,'Camille corrigée');assert.equal(rows[0].phone,'0612345678');assert.equal(rows[0].email,'corrected@example.test')
  for(const key of ['auth_user_id','visit_count','total_spent_cents','loyalty_status'])assert.equal(rows[0][key],original[key])
  assert.equal((await put({email:'',internal_notes:''})).status,200)
  assert.equal(rows[0].email,null);assert.equal(rows[0].internal_notes,null)
  console.log('PASS: corrections normalize contacts, keep the same client/account/statistics, and can clear email/notes')
  seed();let response=await put({phone:'06 99 99 99 99'});assert.equal(response.status,409);assert.equal(writes,0)
  response=await put({email:'other@EXAMPLE.TEST'});assert.equal(response.status,409);assert.equal(writes,0)
  seed();rows[1].email=rows[0].email
  assert.equal((await put({email:rows[0].email,phone:rows[0].phone,internal_notes:'Correction sans changer les coordonnées'})).status,200)
  console.log('PASS: French phone variants and case-insensitive email collisions rejected; unchanged legacy contacts remain editable')
  seed();for(const body of [{first_name:'  '},{phone:'invalid'},{email:'not-an-email'},{auth_user_id:id(9)},{total_spent_cents:0},{id:id(2)},{}])assert.equal((await put(body)).status,400)
  assert.equal(writes,0)
  assert.equal((await put({first_name:'Test'},'invalid-id')).status,400)
  assert.equal((await put({first_name:'Test'},id(99))).status,404)
  for(const [value,status] of [[null,401],['therapist',403]]){role=value;assert.equal((await put({first_name:'Test'})).status,status)}
  assert.equal(writes,0)
  console.log('PASS: unauthorized roles, invalid contact data and attempts to change protected fields cannot update the profile')
  seed();assert.equal((await put({first_name:'Stale',expected_updated_at:'2026-10-24T09:00:00.000Z'})).status,409);assert.equal(writes,0)
  race=true;assert.equal((await put({first_name:'Racing',expected_updated_at:rows[0].updated_at})).status,409);assert.equal(rows[0].first_name,'Camille');assert.equal(writes,0)
  seed();fail='08006';assert.equal((await put({phone:'0612345678'})).status,500);assert.equal(writes,0)
  console.log('PASS: stale forms, concurrent saves and database failures preserve existing profile data')
}
main().catch(error=>{console.error(error);process.exitCode=1})

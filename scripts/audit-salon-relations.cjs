// Read-only audit. No client identities, credentials or payment details exported.
// Run: node --env-file=.env scripts/audit-salon-relations.cjs
const fs = require('node:fs')
const { createClient } = require('@supabase/supabase-js')
const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
const db = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const columns = {
  salons: 'id,name,slug,city,is_active,opening_hours',
  staff: 'id,salon_id,first_name,last_name,role,is_active',
  services: 'id,salon_id,name,is_active,required_staff_count',
  service_salons: 'service_id,salon_id', staff_services: 'staff_id,service_id',
  staff_availability: 'id,staff_id,day_of_week,start_time,end_time,is_recurring,specific_date',
  appointments: 'id,salon_id,staff_id,service_id,start_time,end_time,status',
  appointment_assignments: 'id,appointment_id,staff_id',
}
async function read(table, select) {
  const rows = []
  for (let offset = 0; ; ) {
    const { data, error, count } = await db.from(table).select(select, { count: 'exact' })
      .order(table === 'service_salons' ? 'service_id' : table === 'staff_services' ? 'staff_id' : 'id')
      .order(table === 'service_salons' ? 'salon_id' : table === 'staff_services' ? 'service_id' : 'id')
      .range(offset, offset + 499)
    if (error) throw new Error(`${table}: ${error.message}`)
    rows.push(...data); offset += data.length
    if (offset >= count) return rows
    if (!data.length) throw new Error(`${table}: incomplete pagination`)
  }
}
async function main() {
  const tables = Object.fromEntries(await Promise.all(Object.entries(columns).map(async ([t,c]) => [t, await read(t,c)])))
  const {salons, staff, services, service_salons: links, staff_services: skills, staff_availability: shifts, appointments: apts, appointment_assignments: assigns} = tables
  const sm = new Map(staff.map(x => [x.id,x])), am = new Map(apts.map(x=>[x.id,x]))
  const hasLink = (service, salon) => links.some(x=>x.service_id===service && x.salon_id===salon)
  const active = staff.filter(x=>x.is_active && ['therapist','assistant','manager','admin'].includes(x.role))
  const issues = {
    dirtySlugs: salons.filter(s=>s.slug!==s.slug.trim() || s.slug!==s.slug.toLowerCase()).map(s=>({id:s.id,name:s.name,slug:s.slug})),
    staffWithoutSalon: staff.filter(x=>!salons.some(s=>s.id===x.salon_id)),
    activeStaffWithoutShifts: active.filter(x=>!shifts.some(s=>s.staff_id===x.id)).map(x=>({id:x.id,name:x.last_name,salon_id:x.salon_id})),
    legacyServiceWithoutLink: services.filter(x=>x.salon_id&&!hasLink(x.id,x.salon_id)).map(x=>({id:x.id,name:x.name,salon_id:x.salon_id})),
    skillsOutsideSalon: skills.filter(x=>!hasLink(x.service_id,sm.get(x.staff_id)?.salon_id)),
    primarySalonMismatch: apts.filter(x=>sm.has(x.staff_id)&&sm.get(x.staff_id).salon_id!==x.salon_id),
    secondarySalonMismatch: assigns.filter(x=>am.has(x.appointment_id)&&sm.has(x.staff_id)&&am.get(x.appointment_id).salon_id!==sm.get(x.staff_id).salon_id),
    appointmentServiceOutsideSalon: apts.filter(x=>x.service_id&&!hasLink(x.service_id,x.salon_id)),
    primaryMissingFromAssignments: apts.filter(x=>x.staff_id&&!assigns.some(y=>y.appointment_id===x.id&&y.staff_id===x.staff_id)),
    staffCountMismatch: apts.filter(x=>x.service_id&&x.status!=='blocked').filter(x=>{
      const ids=new Set([x.staff_id,...assigns.filter(y=>y.appointment_id===x.id).map(y=>y.staff_id)].filter(Boolean))
      return ids.size!==(services.find(s=>s.id===x.service_id)?.required_staff_count||1)
    }),
  }
  const result={checkedAt:new Date().toISOString(), scope:'Supabase configured locally; no deployment identity verification; read-only, non-transactional snapshot', counts:Object.fromEntries(Object.entries(tables).map(([k,v])=>[k,v.length])),salons:salons.map(s=>({ ...s,activeStaff:active.filter(x=>x.salon_id===s.id).map(x=>({id:x.id,name:x.last_name,role:x.role,shiftCount:shifts.filter(a=>a.staff_id===x.id).length})),activeServices:services.filter(x=>x.is_active&&hasLink(x.id,s.id)).length})), issueCounts:Object.fromEntries(Object.entries(issues).map(([k,v])=>[k,v.length])),issues}
  fs.mkdirSync('docs/audits',{recursive:true})
  fs.writeFileSync('docs/audits/salon-relations-data.json',JSON.stringify(result,null,2)+'\n')
  console.log(JSON.stringify({counts:result.counts,issueCounts:result.issueCounts,salons:result.salons.map(({opening_hours,...s})=>s)},null,2))
}
main().catch(e=>{console.error(e.message);process.exitCode=1})

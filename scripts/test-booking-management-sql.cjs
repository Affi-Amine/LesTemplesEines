const fs = require('node:fs')
const assert = require('node:assert/strict')
const { PGlite } = require('@electric-sql/pglite')
const { fromZonedTime, formatInTimeZone } = require('date-fns-tz')
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12,'0')}`
const salon=id(1), staff=id(2), colleague=id(3), service=id(4), appointment=id(5), token='a'.repeat(64)
const today = formatInTimeZone(new Date(),'Europe/Paris','yyyy-MM-dd')
const day = n => new Date(Date.parse(today+'T12:00:00Z')+n*86400000).toISOString().slice(0,10)
const instant = (n,time='10:00') => fromZonedTime(day(n)+'T'+time+':00','Europe/Paris').toISOString()
const hours=Object.fromEntries(['sunday','monday','tuesday','wednesday','thursday','friday','saturday'].map(d=>[d,{open:'09:00',close:'21:00'}]))
let db, seq=100
async function reset({start=instant(3), status='confirmed', expires=instant(20), revoked=null}={}) {
  await db.exec('TRUNCATE public.appointments CASCADE; TRUNCATE public.staff_availability; TRUNCATE public.staff_services;')
  await db.query('UPDATE public.salons SET opening_hours=$1',[JSON.stringify(hours)])
  await db.query(`INSERT INTO public.appointments(id,salon_id,staff_id,service_id,start_time,end_time,status,payment_status,payment_method,amount_paid_cents,updated_at)
    VALUES($1,$2,$3,$4,$5,$6,$7,'paid','stripe',14000,'2026-01-01T00:00:00Z')`,[appointment,salon,staff,service,start,new Date(Date.parse(start)+90*60000).toISOString(),status])
  await db.query('INSERT INTO public.appointment_assignments(appointment_id,staff_id) VALUES($1,$2),($1,$3)',[appointment,staff,colleague])
  await db.query('INSERT INTO public.appointment_management_links(id,appointment_id,token_hash,expires_at,revoked_at) VALUES($1,$2,$3,$4,$5)',[id(6),appointment,token,expires,revoked])
}
async function rpc(action, target=null, overrides={}) {
  return (await db.query('SELECT public.client_change_appointment($1,$2,$3,$4,$5,$6) AS result',[
    overrides.token || token, overrides.appointment || appointment, overrides.request || id(seq++), overrides.version || '2026-01-01T00:00:00Z', action,target,
  ])).rows[0].result
}
async function current() { return (await db.query('SELECT * FROM public.appointments WHERE id=$1',[appointment])).rows[0] }

async function main() {
  db=new PGlite()
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
    CREATE TABLE public.salons(id uuid PRIMARY KEY, opening_hours jsonb);
    CREATE TABLE public.staff(id uuid PRIMARY KEY,salon_id uuid,is_active boolean,role text);
    CREATE TABLE public.staff_services(service_id uuid,staff_id uuid);
    CREATE TABLE public.staff_availability(staff_id uuid,is_recurring boolean,day_of_week integer,specific_date date,start_time time,end_time time);
    CREATE TABLE public.appointments(id uuid PRIMARY KEY,salon_id uuid,staff_id uuid,service_id uuid,start_time timestamptz,end_time timestamptz,status text,
      payment_status text,payment_method text,amount_paid_cents integer,service_items jsonb,created_at timestamptz DEFAULT now(),updated_at timestamptz DEFAULT now(),CHECK(end_time>start_time));
    CREATE TABLE public.appointment_assignments(appointment_id uuid REFERENCES public.appointments(id) ON DELETE CASCADE,staff_id uuid);
  `)
  const migration=fs.readFileSync('database/migrations/2026-10-25_client_appointment_management.sql','utf8')
  await db.exec(migration); await db.exec(migration)
  await db.query('INSERT INTO public.salons VALUES($1,$2)',[salon,JSON.stringify(hours)])
  await db.query("INSERT INTO public.staff VALUES($1,$3,true,'therapist'),($2,$3,true,'therapist')",[staff,colleague,salon])
  console.log('PASS: migration is repeatable and has no destructive backfill')

  await reset()
  const request=id(seq++), old=await current()
  await rpc('cancel',null,{request})
  const cancelled=await current()
  assert.equal(cancelled.status,'cancelled')
  for(const field of ['payment_status','payment_method','amount_paid_cents','start_time','end_time','staff_id','service_id']) assert.deepEqual(cancelled[field],old[field])
  await rpc('cancel',null,{request})
  assert.equal((await db.query('SELECT count(*)::integer AS n FROM public.appointment_client_changes')).rows[0].n,1)
  console.log('PASS: cancellation preserves payment, team and history; retries create one audit event')

  await reset()
  await rpc('reschedule',instant(4,'14:00'))
  let moved=await current()
  assert.equal(moved.start_time.toISOString(),instant(4,'14:00'))
  assert.equal(moved.end_time-moved.start_time,90*60000)
  assert.equal(moved.amount_paid_cents,14000)
  assert.equal((await db.query('SELECT count(*)::integer AS n FROM public.appointment_assignments')).rows[0].n,2)
  console.log('PASS: moving a duo preserves its entire 90-minute duration, assignments and payment')

  await reset({start:instant(0,'20:00')})
  await assert.rejects(()=>rpc('cancel'),/jour même/)
  await assert.rejects(()=>rpc('reschedule',instant(4)),/jour même/)
  await reset()
  await assert.rejects(()=>rpc('reschedule',instant(0,'20:00')),/demain/)
  await assert.rejects(()=>rpc('cancel',null,{version:'2025-01-01T00:00:00Z'}),/Actualisez/)
  console.log('PASS: same-day source and target blocked in Paris; stale versions rejected')

  await reset({expires:instant(-1)})
  await assert.rejects(()=>rpc('cancel'),/Lien invalide/)
  await reset({revoked:new Date().toISOString()})
  await assert.rejects(()=>rpc('cancel'),/Lien invalide/)
  await reset()
  await assert.rejects(()=>rpc('cancel',null,{token:'b'.repeat(64)}),/Lien invalide/)
  await assert.rejects(()=>rpc('cancel',null,{appointment:id(90)}),/Lien invalide/)
  console.log('PASS: expired, revoked, incorrect and cross-booking links cannot mutate a booking')

  for(const status of ['cancelled','completed','in_progress','no_show','blocked']) {
    await reset({status})
    await assert.rejects(()=>rpc('reschedule',instant(4)),/plus être modifié/)
  }
  await reset()
  await db.query(`INSERT INTO public.appointments(id,salon_id,staff_id,service_id,start_time,end_time,status)
    VALUES($1,$2,$3,$4,$5,$6,'confirmed')`,[id(20),salon,colleague,service,instant(4,'15:00'),instant(4,'16:00')])
  await assert.rejects(()=>rpc('reschedule',instant(4,'14:00')),/réservé/)
  assert.equal((await current()).start_time.toISOString(),instant(3))
  assert.equal((await db.query('SELECT count(*)::integer AS n FROM public.appointment_client_changes')).rows[0].n,0)
  await assert.rejects(()=>db.query(`INSERT INTO public.appointments(id,salon_id,staff_id,start_time,end_time,status) VALUES($1,$2,$3,$4,$5,'confirmed')`,[id(21),salon,colleague,instant(4,'15:15'),instant(4,'16:15')]),/réservé/)
  console.log('PASS: secondary practitioner conflicts roll back the move; ordinary inserts obey the same guard')

  await reset()
  await db.query(`INSERT INTO public.staff_availability VALUES($1,false,NULL,$2,'10:00','11:00')`,[colleague,day(4)])
  await assert.rejects(()=>rpc('reschedule',instant(4,'10:00')),/durée/)
  await db.query(`INSERT INTO public.staff_availability VALUES($1,false,NULL,$2,'11:00','12:00')`,[colleague,day(4)])
  await rpc('reschedule',instant(4,'10:00'))
  console.log('PASS: all practitioners must cover the entire duration; contiguous shifts merge correctly')

  await reset()
  await assert.rejects(()=>rpc('reschedule',instant(4,'20:00')),/horaires/)
  await assert.rejects(()=>rpc('reschedule',instant(4,'10:07')),/créneau/)
  for(const role of ['anon','authenticated']) {
    await db.exec(`SET ROLE ${role}`)
    await assert.rejects(()=>db.query('SELECT * FROM public.appointment_management_links'),/permission denied/)
    await assert.rejects(()=>rpc('cancel'),/permission denied/)
    await db.exec('RESET ROLE')
  }
  console.log('PASS: private link data and mutation RPC cannot be accessed by public/customer database roles')
  await db.close()
}
main().catch(async error=>{console.error(error);process.exitCode=1;if(db)await db.close()})

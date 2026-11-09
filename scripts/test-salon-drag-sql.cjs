const fs = require('node:fs')
const assert = require('node:assert/strict')
const { PGlite } = require('@electric-sql/pglite')

const migration = 'database/migrations/20261109003751_salon_drag_appointment_atomic.sql'
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const [salon, otherSalon, service, client, a, b, c, outsider, inactive, admin, manager, receptionist, therapist, inactiveAdmin, otherManager] = [1,2,3,4,10,11,12,13,14,20,21,22,23,24,25].map(id)
const booking = id(100), request = id(500)
const oldStart = '2099-11-02T10:00:00Z', oldEnd = '2099-11-02T11:30:00Z', version = '2026-01-01T00:00:00Z'
const target = '2099-11-02T13:00:00Z', targetEnd = '2099-11-02T14:30:00Z'
let db, counter = 200

async function role(name, run) {
  await db.exec(`SET ROLE ${name}`)
  try { return await run() } finally { await db.exec('RESET ROLE') }
}
async function seed({ team = [a], status = 'confirmed' } = {}) {
  await db.exec('TRUNCATE public.appointments,public.activity_logs,public.staff_services,public.staff_availability RESTART IDENTITY CASCADE')
  await db.query(`INSERT INTO public.appointments(id,salon_id,service_id,client_id,staff_id,start_time,end_time,status,payment_status,payment_method,amount_paid_cents,paid_at,updated_at,client_notes,internal_notes,service_items)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,'paid','stripe',14000,'2026-01-01T00:00Z',$9,'Client note','Internal note',$10)`,
    [booking,salon,service,client,team[0],oldStart,oldEnd,status,version,JSON.stringify([{ id:service, name:'Massage historique', price_cents:14000, duration_minutes:90 }])])
  for (const member of team) await db.query('INSERT INTO public.appointment_assignments VALUES($1,$2)', [booking,member])
  await db.query(`INSERT INTO public.payments(appointment_id,amount_cents,method) VALUES($1,14000,'stripe')`, [booking])
}
async function extra(member, start = target, end = targetEnd, status = 'confirmed') {
  const other = id(counter++)
  await db.query(`INSERT INTO public.appointments(id,salon_id,service_id,client_id,staff_id,start_time,end_time,status,updated_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [other,salon,service,client,member,start,end,status,version])
  return other
}
async function snapshot() {
  return (await db.query(`SELECT to_jsonb(a) AS booking,
    (SELECT jsonb_agg(x ORDER BY staff_id) FROM public.appointment_assignments x WHERE x.appointment_id=a.id) AS team,
    (SELECT jsonb_agg(p ORDER BY id) FROM public.payments p WHERE p.appointment_id=a.id) AS payments,
    (SELECT count(*)::int FROM public.activity_logs) AS logs FROM public.appointments a WHERE id=$1`, [booking])).rows[0]
}
async function rawMove({ salonId = salon, appointmentId = booking, expected = version, start = target, team = [b], actor = admin, requestId = request } = {}) {
  return (await db.query('SELECT public.salon_drag_appointment_atomic($1,$2,$3,$4,$5,$6,$7) AS result',
    [salonId,appointmentId,expected,start,team,actor,requestId])).rows[0].result
}
const move = options => role('service_role', () => rawMove(options))
async function strictMove({ expected, start = target, team = [b] } = {}) {
  return (await db.query('SELECT public.admin_reschedule_appointment_atomic($1,$2,$3,$4,$5) AS result',
    [booking,expected,JSON.stringify({ start_time:start,end_time:new Date(Date.parse(start)+90*60000).toISOString() }),team,'[]'])).rows[0].result
}
async function expectRejected(run, code) { await assert.rejects(run, error => error.code === code) }
async function rejectedWithoutMutation(options, code) {
  const before = await snapshot()
  await expectRejected(() => move(options), code)
  assert.deepEqual(await snapshot(), before)
}
async function config() {
  return (await db.query(`SELECT current_setting('les_temples.salon_drag_appointment_id',true) AS value`)).rows[0].value || ''
}
async function bootstrap() {
  db = new PGlite()
  await db.exec(`
    CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
    CREATE TABLE public.salons(id uuid PRIMARY KEY,name text,city text,address text,opening_hours jsonb DEFAULT '{}');
    CREATE TABLE public.services(id uuid PRIMARY KEY,name text,duration_minutes int,price_cents int,required_staff_count int DEFAULT 1);
    CREATE TABLE public.clients(id uuid PRIMARY KEY,first_name text,last_name text);
    CREATE TABLE public.staff(id uuid PRIMARY KEY,salon_id uuid REFERENCES public.salons,first_name text,last_name text,role text,phone text,password_hash text,is_active boolean DEFAULT true);
    CREATE TABLE public.appointments(id uuid PRIMARY KEY,salon_id uuid REFERENCES public.salons,service_id uuid REFERENCES public.services,client_id uuid REFERENCES public.clients,staff_id uuid REFERENCES public.staff,start_time timestamptz,end_time timestamptz,status text,payment_status text,payment_method text,amount_paid_cents int,paid_at timestamptz,client_notes text,internal_notes text,service_items jsonb,updated_at timestamptz,CHECK(end_time>start_time));
    CREATE TABLE public.appointment_assignments(appointment_id uuid REFERENCES public.appointments ON DELETE CASCADE,staff_id uuid REFERENCES public.staff,PRIMARY KEY(appointment_id,staff_id));
    CREATE TABLE public.payments(id serial PRIMARY KEY,appointment_id uuid REFERENCES public.appointments ON DELETE CASCADE,amount_cents int CHECK(amount_cents>0),method text);
    CREATE TABLE public.staff_services(staff_id uuid REFERENCES public.staff,service_id uuid REFERENCES public.services);
    CREATE TABLE public.staff_availability(staff_id uuid REFERENCES public.staff,is_recurring boolean,day_of_week int,specific_date date,start_time time,end_time time);
    GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA public TO service_role,authenticated;
    GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO service_role,authenticated;
  `)
  const guards = fs.readFileSync('database/migrations/2026-10-25_client_appointment_management.sql','utf8')
  await db.exec(guards.slice(guards.indexOf('CREATE OR REPLACE FUNCTION public.guard_appointment_interval()'), guards.indexOf('CREATE OR REPLACE FUNCTION public.client_change_appointment(')))
  await db.exec(fs.readFileSync('database/migrations/20261028231017_admin_reschedule_appointment_atomic.sql','utf8'))
  const sql = fs.readFileSync(migration,'utf8')
  await db.exec(sql)
  const initialLog = (await db.query(`INSERT INTO public.activity_logs(action_type,entity_type,changes)
    VALUES('migration_existing_log','appointment','{}') RETURNING id,created_at`)).rows[0]
  assert(initialLog.id && initialLog.created_at)
  await db.exec(sql)
  assert.equal((await db.query('SELECT count(*)::int AS count FROM public.activity_logs WHERE id=$1',[initialLog.id])).rows[0].count,1)
  const journalAccess = (await db.query(`SELECT relrowsecurity AS rls,
    has_table_privilege('service_role','public.activity_logs','SELECT') AS server_read,
    has_table_privilege('service_role','public.activity_logs','INSERT') AS server_write,
    has_table_privilege('anon','public.activity_logs','SELECT') AS public_read,
    has_table_privilege('authenticated','public.activity_logs','SELECT') AS client_read
    FROM pg_class WHERE oid='public.activity_logs'::regclass`)).rows[0]
  assert.deepEqual(journalAccess,{rls:true,server_read:true,server_write:true,public_read:false,client_read:false})
  console.log('PASS: migration creates a missing journal, generates IDs and dates, preserves existing logs on replay and reserves access to the server')
  for (const key of [salon,otherSalon]) await db.query(`INSERT INTO public.salons(id,name,city,address) VALUES($1,'Temple','Paris','Test')`,[key])
  await db.query(`INSERT INTO public.services VALUES($1,'Massage',60,14000,1)`,[service])
  await db.query(`INSERT INTO public.clients VALUES($1,'Camille','Test')`,[client])
  for (const [key,name,staffRole,salonId,active] of [
    [a,'Alice','therapist',salon,true], [b,'Béa','therapist',salon,true], [c,'Chloé','assistant',salon,true],
    [outsider,'Autre','therapist',otherSalon,true], [inactive,'Inactive','therapist',salon,false],
    [admin,'Admin','admin',otherSalon,true], [manager,'Manager','manager',salon,true],
    [receptionist,'Réception','receptionist',salon,true], [therapist,'Thérapeute','therapist',salon,true],
    [inactiveAdmin,'Admin inactif','admin',salon,false], [otherManager,'Autre manager','manager',otherSalon,true],
  ]) await db.query(`INSERT INTO public.staff VALUES($1,$2,$3,'Test',$4,'0601020304','PRIVATE',$5)`,[key,salonId,name,staffRole,active])
}

async function main() {
  await bootstrap()
  await seed(); await extra(b)
  const before = await snapshot()
  const first = await move()
  const after = await snapshot()
  assert.equal(first.appointment.staff_id,b)
  assert.equal(Date.parse(first.appointment.end_time)-Date.parse(first.appointment.start_time),90*60000)
  for (const field of ['salon_id','service_id','client_id','status','payment_status','payment_method','amount_paid_cents','paid_at','client_notes','internal_notes','service_items']) assert.deepEqual(after.booking[field],before.booking[field],field)
  assert.deepEqual(after.payments,before.payments)
  assert.equal(after.logs,1)
  assert.equal(first.change.changes.actor.name,'Admin Test')
  assert.equal(first.change.changes.client.name,'Camille Test')
  assert.equal(first.change.changes.service.name,'Massage')
  assert.equal(first.change.changes.before.staff[0].name,'Alice Test')
  assert.equal(first.change.changes.after.staff[0].name,'Béa Test')
  assert.deepEqual(first.change.changes.overrides,['overlap'])
  assert.equal(JSON.stringify(first).includes('PRIVATE'),false)
  assert.equal(await config(),'')
  console.log('PASS: salon-only forced overlap atomically preserves duration, payment and service; server journal contains names and actual overrides')

  const replay = await move()
  assert.equal(replay.replayed,true)
  assert.equal(replay.change.id,first.change.id)
  assert.deepEqual(await snapshot(),after)
  await rejectedWithoutMutation({ start:'2099-11-02T13:15:00Z' },'40001')
  await rejectedWithoutMutation({ requestId:id(501) },'40001')
  console.log('PASS: retries are idempotent; reused request with different input and stale versions cannot write another change')

  await role('service_role',async () => {
    await db.exec('BEGIN')
    try {
      assert.equal(await config(),'')
      await db.exec('SAVEPOINT normal_insert')
      await expectRejected(() => extra(b),'23P01')
      await db.exec('ROLLBACK TO SAVEPOINT normal_insert')
      await db.exec('SAVEPOINT normal_update')
      await expectRejected(() => db.query(`UPDATE public.appointments SET start_time='2099-11-02T13:15Z',end_time='2099-11-02T14:45Z' WHERE id=$1`,[booking]),'23P01')
      await db.exec('ROLLBACK TO SAVEPOINT normal_update')
      await db.exec('SAVEPOINT strict_rpc')
      await expectRejected(() => strictMove({ expected:after.booking.updated_at,start:'2099-11-02T13:15Z' }),'23P01')
      await db.exec('ROLLBACK TO SAVEPOINT strict_rpc')
      assert.equal(await config(),'')
      await db.exec('COMMIT')
    } catch (error) { await db.exec('ROLLBACK'); throw error }
  })
  assert.deepEqual(await snapshot(),after)
  console.log('PASS: ordinary INSERT, UPDATE and strict RPC still reject conflicts after a forced move')

  await seed(); await extra(b)
  await role('service_role',async () => {
    await db.exec('BEGIN')
    try {
      await rawMove()
      assert.equal(await config(),'')
      await db.exec('SAVEPOINT normal_after_override')
      await expectRejected(() => extra(b),'23P01')
      await db.exec('ROLLBACK TO SAVEPOINT normal_after_override')
      await db.exec('SAVEPOINT update_after_override')
      await expectRejected(() => db.query(`UPDATE public.appointments SET start_time='2099-11-02T13:15Z',end_time='2099-11-02T14:45Z' WHERE id=$1`,[booking]),'23P01')
      await db.exec('ROLLBACK TO SAVEPOINT update_after_override')
      const freshVersion = (await db.query('SELECT updated_at FROM public.appointments WHERE id=$1',[booking])).rows[0].updated_at
      await db.exec('SAVEPOINT strict_after_override')
      await expectRejected(() => strictMove({ expected:freshVersion,start:'2099-11-02T13:15Z' }),'23P01')
      await db.exec('ROLLBACK TO SAVEPOINT strict_after_override')
      const unrelated = await extra(c)
      await db.exec('SAVEPOINT assignment_after_override')
      await expectRejected(() => db.query('INSERT INTO public.appointment_assignments VALUES($1,$2)',[unrelated,b]),'23P01')
      await db.exec('ROLLBACK TO SAVEPOINT assignment_after_override')
      assert.equal(await config(),'')
      await db.exec('COMMIT')
    } catch (error) { await db.exec('ROLLBACK'); throw error }
  })
  console.log('PASS: override is cleared before returning, including subsequent writes inside the very same transaction')

  await seed()
  await role('service_role',async () => {
    await db.query(`SELECT set_config('les_temples.salon_drag_appointment_id','previous-context-sentinel',false)`)
    await rawMove()
    assert.equal(await config(),'previous-context-sentinel')
    await db.query(`SELECT set_config('les_temples.salon_drag_appointment_id','',false)`)
  })
  console.log('PASS: successful move restores its caller’s previous transaction context')

  await seed(); await extra(b)
  for (const name of ['anon','authenticated']) await role(name,() => expectRejected(() => rawMove(),'42501'))
  await expectRejected(() => rawMove(),'42501')
  await role('authenticated',async () => {
    await db.query(`SELECT set_config('les_temples.salon_drag_appointment_id',$1,false)`,[booking])
    await expectRejected(() => db.query(`UPDATE public.appointments SET start_time=$2,end_time=$3,staff_id=$4 WHERE id=$1`,[booking,target,targetEnd,b]),'23P01')
    await db.query(`SELECT set_config('les_temples.salon_drag_appointment_id','',false)`)
  })
  console.log('PASS: invoker RPC is service-role-only and a spoofed client GUC cannot bypass the definer guards')

  for (const options of [
    { actor:therapist }, { actor:inactiveAdmin }, { actor:otherManager }, { actor:id(999) },
    { salonId:otherSalon },
  ]) await rejectedWithoutMutation(options,'42501')
  for (const options of [
    { team:[outsider] }, { team:[inactive] }, { team:[id(999)] }, { team:[b,b] },
    { team:[] }, { team:[b,c] }, { team:[null] }, { expected:null }, { start:'2099-11-02T13:07Z' },
  ]) await rejectedWithoutMutation(options,'22023')
  await rejectedWithoutMutation({ appointmentId:id(998) },'P0002')
  for (const actor of [manager,receptionist]) { await seed(); await move({ actor }); assert.equal((await snapshot()).logs,1) }
  console.log('PASS: active front-desk roles and salon scope enforced; invalid IDs, members, cardinality, time and versions fail before mutation')

  await seed({team:[a,b]}); await extra(a); await extra(b)
  await rejectedWithoutMutation({team:[a]},'22023')
  await rejectedWithoutMutation({team:[a,c]},'22023')
  const duo = await move({team:[b,a]})
  assert.equal(duo.appointment.staff_id,a)
  assert.deepEqual(duo.change.changes.after.staff_ids,[a,b])
  assert.equal(duo.appointment.assignments.length,2)
  assert.deepEqual(duo.change.changes.overrides,['overlap'])
  console.log('PASS: duo keeps both original practitioners and primary member, even when both final columns overlap')

  await seed()
  const historicalStart = '2000-01-01T23:00:00Z', historicalEnd = '2000-01-02T00:30:00Z'
  await extra(b,historicalStart,historicalEnd)
  await db.query('INSERT INTO public.staff_services VALUES($1,$2)',[a,service])
  await db.query(`INSERT INTO public.staff_availability VALUES($1,true,0,NULL,'09:00','17:00')`,[b])
  const historical = await move({start:historicalStart})
  for (const warning of ['past_time','overlap','opening_hours','qualification','availability']) assert(historical.change.changes.overrides.includes(warning),warning)
  assert.equal(historical.appointment.payment_status,'paid')
  for (const status of ['in_progress','completed','blocked','cancelled','no_show']) {
    await seed({status})
    const moved = await move()
    assert.equal(moved.appointment.status,status)
  }
  console.log('PASS: manual historical/out-of-hours/unqualified/unavailable moves are recorded accurately while keeping status and money intact')

  await seed(); await extra(b)
  const beforeLogFailure = await snapshot()
  await db.exec(`CREATE FUNCTION public.fail_salon_move_log() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Journal indisponible'; END $$;
    CREATE TRIGGER fail_salon_move_log BEFORE INSERT ON public.activity_logs FOR EACH ROW EXECUTE FUNCTION public.fail_salon_move_log()`)
  await role('service_role',async () => {
    await db.query(`SELECT set_config('les_temples.salon_drag_appointment_id','previous-context-sentinel',false)`)
    await db.exec('BEGIN; SAVEPOINT failed_move')
    try {
      await expectRejected(() => rawMove(),'P0001')
      await db.exec('ROLLBACK TO SAVEPOINT failed_move')
      assert.equal(await config(),'previous-context-sentinel')
      await db.exec('SAVEPOINT normal_after_failure')
      await expectRejected(() => extra(b),'23P01')
      await db.exec('ROLLBACK TO SAVEPOINT normal_after_failure')
      await db.exec('COMMIT')
    } catch (error) { await db.exec('ROLLBACK'); throw error }
    await db.query(`SELECT set_config('les_temples.salon_drag_appointment_id','',false)`)
  })
  assert.deepEqual(await snapshot(),beforeLogFailure)
  await db.exec('DROP TRIGGER fail_salon_move_log ON public.activity_logs; DROP FUNCTION public.fail_salon_move_log()')
  console.log('PASS: log insertion failure rolls back appointment, complete team and context; failed override cannot leak')

  await seed(); const change = await move()
  await db.query('DELETE FROM public.appointments WHERE id=$1',[booking])
  assert.equal((await db.query('SELECT changes FROM public.activity_logs WHERE id=$1',[change.change.id])).rows[0].changes.client.name,'Camille Test')
  assert.equal((await db.query(`SELECT relrowsecurity FROM pg_class WHERE oid='public.activity_logs'::regclass`)).rows[0].relrowsecurity,true)
  console.log('PASS: history retains its snapshots after appointment deletion, with RLS enabled')
  await db.close()
}

main().catch(error => { console.error(error); process.exitCode=1 })

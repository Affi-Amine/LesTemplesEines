// Runs the actual production migration against an isolated PostgreSQL engine.
// Does not read .env, use the network, or write production data.
const assert = require('node:assert/strict')
const fs = require('node:fs')
const { PGlite } = require('@electric-sql/pglite')
const uuid = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`

async function main() {
  const db = new PGlite()
  try {
    await db.exec(`
      CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
      CREATE TABLE salons (id uuid PRIMARY KEY, slug text UNIQUE, is_active boolean, opening_hours jsonb);
      CREATE TABLE services (id uuid PRIMARY KEY, is_active boolean, required_staff_count integer);
      CREATE TABLE staff (id uuid PRIMARY KEY, salon_id uuid REFERENCES salons, is_active boolean, role text);
      CREATE TABLE service_salons (service_id uuid REFERENCES services, salon_id uuid REFERENCES salons, PRIMARY KEY(service_id,salon_id));
      CREATE TABLE staff_services (staff_id uuid REFERENCES staff, service_id uuid REFERENCES services);
      CREATE TABLE staff_availability (id uuid DEFAULT gen_random_uuid(), staff_id uuid REFERENCES staff,
        is_recurring boolean, day_of_week integer, specific_date date, start_time time, end_time time);
      CREATE TABLE appointments (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), salon_id uuid REFERENCES salons,
        staff_id uuid REFERENCES staff, service_id uuid REFERENCES services, client_id uuid,
        start_time timestamptz, end_time timestamptz CHECK(end_time>start_time), status text,
        client_notes text, internal_notes text, payment_status text, payment_method text, amount_paid_cents integer,
        paid_at timestamptz, stripe_checkout_session_id text, stripe_payment_intent_id text,
        created_at timestamptz, updated_at timestamptz);
      CREATE TABLE appointment_assignments (id uuid DEFAULT gen_random_uuid(), appointment_id uuid REFERENCES appointments ON DELETE CASCADE,
        staff_id uuid REFERENCES staff, UNIQUE(appointment_id,staff_id));
      GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
      GRANT INSERT, UPDATE, DELETE ON appointments, appointment_assignments TO anon, authenticated;
    `)
    await db.exec(fs.readFileSync('supabase/migrations/20261024115214_salon_booking_integrity.sql','utf8'))
    const hours = Object.fromEntries(['sunday','monday','tuesday','wednesday','thursday','friday','saturday'].map(d=>[d,{open:'09:00',close:'19:00'}]))
    for(const id of [uuid(1),uuid(2)]) await db.query('INSERT INTO salons VALUES ($1,$2,true,$3)',[id,`temple-${id}`,hours])
    await db.query('INSERT INTO services VALUES ($1,true,1),($2,true,2)',[uuid(10),uuid(11)])
    for(const id of [uuid(10),uuid(11)]) await db.query('INSERT INTO service_salons VALUES ($1,$2)',[id,uuid(1)])
    await db.query(`INSERT INTO staff VALUES ($1,$4,true,'therapist'),($2,$4,true,'therapist'),($3,$5,true,'therapist')`,[uuid(20),uuid(21),uuid(22),uuid(1),uuid(2)])
    const input = (overrides={}) => ({salon_id:uuid(1),client_id:uuid(90),service_id:uuid(10),staff_id:uuid(20),
      start_time:'2099-11-02T10:00:00Z',end_time:'2099-11-02T11:00:00Z',status:'confirmed',...overrides})
    const save = async (data, staff=[uuid(20)], id=null) => (await db.query(
      'SELECT public.save_appointment_schedule($1::jsonb,$2::uuid[],$3::uuid) id',[data,staff,id])).rows[0].id
    const count = async table => Number((await db.query(`SELECT count(*) n FROM ${table}`)).rows[0].n)
    const reject = (fn,code) => assert.rejects(fn,e=>e.code===code)

    await reject(()=>save(input({staff_id:uuid(22)}),[uuid(22)]),'23514')
    await reject(()=>save(input({staff_id:uuid(21)}),[uuid(20)]),'23514')
    assert.equal(await count('appointments'),0)
    console.log('PASS SQL: foreign salon and inconsistent principal rejected without inserts')

    const id = await save(input())
    assert.equal(await count('appointments'),1)
    assert.equal(await count('appointment_assignments'),1)
    await reject(()=>db.query('UPDATE staff SET salon_id=$1 WHERE id=$2',[uuid(2),uuid(20)]),'23514')
    await reject(()=>db.query('UPDATE staff SET is_active=false WHERE id=$1',[uuid(20)]),'23514')
    await reject(()=>save(input()),'23P01')
    assert.equal(await count('appointments'),1)
    console.log('PASS SQL: conflicting booking refused, original booking and assignments preserved')
    console.log('PASS SQL: future bookings prevent silent staff transfer/deactivation')

    await save({status:'cancelled'},null,id)
    assert.equal(await count('appointment_assignments'),1)
    const replacement = await save(input())
    await reject(()=>save({status:'confirmed'},null,id),'23P01')
    await save({status:'cancelled'},null,replacement)
    console.log('PASS SQL: cancellation releases time, retains history, conflicting reactivation refused')

    await db.exec(`CREATE FUNCTION fail_secondary() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
      IF NEW.staff_id='${uuid(21)}'::uuid THEN RAISE EXCEPTION 'simulated assignment failure'; END IF; RETURN NEW; END $$;
      CREATE TRIGGER simulate_failure BEFORE INSERT ON appointment_assignments FOR EACH ROW EXECUTE FUNCTION fail_secondary();`)
    const before = await count('appointments')
    await assert.rejects(()=>save(input({service_id:uuid(11)}),[uuid(20),uuid(21)]),/simulated assignment failure/)
    assert.equal(await count('appointments'),before)
    await db.exec('DROP TRIGGER simulate_failure ON appointment_assignments; DROP FUNCTION fail_secondary();')
    const duo = await save(input({service_id:uuid(11)}),[uuid(20),uuid(21)])
    const old = (await db.query('SELECT * FROM appointments WHERE id=$1',[duo])).rows[0]
    await reject(()=>save({start_time:'2099-11-02T12:00:00Z',end_time:'2099-11-02T13:00:00Z',expected_updated_at:'2000-01-01T00:00:00Z'},null,duo),'40001')
    assert.deepEqual((await db.query('SELECT start_time FROM appointments WHERE id=$1',[duo])).rows[0].start_time,old.start_time)
    console.log('PASS SQL: failed duo assignment rolls back the entire booking; stale update refused')

    await save({status:'cancelled'},null,duo)
    await db.query('INSERT INTO staff_services VALUES ($1,$2)',[uuid(21),uuid(11)])
    await save(input()) // staff 20 is unrestricted, despite staff 21's restriction.
    await reject(()=>save(input({staff_id:uuid(21)}),[uuid(21)]),'23514')
    await db.query('UPDATE staff SET is_active=false WHERE id=$1',[uuid(21)])
    await reject(()=>save(input({service_id:uuid(11)}),[uuid(20),uuid(21)]),'23514')
    await db.query('UPDATE staff SET is_active=true WHERE id=$1',[uuid(21)])
    console.log('PASS SQL: qualifications are per practitioner, inactive staff rejected')

    await db.query(`INSERT INTO staff_availability(staff_id,is_recurring,day_of_week,start_time,end_time)
      VALUES ($1,true,extract(dow from '2099-11-02'::date),'09:00','12:00'),($1,true,extract(dow from '2099-11-02'::date),'14:00','19:00')`,[uuid(20)])
    const allowed = async (start,end) => (await db.query('SELECT public.booking_interval_allowed($1,$2,$3,$4) ok',[uuid(20),start,end,hours])).rows[0].ok
    assert.equal(await allowed('2099-11-02T11:30Z','2099-11-02T12:30Z'),false)
    assert.equal(await allowed('2099-11-02T14:00Z','2099-11-02T15:00Z'),true)
    assert.equal(await allowed('2099-11-03T10:00Z','2099-11-03T11:00Z'),false)
    await db.query(`INSERT INTO staff_availability(staff_id,is_recurring,specific_date,start_time,end_time)
      VALUES ($1,false,'2099-11-02','16:00','18:00')`,[uuid(20)])
    assert.equal(await allowed('2099-11-02T14:00Z','2099-11-02T15:00Z'),false)
    assert.equal(await allowed('2099-11-02T15:00Z','2099-11-02T16:00Z'),true)
    console.log('PASS SQL: split shifts, rest days, Paris timezone and specific-date overrides')

    await db.exec('SET ROLE anon')
    await reject(()=>save(input()),'42501')
    await reject(()=>db.query('INSERT INTO appointments(id) VALUES ($1)',[uuid(99)]),'42501')
    await db.exec('RESET ROLE; SET ROLE service_role')
    await save({status:'cancelled'},null,id)
    console.log('PASS SQL: anonymous mutations forbidden; service-role RPC works with invoker privileges')
  } finally { await db.close() }
}
main().catch(error=>{ console.error(error); process.exitCode=1 })

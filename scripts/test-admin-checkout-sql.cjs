// Real PostgreSQL function and interval triggers; no network, payment provider or customer data.
const fs = require('node:fs'), assert = require('node:assert/strict'), { PGlite } = require('@electric-sql/pglite')
const migration = 'database/migrations/20261109031021_admin_checkout_appointment_atomic.sql'
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12,'0')}`
const [salon,service,client,a,b,booking,overlap] = [1,2,3,4,5,6,7].map(id)
const version = '2026-01-01T00:00:00.000Z', start = '2099-11-02T10:00:00.000Z', end = '2099-11-02T11:30:00.000Z'
const quote = [{id:service,name:'First historical care',price_cents:4000},{id:id(8),name:'Second historical care',price_cents:3000}]
let db
async function seed({paid=0,paymentStatus='unpaid',method='on_site',status='confirmed',items=quote,price=9900}={}) {
 await db.exec('TRUNCATE public.appointments CASCADE; ALTER TABLE public.appointments DISABLE TRIGGER guard_appointment_interval; ALTER TABLE public.appointment_assignments DISABLE TRIGGER guard_appointment_assignment_interval;')
 await db.query('UPDATE public.services SET price_cents=$1',[price])
 await db.query(`INSERT INTO public.appointments(id,salon_id,service_id,client_id,staff_id,start_time,end_time,status,payment_status,payment_method,amount_paid_cents,paid_at,service_items,updated_at,client_notes)
 VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,'Historical note')`,[booking,salon,service,client,a,start,end,status,paymentStatus,method,paid,paid?version:null,items===null?null:JSON.stringify(items),version])
 await db.query('INSERT INTO public.appointment_assignments VALUES($1,$2),($1,$3)',[booking,a,b])
 await db.query(`INSERT INTO public.appointments(id,salon_id,service_id,client_id,staff_id,start_time,end_time,status,payment_status,amount_paid_cents,updated_at)
 VALUES($1,$2,$3,$4,$5,$6,$7,'confirmed','unpaid',0,$8)`,[overlap,salon,service,client,a,start,end,version])
 if(paid>0) await db.query('INSERT INTO public.payments(appointment_id,amount_cents,method) VALUES($1,$2,$3)',[booking,paid,method==='mixed'?'cash':method])
 await db.exec('ALTER TABLE public.appointments ENABLE TRIGGER guard_appointment_interval; ALTER TABLE public.appointment_assignments ENABLE TRIGGER guard_appointment_assignment_interval;')
}
async function snapshot(){return (await db.query(`SELECT to_jsonb(a) AS booking,
 (SELECT jsonb_agg(x ORDER BY staff_id) FROM public.appointment_assignments x WHERE x.appointment_id=a.id) AS team,
 (SELECT jsonb_agg(p ORDER BY id) FROM public.payments p WHERE p.appointment_id=a.id) AS ledger,
 (SELECT to_jsonb(o) FROM public.appointments o WHERE o.id=$2) AS other FROM public.appointments a WHERE a.id=$1`,[booking,overlap])).rows[0]}
async function raw({payments=[{amount_cents:7000,method:'card'}],expected=version,appointmentId=booking}={}) {
 return (await db.query('SELECT public.admin_checkout_appointment_atomic($1,$2,$3) AS result',[appointmentId,expected,payments===null?null:JSON.stringify(payments)])).rows[0].result
}
async function checkout(options){await db.exec('SET ROLE service_role');try{return await raw(options)}finally{await db.exec('RESET ROLE')}}
async function rejects(options,code='22023'){const before=await snapshot();await assert.rejects(()=>checkout(options),error=>error.code===code);assert.deepEqual(await snapshot(),before)}
async function main(){
 db=new PGlite()
 await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
 CREATE TABLE public.salons(id uuid PRIMARY KEY,name text,city text,address text);
 CREATE TABLE public.services(id uuid PRIMARY KEY,name text,price_cents integer);
 CREATE TABLE public.clients(id uuid PRIMARY KEY,first_name text,last_name text);
 CREATE TABLE public.staff(id uuid PRIMARY KEY,first_name text,last_name text,role text,phone text,password_hash text);
 CREATE TABLE public.appointments(id uuid PRIMARY KEY,salon_id uuid,service_id uuid,client_id uuid,staff_id uuid,start_time timestamptz,end_time timestamptz,status text,payment_status text,payment_method text,amount_paid_cents integer,paid_at timestamptz,service_items jsonb,updated_at timestamptz,client_notes text);
 CREATE TABLE public.appointment_assignments(appointment_id uuid REFERENCES public.appointments ON DELETE CASCADE,staff_id uuid REFERENCES public.staff,PRIMARY KEY(appointment_id,staff_id));
 CREATE TABLE public.payments(id serial PRIMARY KEY,appointment_id uuid REFERENCES public.appointments ON DELETE CASCADE,amount_cents integer CHECK(amount_cents>0),method text);
 GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA public TO service_role;
 GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO service_role;`)
 const guards=fs.readFileSync('database/migrations/2026-10-25_client_appointment_management.sql','utf8')
 await db.exec(guards.slice(guards.indexOf('CREATE OR REPLACE FUNCTION public.guard_appointment_interval()'),guards.indexOf('CREATE OR REPLACE FUNCTION public.client_change_appointment(')))
 const sql=fs.readFileSync(migration,'utf8');await db.exec(sql);await db.exec(sql)
 await db.query(`INSERT INTO public.salons VALUES($1,'Local fixture','City','Address');`,[salon])
 await db.query(`INSERT INTO public.services VALUES($1,'Live catalogue',9900)`,[service])
 await db.query(`INSERT INTO public.clients VALUES($1,'Local','Fixture')`,[client])
 for(const member of[a,b])await db.query(`INSERT INTO public.staff VALUES($1,'Local','Practitioner','therapist','000','PRIVATE')`,[member])
 await seed();const before=await snapshot()
 const settled=await checkout({payments:[{amount_cents:5000,method:'card'},{amount_cents:2000,method:'cash'}]});const after=await snapshot()
 assert.equal(settled.payment_status,'paid');assert.equal(settled.amount_paid_cents,7000);assert.equal(settled.payment_method,'mixed')
 for(const field of ['id','salon_id','service_id','client_id','staff_id','start_time','end_time','status','service_items','client_notes'])assert.deepEqual(after.booking[field],before.booking[field],field)
 assert.deepEqual(after.team,before.team);assert.deepEqual(after.other,before.other);assert.equal(after.ledger.length,2)
 assert.equal(settled.assignments.length,2);assert.equal(JSON.stringify(settled).includes('PRIVATE'),false)
 console.log('PASS: historical multi-service quote beats live catalogue; overlapping duo settles atomically without changing attendance, time or assignments')
 await seed({paid:3000,paymentStatus:'partial',method:'stripe'});await checkout({payments:[{amount_cents:4000,method:'card'}]})
 let state=await snapshot();assert.equal(state.booking.amount_paid_cents,7000);assert.equal(state.booking.payment_method,'mixed');assert.equal(state.ledger.length,2);assert.equal(Date.parse(state.booking.paid_at),Date.parse(version))
 await seed({paid:1000,method:'cash'});await checkout({payments:[{amount_cents:6000,method:'cash'}]});state=await snapshot();assert.equal(state.booking.payment_method,'cash');assert.equal(state.booking.amount_paid_cents,7000)
 await seed({items:null,price:9000});await checkout({payments:[{amount_cents:9000,method:'check'}]});assert.equal((await snapshot()).booking.amount_paid_cents,9000)
 console.log('PASS: only the remaining balance is collected; prior payments/methods are retained and legacy single services use their catalogue price')
 for(const payments of [null,{},[],[{amount_cents:0,method:'card'}],[{amount_cents:-7000,method:'card'}],[{amount_cents:7000.5,method:'card'}],[{amount_cents:'7000',method:'card'}],[{amount_cents:2147483648,method:'card'}],[{amount_cents:7000,method:'unknown'}],[{amount_cents:7000,method:'mixed'}],[{amount_cents:6999,method:'card'}],[{amount_cents:7001,method:'card'}],[{amount_cents:7000,method:'card',status:'completed'}]]){await seed();await rejects({payments})}
 for(const items of [[],{},[{price_cents:'7000'}],[{price_cents:-1}],[{price_cents:1.5}],[{price_cents:2147483648}]]){await seed({items});await rejects({payments:[{amount_cents:7000,method:'card'}]})}
 await seed({paid:-1});await rejects({})
 console.log('PASS: malformed, fractional, negative, zero, oversized, injected or mismatched amounts fail before any parent or ledger write')
 for(const status of ['blocked','cancelled','no_show']){await seed({status});await rejects({},'PT409')}
 await seed({paymentStatus:'paid',paid:7000});await rejects({},'PT409')
 await seed({paid:7000,paymentStatus:'partial'});await rejects({},'PT409')
 await seed({paymentStatus:'pending',method:'stripe'});await rejects({},'PT409')
 await seed();await rejects({expected:'2026-02-01T00:00Z'},'PT409');await rejects({expected:null});await rejects({appointmentId:id(999)},'P0002')
 console.log('PASS: stale/missing versions, already-paid or zero-balance bookings, closed attendance states and pending Stripe checkouts cannot be charged')
 await seed();const initial=await snapshot()
 await db.exec(`CREATE FUNCTION public.reject_checkout_ledger() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Fixture ledger failure'; END $$;
 CREATE TRIGGER reject_checkout_ledger BEFORE INSERT ON public.payments FOR EACH ROW EXECUTE FUNCTION public.reject_checkout_ledger();`)
 await rejects({},'23514');assert.deepEqual(await snapshot(),initial)
 await db.exec('DROP TRIGGER reject_checkout_ledger ON public.payments; DROP FUNCTION public.reject_checkout_ledger()')
 console.log('PASS: ledger insertion failure rolls back the appointment payment state and preserves the complete team')
 await seed();await checkout();const once=await snapshot();await rejects({},'PT409');assert.equal(once.ledger.length,1)
 const unchanged=await snapshot();await db.exec(sql);assert.deepEqual(await snapshot(),unchanged)
 for(const role of ['anon','authenticated']){await db.exec('SET ROLE '+role);try{await assert.rejects(()=>raw(),error=>error.code==='42501')}finally{await db.exec('RESET ROLE')}}
 await assert.rejects(()=>raw(),error=>error.code==='42501')
 console.log('PASS: repeat settlement cannot double-charge; migration replay is non-destructive and EXECUTE stays exclusive to service_role')
 await db.close()
}
main().catch(error=>{console.error(error);process.exitCode=1})

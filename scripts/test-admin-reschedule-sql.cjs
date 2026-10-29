// Execute the actual migration and interval triggers in an isolated Postgres engine.
const fs=require('node:fs'),assert=require('node:assert/strict'),{PGlite}=require('@electric-sql/pglite')
const migration='database/migrations/20261028231017_admin_reschedule_appointment_atomic.sql'
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`
const [salon,service,client,a,b,c,booking]=[1,2,3,4,5,6,7].map(id)
const oldStart='2099-11-02T10:00:00Z',oldEnd='2099-11-02T11:30:00Z',version='2026-01-01T00:00:00Z'
let db
async function seed(){
 await db.exec('TRUNCATE public.appointments CASCADE')
 await db.query(`INSERT INTO public.appointments(id,salon_id,service_id,client_id,staff_id,start_time,end_time,status,payment_status,payment_method,amount_paid_cents,updated_at) VALUES($1,$2,$3,$4,$5,$6,$7,'confirmed','paid','stripe',14000,$8)`,[booking,salon,service,client,a,oldStart,oldEnd,version])
 await db.query('INSERT INTO public.appointment_assignments VALUES($1,$2)',[booking,a])
}
async function extra(member,start,end){const other=id(50+Number(member.slice(-2)));await db.query(`INSERT INTO public.appointments(id,salon_id,service_id,client_id,staff_id,start_time,end_time,status,updated_at) VALUES($1,$2,$3,$4,$5,$6,$7,'confirmed',$8)`,[other,salon,service,client,member,start,end,version])}
async function snapshot(){return (await db.query(`SELECT to_jsonb(a) AS booking,(SELECT jsonb_agg(x ORDER BY staff_id) FROM public.appointment_assignments x WHERE appointment_id=a.id) AS team,(SELECT count(*)::int FROM public.payments WHERE appointment_id=a.id) AS payments FROM public.appointments a WHERE id=$1`,[booking])).rows[0]}
async function move({team=[b],updates={start_time:'2099-11-02T13:00:00Z',end_time:'2099-11-02T14:30:00Z'},expected=version,payments=[]}={}){
 return (await db.query('SELECT public.admin_reschedule_appointment_atomic($1,$2,$3,$4,$5) AS result',[booking,expected,JSON.stringify(updates),team,JSON.stringify(payments)])).rows[0].result
}
async function main(){
 db=new PGlite()
 await db.exec(`CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role BYPASSRLS;
 CREATE TABLE public.salons(id uuid PRIMARY KEY,name text,city text,address text);
 CREATE TABLE public.services(id uuid PRIMARY KEY,name text,duration_minutes int,price_cents int);
 CREATE TABLE public.clients(id uuid PRIMARY KEY,first_name text,last_name text);
 CREATE TABLE public.staff(id uuid PRIMARY KEY,salon_id uuid,first_name text,last_name text,role text,phone text,password_hash text);
 CREATE TABLE public.appointments(id uuid PRIMARY KEY,salon_id uuid,service_id uuid,client_id uuid,staff_id uuid,start_time timestamptz,end_time timestamptz,status text,payment_status text,payment_method text,amount_paid_cents int,paid_at timestamptz,client_notes text,internal_notes text,service_items jsonb,updated_at timestamptz,CHECK(end_time>start_time));
 CREATE TABLE public.appointment_assignments(appointment_id uuid REFERENCES public.appointments ON DELETE CASCADE,staff_id uuid REFERENCES public.staff,PRIMARY KEY(appointment_id,staff_id));
 CREATE TABLE public.payments(id serial PRIMARY KEY,appointment_id uuid REFERENCES public.appointments ON DELETE CASCADE,amount_cents int CHECK(amount_cents>0),method text);
 GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA public TO service_role;GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO service_role;`)
 const guards=fs.readFileSync('database/migrations/2026-10-25_client_appointment_management.sql','utf8')
 await db.exec(guards.slice(guards.indexOf('CREATE OR REPLACE FUNCTION public.guard_appointment_interval()'),guards.indexOf('CREATE OR REPLACE FUNCTION public.client_change_appointment(')))
 const sql=fs.readFileSync(migration,'utf8');await db.exec(sql);await db.exec(sql)
 await db.query('INSERT INTO public.salons VALUES($1,\'Temple\',\'Paris\',\'Test\')',[salon])
 await db.query('INSERT INTO public.services VALUES($1,\'Massage\',60,14000)',[service])
 await db.query('INSERT INTO public.clients VALUES($1,\'Camille\',\'Test\')',[client])
 for(const member of [a,b,c])await db.query('INSERT INTO public.staff VALUES($1,$2,\'Masseuse\',\'Test\',\'therapist\',\'0601020304\',\'PRIVATE\')',[member,salon])
 await seed();await extra(b,oldStart,oldEnd);await extra(a,'2099-11-02T13:00Z','2099-11-02T14:30Z')
 const result=await move();assert.equal(result.staff_id,b);assert.equal(Date.parse(result.end_time)-Date.parse(result.start_time),90*60000);assert.equal(result.payment_status,'paid');assert.equal(result.amount_paid_cents,14000);assert.equal(result.staff.password_hash,undefined);assert.equal(result.assignments.length,1)
 console.log('PASS: atomic staff+time move ignores conflicts at old time/old practitioner; duration, payment and response relations preserved')
 await seed();await extra(b,'2099-11-02T13:00Z','2099-11-02T14:30Z');let before=await snapshot();await assert.rejects(()=>move(),e=>e.code==='23P01');assert.deepEqual(await snapshot(),before)
 console.log('PASS: final target conflict rolls back parent, complete team and payments')
 await seed();await extra(c,'2099-11-02T13:30Z','2099-11-02T14:30Z');before=await snapshot();await assert.rejects(()=>move({team:[b,c]}),e=>e.code==='23P01');assert.deepEqual(await snapshot(),before)
 console.log('PASS: secondary-practitioner conflict during insertion rolls back the entire move')
 await seed();before=await snapshot();await assert.rejects(()=>move({team:[id(99)]}),e=>e.code==='23503');assert.deepEqual(await snapshot(),before)
 await assert.rejects(()=>move({updates:{start_time:'2099-11-02T13:00Z',end_time:'2099-11-02T14:30Z',amount_paid_cents:999},payments:[{amount_cents:0,method:'card'}]}),e=>e.code==='23514');assert.deepEqual(await snapshot(),before)
 console.log('PASS: assignment and payment failures cannot leave a partial write')
 await assert.rejects(()=>move({expected:'2026-02-01T00:00Z'}),e=>e.code==='40001');assert.deepEqual(await snapshot(),before)
 await assert.rejects(()=>move({updates:{id:id(99)}}),e=>e.code==='22023');assert.deepEqual(await snapshot(),before)
 console.log('PASS: stale snapshots and protected-field injection rejected before any mutation')
 for(const role of ['anon','authenticated']){await db.exec('SET ROLE '+role);try{await assert.rejects(()=>move(),e=>e.code==='42501')}finally{await db.exec('RESET ROLE')}}
 await db.exec('SET ROLE service_role');await move();await db.exec('RESET ROLE')
 console.log('PASS: migration repeatable; only server service role can execute; no security definer escalation')
 await db.close()
}
main().catch(e=>{console.error(e);process.exitCode=1})

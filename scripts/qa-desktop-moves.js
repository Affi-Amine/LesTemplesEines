// Playwright CLI run-code recipe: in-memory data only, no production writes.
async (initial) => {
 for(const c of initial.context().browser().contexts())if(c!==initial.context())await c.close()
 const context=await initial.context().browser().newContext({viewport:{width:1536,height:1000},hasTouch:false,isMobile:false,deviceScaleFactor:1})
 const page=await context.newPage();page.setDefaultTimeout(60000);page.setDefaultNavigationTimeout(120000)
 const assert=(value,message)=>{if(!value)throw new Error(message)}
 const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`
 const salonId=id(1),serviceId=id(10),duoId=id(11),a=id(20),b=id(21),c=id(22)
 const today=await page.evaluate(()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Paris',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date()))
 const day=new Date(Date.parse(today+'T12:00Z')+86400000).toISOString().slice(0,10)
 const members=['Alice','Béa','Chloé'].map((first_name,i)=>({id:id(20+i),salon_id:salonId,first_name,last_name:'Test',is_active:true,role:'therapist',allowed_service_ids:[]}))
 const hours=Object.fromEntries(['sunday','monday','tuesday','wednesday','thursday','friday','saturday'].map(d=>[d,{open:'09:00',close:'21:00'}]))
 const services=[{id:serviceId,name:'Massage',duration_minutes:90,price_cents:14000,required_staff_count:1,is_active:true},{id:duoId,name:'Duo',duration_minutes:90,price_cents:24000,required_staff_count:2,is_active:true}]
 const instant=hour=>`${day}T${String(hour).padStart(2,'0')}:00:00.000Z`
 const make=(n,ids,start,status='confirmed')=>({id:id(n),salon_id:salonId,service_id:ids.length===2?duoId:serviceId,staff_id:ids[0],start_time:instant(start),end_time:new Date(Date.parse(instant(start))+90*60000).toISOString(),status,payment_status:'paid',payment_method:'stripe',amount_paid_cents:14000,updated_at:'2026-01-01T00:00Z',client:{first_name:n===301?'Duo':'Camille',last_name:'Test'},service:services[ids.length===2?1:0],staff:members.find(m=>m.id===ids[0]),assignments:ids.map(staff_id=>({staff_id,staff:members.find(m=>m.id===staff_id)}))})
 let records,attempts=[],scenario='success'
 const seed=()=>{records=[make(300,[a],8),make(301,[a,b],10),make(302,[b],13),make(303,[c],15,'completed')];attempts=[];scenario='success'};seed()
 await context.addCookies([{name:'accessToken',value:'local-qa-only',domain:'127.0.0.1',path:'/'}])
 await page.addInitScript(()=>{localStorage.setItem('adminToken','local-qa-only');localStorage.setItem('adminUser',JSON.stringify({role:'admin'}))})
 await page.route('**/api/**',async route=>{
  const request=route.request(),url=new URL(request.url());const reply=(body,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)})
  if(url.pathname==='/api/salons')return reply([{id:salonId,name:'Temple Test',slug:'demo',is_active:true,opening_hours:hours}])
  if(url.pathname==='/api/staff')return reply(members)
  if(url.pathname==='/api/services')return reply(services)
  if(url.pathname==='/api/clients')return reply([])
  if(url.pathname==='/api/appointments'&&request.method()==='GET')return reply(records)
  if(request.method()==='PATCH'){
   const payload=request.postDataJSON();attempts.push({id:url.pathname.split('/').pop(),payload})
   await new Promise(resolve=>setTimeout(resolve,500))
   if(scenario==='conflict')return reply({error:'Ce créneau vient d’être réservé.'},409)
   if(scenario==='offline')return route.abort('internetdisconnected')
   records=records.map(item=>item.id===url.pathname.split('/').pop()?{...item,...payload,staff:members.find(m=>m.id===payload.staff_id),end_time:new Date(Date.parse(payload.start_time)+Date.parse(item.end_time)-Date.parse(item.start_time)).toISOString(),assignments:payload.staff_ids.map(staff_id=>({staff_id,staff:members.find(m=>m.id===staff_id)})),updated_at:new Date().toISOString()}:item)
   return reply(records.find(item=>item.id===url.pathname.split('/').pop()))
  }
  return reply([])
 })
 const source=()=>page.locator(`[data-appointment-id="${id(300)}"]:visible`).first()
 const confirm=()=>page.getByRole('dialog').getByRole('button',{name:'Confirmer le déplacement',exact:true})
 const drag=async(target)=>{
  await source().scrollIntoViewIfNeeded()
  const start=await source().boundingBox(),end=await target.boundingBox()
  assert(end.y>0&&end.y<1000,'Target outside desktop viewport')
  const hit=await source().evaluate(el=>{const r=el.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+12);return {ok:el.contains(hit),target:hit?.outerHTML.slice(0,300)}})
  assert(hit.ok,'Source covered: '+JSON.stringify(hit))
  await page.mouse.move(start.x+start.width/2,start.y+12);await page.mouse.down()
  await page.mouse.move(start.x+start.width/2+12,start.y+12)
  await page.waitForFunction(()=>[...document.querySelectorAll('[data-appointment-id]')].some(el=>el.style.cursor==='grabbing'),null,{timeout:5000})
  await page.mouse.move(end.x+end.width/2,end.y+12,{steps:16})
  await target.and(page.locator('[data-drop-over="true"]')).waitFor({timeout:5000})
  await page.mouse.up()
  await confirm().waitFor({timeout:4000}).catch(async error=>{throw new Error(error.message+'; '+(await page.locator('body').innerText()).slice(-1400))})
 }
 await page.goto('http://127.0.0.1:3190/admin/salons/'+salonId+'/dashboard')
 const calendar=page.locator('[data-slot="calendar"]:visible');await calendar.waitFor()
 const label=await page.evaluate(day=>new Date(day+'T12:00Z').toLocaleDateString(),day)
 if(!await calendar.locator(`button[data-day="${label}"]`).count())await calendar.locator('.rdp-button_next').click()
 await calendar.locator(`button[data-day="${label}"]`).click()
 await drag(page.locator(`[data-calendar-slot="slot-dashboard-${c}-13-0"]`))
 await confirm().click();await page.getByRole('dialog').waitFor({state:'hidden'})
 assert(attempts.length===1&&records.find(x=>x.id===id(300)).staff_id===c,'Desktop salon move failed')
 await page.goto('http://127.0.0.1:3190/admin/calendrier')
 await page.getByRole('combobox').first().click();await page.getByRole('option',{name:/^Temple Test/}).click()
 await page.getByRole('tab',{name:'Jour',exact:true}).click();await page.getByRole('button',{name:'Période suivante',exact:true}).click()
 await source().waitFor()
 await drag(page.locator(`[data-calendar-slot="slot-day-${day}-15-${c}-0"]`))
 await page.getByRole('dialog').getByRole('button',{name:'Annuler',exact:true}).click();assert(attempts.length===1,'Cancel wrote a desktop move')
 await drag(page.locator(`[data-calendar-slot="slot-day-${day}-15-${c}-0"]`));await confirm().click();await page.getByRole('dialog').waitFor({state:'hidden'})
 assert(attempts.length===2,'General calendar did not share the move workflow')
 await context.close();return {desktopSalon:true,desktopGeneralCalendar:true,cancelReadOnly:true}
}

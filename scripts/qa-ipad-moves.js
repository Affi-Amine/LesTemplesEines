// Playwright CLI run-code recipe: in-memory data only, no production writes.
async (initial) => {
 for(const c of initial.context().browser().contexts())if(c!==initial.context())await c.close()
 const context=await initial.context().browser().newContext({viewport:{width:820,height:1180},hasTouch:true,isMobile:true,deviceScaleFactor:1})
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
   records=records.map(item=>item.id===url.pathname.split('/').pop()?{...item,...payload,staff_id:payload.staff_id||item.staff_id,staff:members.find(m=>m.id===(payload.staff_id||item.staff_id)),end_time:new Date(Date.parse(payload.start_time||item.start_time)+Date.parse(item.end_time)-Date.parse(item.start_time)).toISOString(),assignments:(payload.staff_ids||item.assignments.map(a=>a.staff_id)).map(staff_id=>({staff_id,staff:members.find(m=>m.id===staff_id)})),updated_at:new Date().toISOString()}:item)
   return reply(records.find(item=>item.id===url.pathname.split('/').pop()))
  }
  return reply([])
 })
 const cdp=await context.newCDPSession(page)
 const enabled=()=>page.getByRole('button',{name:'Mode déplacement',exact:true})
 const move=async(source,target,{noMove=false,cancel=false}={})=>{
  await enabled().tap()
  await source.scrollIntoViewIfNeeded()
  const box=await source.boundingBox(),dest=noMove?box:await target.boundingBox()
  const x=Math.round(box.x+box.width/2),y=Math.round(box.y+15),tx=Math.round(dest.x+dest.width/2),ty=Math.round(dest.y+15)
  assert(ty<1180&&ty>0,'Test target outside viewport')
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]})
  await page.waitForFunction(()=>document.querySelector('[data-tablet-agenda] [role="status"]')?.textContent.includes('Déposez'))
  if(!noMove)for(let i=1;i<=12;i++){
   await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+(tx-x)*i/12,y:y+(ty-y)*i/12}]})
   await page.evaluate(()=>new Promise(requestAnimationFrame))
  }
  await cdp.send('Input.dispatchTouchEvent',{type:cancel?'touchCancel':'touchEnd',touchPoints:[]})
 }
 const slot=(member,hour)=>page.locator(`[data-calendar-slot="tablet-${member}-${hour}-0"]`)
 const source=n=>page.locator(`[data-appointment-id="${id(n)}"]:visible`).first()
 const confirm=()=>page.getByRole('dialog').getByRole('button',{name:'Confirmer le déplacement',exact:true})
 const reset=async()=>{seed();await page.goto('http://127.0.0.1:3190/admin/salons/'+salonId+'/dashboard');await page.locator('[data-tablet-agenda]').waitFor();await page.getByRole('button',{name:'Jour suivant',exact:true}).tap();await source(300).waitFor()}
 const results=[]
 try {
 await reset()
 await move(source(300),null,{noMove:true});assert(attempts.length===0&&!await page.getByRole('dialog').count(),'Stationary hold moved appointment');results.push('hold is no-op')
 await move(source(300),slot(c,13),{cancel:true});assert(attempts.length===0&&!await page.getByRole('dialog').count(),'Touch cancellation wrote data');results.push('touch cancel is safe')
 await move(source(300),slot(c,13));await confirm().waitFor();assert(attempts.length===0,'Drop saved before confirmation');await page.getByRole('dialog').getByRole('button',{name:'Annuler',exact:true}).tap();assert(attempts.length===0,'Dialog cancellation wrote data');results.push('drop awaits confirmation; cancel is read-only')
 await move(source(300),slot(c,13));await confirm().evaluate(el=>{el.click();el.click()});await page.getByRole('dialog').waitFor({state:'hidden'});assert(attempts.length===1,'Double confirmation sent duplicate mutations');let moved=records.find(x=>x.id===id(300));assert(moved.staff_id===c&&Date.parse(moved.end_time)-Date.parse(moved.start_time)===90*60000,'Duration or staff lost');assert(moved.payment_status==='paid'&&moved.amount_paid_cents===14000,'Payment modified');results.push('single move preserves duration/payment; double tap writes once')
 await reset();await move(source(301),slot(a,13));assert(!await page.getByRole('dialog').count()&&attempts.length===0,'Known secondary conflict accepted');results.push('duo secondary conflict rejected')
 await move(source(301),slot(c,13));assert(!await page.getByRole('dialog').count()&&attempts.length===0,'Duo team silently replaced');results.push('duo cannot change team by drag')
 await move(source(301),slot(a,16));await confirm().waitFor();await confirm().tap();await page.getByRole('dialog').waitFor({state:'hidden'});assert(attempts.length===1&&attempts[0].payload.staff_ids.join()===`${a},${b}`,'Duo team not preserved');results.push('duo moves once with entire team')
 await reset();scenario='conflict';const original=JSON.stringify(records.find(x=>x.id===id(300)));await move(source(300),slot(c,13));await confirm().tap();await page.getByRole('dialog').getByRole('alert').waitFor();assert(JSON.stringify(records.find(x=>x.id===id(300)))===original,'Server rejection changed original');await page.getByRole('dialog').getByRole('button',{name:'Annuler',exact:true}).tap();results.push('server conflict shows error and preserves source')
 await move(source(300),slot(c,13));scenario='offline';await confirm().tap();await page.getByRole('dialog').getByRole('alert').waitFor();assert(JSON.stringify(records.find(x=>x.id===id(300)))===original,'Network failure changed source');await page.getByRole('dialog').getByRole('button',{name:'Annuler',exact:true}).tap();results.push('network failure is recoverable')
 await enabled().tap();assert(await source(303).getAttribute('disabled')!==null,'Completed care draggable');await enabled().tap()
 const card=source(300);await card.scrollIntoViewIfNeeded();const box=await card.boundingBox(),before=await page.evaluate(()=>scrollY);const x=box.x+box.width/2,y=box.y+40
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});for(let i=1;i<=10;i++){await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y:y-i*20}]});await page.evaluate(()=>new Promise(requestAnimationFrame))}await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});assert(await page.evaluate(before=>scrollY>before+50,before),'Normal scrolling lost');results.push('normal scroll still native; completed appointments locked')
 await page.evaluate(()=>scrollTo(0,0));await enabled().tap()
 const autoBox=await source(300).boundingBox(),autoBefore=await page.evaluate(()=>scrollY)
 const ax=autoBox.x+autoBox.width/2,ay=autoBox.y+15
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:ax,y:ay}]})
 await page.waitForFunction(()=>document.querySelector('[data-tablet-agenda] [role="status"]')?.textContent.includes('Déposez'))
 for(let i=1;i<=12;i++){await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:ax,y:ay+(1150-ay)*i/12}]});await page.evaluate(()=>new Promise(requestAnimationFrame))}
 await page.waitForFunction(before=>scrollY>before+100,autoBefore,{timeout:8000})
 await cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]})
 results.push('drag auto-scrolls at viewport edge; cancellation leaves data unchanged')
 await page.evaluate(()=>scrollTo(0,0))
 scenario='success'
 let count=attempts.length
 await source(300).tap();await page.getByRole('button',{name:'Modifier la date ou l’heure',exact:true}).tap()
 await page.getByLabel('Heure',{exact:true}).fill('18:00')
 await page.getByRole('button',{name:'Enregistrer',exact:true}).evaluate(el=>{el.click();el.click()})
 await page.getByRole('dialog').waitFor({state:'hidden'})
 assert(attempts.length===count+1,'Edit form sent duplicate updates')
 const edited=attempts.at(-1).payload
 assert(!('staff_ids' in edited)&&!('service_id' in edited)&&!('status' in edited),'Edit rewrote unchanged fields')
 assert(records.find(r=>r.id===id(300)).amount_paid_cents===14000,'Editing changed payment')
 results.push('edit form saves once and only sends changed fields')
 await page.evaluate(()=>scrollTo(0,0));await source(300).scrollIntoViewIfNeeded();await source(300).tap();await page.getByRole('button',{name:'Modifier la date ou l’heure',exact:true}).tap()
 await page.getByLabel('Date',{exact:true}).fill('');await page.getByLabel('Heure',{exact:true}).fill('')
 await page.getByLabel('Statut',{exact:true}).click();await page.getByRole('option',{name:'Annulé',exact:true}).click()
 await page.getByRole('button',{name:'Enregistrer',exact:true}).tap();await page.getByRole('dialog').waitFor({state:'hidden'})
 const cancelled=records.find(r=>r.id===id(300))
 assert(cancelled.status==='cancelled'&&cancelled.amount_paid_cents===14000,'Cancellation lost payment/history')
 assert(!('start_time' in attempts.at(-1).payload),'Cancellation tried to reschedule invalid inputs')
 results.push('cancellation ignores stale schedule fields and preserves payment/history')
 await page.evaluate(()=>scrollTo(0,0))
 await page.screenshot({path:'output/playwright/ipad-move-verified.png'})
 } catch(error) {
   await page.screenshot({path:'output/playwright/ipad-move-failure.png'})
   throw new Error('Completed: '+results.join(' | ')+'; '+error.message+'; UI: '+(await page.locator('body').innerText()).slice(-1800))
 }
 await context.close();return results
}

// Run with Playwright CLI: run-code --filename scripts/qa-ipad-admin.js
// Requires the local Next server on port 3190. API requests use fixtures only.
async (initialPage) => {
  for(const c of initialPage.context().browser().contexts())if(c!==initialPage.context())await c.close()
  const context = await initialPage.context().browser().newContext({ viewport:{width:820,height:1180}, hasTouch:true, isMobile:true, deviceScaleFactor:1 })
  const page = await context.newPage()
  page.setDefaultTimeout(60000)
  const fixtureDay=await page.evaluate(()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Paris',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date()))
  const fixtureLabel=await page.evaluate(()=>new Intl.DateTimeFormat('fr-FR',{timeZone:'Europe/Paris',year:'numeric',month:'long',day:'numeric'}).format(new Date()))
  page.setDefaultNavigationTimeout(120000)
  const patches=[]
  const assert=(value,message)=>{if(!value)throw new Error(message)}
  const id = n => `00000000-0000-4000-8000-${String(n).padStart(12,'0')}`
  const salonId=id(1), solo=id(10), duo=id(11)
  const hours=Object.fromEntries(['sunday','monday','tuesday','wednesday','thursday','friday','saturday'].map(d=>[d,{open:'09:00',close:'21:00'}]))
  const salons=[{id:salonId,name:'Temple Démonstration',slug:'demo',city:'Paris',is_active:true,opening_hours:hours}]
  const staff=['Alice','Béa','Chloé','Diane','Emma','Fanny'].map((name,index)=>({id:id(20+index),salon_id:salonId,first_name:'Madame',last_name:name,role:'therapist',is_active:true,allowed_service_ids:[]}))
  const services=[{id:solo,name:'Massage détente',required_staff_count:1,duration_minutes:60,price_cents:8000,is_active:true,salon_ids:[salonId]}, {id:duo,name:'Massage duo',required_staff_count:2,duration_minutes:60,price_cents:15000,is_active:true,salon_ids:[salonId]}]
  await page.context().addCookies([{name:'accessToken',value:'local-qa-only',domain:'127.0.0.1',path:'/'}])
  await page.addInitScript(() => {
    localStorage.setItem('adminToken','local-qa-only')
    localStorage.setItem('adminUser',JSON.stringify({role:'admin',first_name:'Test',last_name:'Local'}))
    window.slotQA={scenario:'normal',posts:[],availabilityRequests:[]}
  })
  await page.route('**/api/**',async route=>{
    const request=route.request(), url=new URL(request.url())
    const reply=(data,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(data)})
    if(request.method()==='PATCH') { patches.push(request.postDataJSON());return reply({ok:true}) }
    if(url.pathname==='/api/salons')return reply(salons)
    if(url.pathname==='/api/staff')return reply(staff)
    if(url.pathname==='/api/services')return reply(services)
    if(url.pathname==='/api/clients')return reply([])
    if(url.pathname==='/api/appointments'&&request.method()==='GET') {
      const day=fixtureDay
      return reply(['stripe','cash','on_site','card'].map((method,i)=>({
        id:id(300+i),salon_id:salonId,service_id:solo,staff_id:staff[i%3].id,
        start_time:`${day}T${String(8+i).padStart(2,'0')}:00:00Z`,end_time:`${day}T${String(9+i).padStart(2,'0')}:00:00Z`,
        status:'confirmed',payment_status:i<2?'paid':i===2?'unpaid':'partial',payment_method:method,amount_paid_cents:i<2?8000:i===3?4000:0,
        client:{first_name:['Online','Surplace','Attente','Partiel'][i],last_name:'Test'},staff:staff[i%3],service:services[0],
        assignments:[{staff_id:staff[i%3].id,staff:staff[i%3]}],
      })))
    }
    return reply({error:`Unexpected local test API: ${url.pathname}`},500)
  })


  const results=[]
  const openDialog=()=>page.getByRole('dialog')
  const fingerScroll=async(target)=>{
    await target.scrollIntoViewIfNeeded()
    const before=await page.evaluate(()=>scrollY)
    const box=await target.boundingBox()
    const cdp=await context.newCDPSession(page)
    const x=Math.round(box.x+box.width/2), y=Math.round(Math.max(380,box.y+Math.min(80,box.height/2)))
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]})
    const samples=[]
    for(let step=1;step<=10;step++){
      await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y:y-step*20}]})
      await page.evaluate(()=>new Promise(requestAnimationFrame))
      samples.push(await page.evaluate(()=>scrollY))
    }
    await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]})
    assert(samples[3]>before+10,'Scroll did not start within the first 80px of finger movement')
    assert(!await openDialog().count(),'Scroll opened a booking')
    return samples.at(-1)-before
  }
  await page.goto('http://127.0.0.1:3190/admin/salons/'+salonId+'/dashboard')
  for(const [width,height] of [[768,1024],[820,1180],[1024,768],[1180,820],[1366,1024],[390,844]]){
    await page.setViewportSize({width,height})
    const grid=page.locator('[data-agenda-grid]')
    await grid.waitFor()
    const top=await grid.boundingBox()
    assert(top.y<height-100,`Planning not visible on arrival ${width}: ${top.y}`)
    const slot=page.locator('[data-calendar-slot]:visible').first()
    assert((await slot.boundingBox()).height>=44,'Creation target too small')
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`Horizontal overflow ${width}`)
    const nested=await slot.evaluate(el=>{
      const result=[]
      for(let node=el.parentElement;node&&node!==document.body;node=node.parentElement){
        const css=getComputedStyle(node)
        if(['auto','scroll'].includes(css.overflowY)||['auto','scroll'].includes(css.overflowX))result.push(node.tagName+':'+css.overflow)
      }
      return result
    })
    assert(nested.length===0,`Nested scroll surface: ${nested}`)
    assert(await page.locator('[data-agenda-column]').count()===staff.length,'Full team not displayed '+width)
    assert(await page.evaluate(()=>getComputedStyle(document.body).colorScheme)==='dark','Original dark palette lost '+width)
    await page.getByLabel('Afficher une masseuse').selectOption(staff[5].id)
    assert(await page.locator('[data-agenda-column]').count()===1,'Staff filter failed')
    await page.getByLabel('Afficher une masseuse').selectOption('all')
    assert(await page.locator('[data-agenda-column]').count()===staff.length,'Full team not restored')
    await page.getByRole('button',{name:'Choisir la date du planning',exact:true}).tap()
    const calendar=page.locator('[data-slot="calendar"]:visible')
    await calendar.locator('.rdp-button_next').tap()
    await calendar.getByRole('button',{name:/29 novembre 2026/}).tap()
    await openDialog().waitFor({state:'hidden'})
    assert((await page.getByRole('button',{name:'Choisir la date du planning',exact:true}).innerText()).includes('29'),'29 November not selected')
    await page.getByRole('button',{name:'Jour précédent',exact:true}).tap()
    // Return to the fixture date on all screen sizes using the calendar.
    await page.getByRole('button',{name:'Choisir la date du planning',exact:true}).tap()
    await page.locator('[data-slot="calendar"] .rdp-button_previous').tap()
    await page.locator('[data-slot="calendar"]').getByRole('button',{name:new RegExp(fixtureLabel)}).tap()
    const scrollDistance=await fingerScroll(page.locator('[data-appointment-id]:visible').first())
    await page.evaluate(()=>scrollTo(0,0))
    await page.screenshot({path:`output/playwright/ipad-workspace-${width}.png`,animations:'disabled'})
    results.push({width,height,planningVisible:true,nestedScroll:false,scrollDistance,date29:true,fullTeam:true,originalPalette:true})
  }
  await page.setViewportSize({width:820,height:1180})
  await page.getByLabel('Précision du planning').selectOption('15')
  assert((await page.locator('[data-calendar-slot]:visible').first().boundingBox()).height>=44,'Precise slot target below 44px')
  const card=page.locator(`[data-appointment-id="${id(300)}"]:visible`).first()
  await card.tap()
  await page.getByRole('button',{name:'Modifier la date ou l’heure',exact:true}).tap()
  await page.locator('#edit-date').fill('2026-11-29')
  await page.locator('#edit-time').fill('14:30')
  await page.getByRole('button',{name:'Enregistrer',exact:true}).tap()
  await openDialog().waitFor({state:'hidden'})
  assert(patches.length===1,'Edit did not save exactly once')
  assert(patches[0].start_time==='2026-11-29T13:30:00.000Z','Paris timezone mismatch')
  await page.getByRole('button',{name:'Vue liste',exact:true}).tap()
  await page.getByRole('button',{name:'Vue planning',exact:true}).tap()
  await page.getByRole('navigation',{name:'Accès rapides'}).getByRole('link',{name:'Salons',exact:true}).tap()
  await page.waitForURL('**/admin/salons')
  await page.getByRole('navigation',{name:'Accès rapides'}).getByRole('link',{name:'Agenda',exact:true}).tap()
  await page.waitForURL('**/admin/calendrier')
  await page.locator('[data-agenda-grid]').waitFor()
  await page.getByLabel('Salon du planning').selectOption(salonId)
  await page.locator('[data-calendar-slot]:visible').first().waitFor()
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'General calendar overflows')
  await page.screenshot({path:'output/playwright/ipad-general-agenda.png',animations:'disabled'})
  await page.setViewportSize({width:1536,height:864})
  await page.goto('http://127.0.0.1:3190/admin/salons')
  await page.locator('aside').waitFor()
  assert(!await page.getByRole('button',{name:'Ouvrir le menu',exact:true}).isVisible(),'Desktop menu regression')
  await context.close()
  return {results,editSaved:true,parisTime:true,generalAgenda:true,desktop:true}
}

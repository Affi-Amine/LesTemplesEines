// Real checkout calculations and component actions; fetch is a local stub only.
const assert = require('node:assert/strict')
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), ts = require('typescript')
const React = require('react')
const root = path.resolve(__dirname, '..')
const plain = value => JSON.parse(JSON.stringify(value))
function compile(relative, requireFn, globals = {}) {
  const exports = {}
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(root, relative), 'utf8'), {
    fileName:relative, compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX},
  }).outputText, {exports,require:requireFn,Date,Number,Error,console,...globals}, {filename:relative})
  return exports
}
const helper = compile('lib/appointments/checkout.ts', require)
const booking = extra => ({id:'checkout-local',status:'confirmed',start_time:'2099-11-02T10:00:00Z',updated_at:'2026-11-09T10:00:00Z',
  payment_status:'unpaid',amount_paid_cents:0,service:{name:'Tarif catalogue',price_cents:9999},
  service_items:[{name:'Soin historique A',price_cents:3500},{name:'Soin historique B',price_cents:4500}],client:{first_name:'Camille',last_name:'Test'},...extra})
const part = booking({payment_status:'partial',amount_paid_cents:6500})
assert.equal(helper.checkoutPriceCents(part),8000)
assert.equal(helper.amountDueCents(part),1500)
assert.equal(helper.amountDueCents(booking({payment_status:'paid',amount_paid_cents:0})),0)
assert.equal(helper.amountDueCents(booking({payment_status:'paid',service:null,service_items:null})),0)
assert.equal(helper.amountDueCents(booking({amount_paid_cents:6500})),1500,'Recorded money must not be charged a second time')
assert.equal(helper.amountDueCents(booking({payment_status:'partial',amount_paid_cents:9000})),0)
const mixed = helper.buildCheckoutPayload(part,[{method:'card',amount:'10,01'},{method:'cash',amount:'4.99'}])
assert.deepEqual(plain(mixed),{payment_status:'paid',payment_method:'mixed',amount_paid_cents:8000,
  payments:[{method:'card',amount_cents:1001},{method:'cash',amount_cents:499}],expected_updated_at:part.updated_at})
assert(!Object.hasOwn(mixed,'status'),'Encashment must never imply arrival or completion')
const thirty = booking({service_items:[{price_cents:30}]})
assert.equal(helper.buildCheckoutPayload(thirty,[{method:'card',amount:'0.10'},{method:'cash',amount:'0,20'}]).amount_paid_cents,30)
for(const value of ['','NaN','Infinity','-1','0','0.00','1e2','0.001','9007199254740992']) assert.equal(helper.parseCheckoutCents(value),null)
for(const price of [NaN,Infinity,-1,1.5]) assert.throws(()=>helper.buildCheckoutPayload(booking({service_items:[{price_cents:price}]}),[{method:'card',amount:'80'}]))
assert.throws(()=>helper.buildCheckoutPayload(booking({service_items:[]}),[{method:'card',amount:'80'}]),/tarif/)
for(const paid of [NaN,Infinity,-1,null]) assert.throws(()=>helper.buildCheckoutPayload(booking({payment_status:'partial',amount_paid_cents:paid}),[{method:'card',amount:'80'}]))
assert.throws(()=>helper.buildCheckoutPayload(booking({payment_status:'paid'}),[{method:'card',amount:'80'}]),/déjà réglé/)
assert.throws(()=>helper.buildCheckoutPayload(part,[{method:'card',amount:'14.99'}]),/0,01/)
assert.throws(()=>helper.buildCheckoutPayload(part,[{method:'card',amount:'15.01'}]),/0,01/)
assert.throws(()=>helper.buildCheckoutPayload(part,[{method:'unknown',amount:'15'}]),/valide/)
assert.throws(()=>helper.buildCheckoutPayload({...part,updated_at:'invalid'},[{method:'card',amount:'15'}]),/version/)
assert.throws(()=>helper.buildCheckoutPayload({...part,payment_status:'pending',payment_method:'stripe'},[{method:'card',amount:'15'}]),/en ligne/)
console.log('PASS: historical quotes, partial/paid balances, exact decimal cents and invalid allocations are protected')

const text = node => node == null || typeof node === 'boolean' ? '' : Array.isArray(node) ? node.map(text).join('')
  : typeof node === 'object' ? text(node.props?.children) : String(node)
const walk = node => node == null || typeof node !== 'object' ? [] : Array.isArray(node) ? node.flatMap(walk) : [node,...walk(node.props?.children)]
function mount(appointment) {
  const hooks=[],effects=[];let cursor=0,tree
  const state={calls:[],closed:[],paid:[],success:[]}
  const useState = initial => { const index=cursor++;if(!(index in hooks))hooks[index]=typeof initial==='function'?initial():initial
    return [hooks[index],value=>{hooks[index]=typeof value==='function'?value(hooks[index]):value}] }
  const react={...React,useState,useId:()=>{cursor++;return 'checkout-test'},useRef:initial=>{const index=cursor++;return hooks[index]||(hooks[index]={current:initial})},
    useEffect(fn,deps){const index=cursor++;if(!hooks[index]||deps.some((value,i)=>!Object.is(value,hooks[index][i]))){hooks[index]=deps;effects.push(fn)}}}
  const stubs=new Map()
  const exported=compile('components/calendar/appointment-checkout-dialog.tsx',name=>{
    if(name==='react')return react
    if(name==='@/lib/appointments/checkout')return helper
    if(name==='sonner')return {toast:{success:message=>state.success.push(message)}}
    if(name.startsWith('@/components/ui/')) {
      if(!stubs.has(name))stubs.set(name,new Proxy({},{get:(target,key)=>target[key]||(target[key]=props=>React.createElement('div',props))}))
      return stubs.get(name)
    }
    return require(name)
  },{fetch:(url,options)=>new Promise(resolve=>state.calls.push({url,options,resolve}))})
  const props={appointment,open:true,onOpenChange:value=>state.closed.push(value),onPaid:value=>state.paid.push(value)}
  const render=()=>{cursor=0;tree=exported.AppointmentCheckoutDialog(props);while(effects.length)effects.shift()();return tree}
  const find=(label)=>walk(tree).find(node=>typeof node.props?.onClick==='function'&&text(node)===label)
  render();render()
  return {state,render,find,nodes:()=>walk(tree),text:()=>text(tree)}
}
async function main() {
  let ui=mount(part)
  assert.equal(ui.find('Carte bancaire').props['aria-pressed'],true)
  assert(ui.text().includes('Soin historique A + Soin historique B'))
  assert(ui.text().includes('Déjà réglé')&&ui.text().includes('65,00 €'))
  const primary=ui.find('Valider l’encaissement · 15,00 €')
  const first=primary.props.onClick();const second=primary.props.onClick()
  assert.equal(ui.state.calls.length,1,'Synchronous double action must produce only one PATCH')
  assert.equal(JSON.parse(ui.state.calls[0].options.body).expected_updated_at,part.updated_at)
  assert.equal(JSON.parse(ui.state.calls[0].options.body).payments[0].amount_cents,1500)
  ui.state.calls[0].resolve({ok:true,json:async()=>({...part,payment_status:'paid'})});await Promise.all([first,second])
  await primary.props.onClick()
  assert.equal(ui.state.calls.length,1,'A completed response must not allow a stale click to charge again')
  assert.deepEqual(ui.state.closed,[false]);assert.equal(ui.state.paid.length,1)
  ui=mount(part);ui.find('Espèces').props.onClick();ui.render()
  const cash=ui.find('Valider l’encaissement · 15,00 €').props.onClick()
  assert.equal(JSON.parse(ui.state.calls[0].options.body).payments[0].method,'cash')
  ui.state.calls[0].resolve({ok:false,json:async()=>({error:'Version modifiée'})});await cash;ui.render()
  assert(ui.text().includes('Version modifiée'));assert.equal(ui.state.closed.length,0)
  const retry=ui.find('Valider l’encaissement · 15,00 €').props.onClick()
  assert.equal(ui.state.calls.length,2,'A rejected request unlocks the form')
  ui.state.calls[1].resolve({ok:true,json:async()=>({...part,payment_status:'paid'})});await retry
  ui=mount(part);ui.find('Paiement mixte ou autre moyen').props.onClick();ui.render()
  ui.nodes().find(node=>node.props?.inputMode==='decimal').props.onChange({target:{value:'10,01'}});ui.render()
  assert(ui.text().includes('Il reste 4,99 € à répartir.'))
  ui.find('Ajouter un moyen').props.onClick();ui.render()
  const split=ui.find('Valider l’encaissement · 15,00 €').props.onClick()
  assert.deepEqual(JSON.parse(ui.state.calls[0].options.body).payments,[{method:'card',amount_cents:1001},{method:'cash',amount_cents:499}])
  ui.state.calls[0].resolve({ok:true,json:async()=>({...part,payment_status:'paid'})});await split
  ui=mount(booking({payment_status:'paid',amount_paid_cents:0}))
  assert(ui.text().includes('Rendez-vous déjà réglé'));assert(ui.text().includes('0,00 €'))
  assert(!ui.nodes().some(node=>text(node).startsWith('Valider l’encaissement')&&node.props?.onClick))
  assert.equal(ui.state.calls.length,0)
  console.log('PASS: real checkout component defaults to card, supports cash/mixed, reports inline errors and blocks double/stale actions without any real network')
}
main().catch(error=>{console.error(error);process.exitCode=1})

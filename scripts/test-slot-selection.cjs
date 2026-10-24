const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')
const root = path.resolve(__dirname, '..')
const cache = new Map()
function load(file) {
  const filename = path.join(root, file)
  if (cache.has(filename)) return cache.get(filename)
  const exports = {}
  cache.set(filename, exports)
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, { exports, require(name) {
    return name.startsWith('@/') ? load(name.slice(2) + '.ts') : require(name)
  }, Intl, Date, console }, { filename })
  return exports
}
const { scheduleContextKey, getSelectableSlots, reconcileSlotSelection, chooseScheduleSlot } = load('lib/calendar/slot-selection.ts')
const context = { salonId:'salon-a', serviceId:'solo', date:'2099-11-02', requiredStaff:1, durationMinutes:60 }
const staff = ['a','b','c'].map(id=>({ id, salon_id:'salon-a', first_name:id, last_name:'', role:'therapist',is_active:true,allowed_service_ids:[] }))
staff.push({ ...staff[0],id:'foreign',salon_id:'salon-b' }, { ...staff[0],id:'inactive',is_active:false }, { ...staff[0],id:'reception',role:'receptionist' },{ ...staff[0],id:'restricted',allowed_service_ids:['another-service'] })
const slot = (start, end, available_staff) => ({ start:`2099-11-02T${start}:00Z`,end:`2099-11-02T${end}:00Z`,available_staff })
const morning = slot('09:00','10:00',['a','b','foreign','inactive','reception','restricted','a'])
const afternoon = slot('14:00','15:00',['b','c'])
const slots = getSelectableSlots(context,[morning,afternoon],staff)
assert.deepEqual(Array.from(slots[0].available_staff),['a','b'])
assert.equal(slots.length,2)
console.log('PASS: every slot lists only active, qualified staff of the selected salon; duplicates removed')
let selection = chooseScheduleSlot(context,{context:'',start:'',staffIds:[]},slots[0])
assert.equal(selection.staffIds.length,0,'Choosing a time must not silently choose among multiple staff')
selection.staffIds=['a']
assert.equal(reconcileSlotSelection(context,selection,slots).staffIds.length,1)
selection=chooseScheduleSlot(context,selection,slots[1])
assert.equal(selection.staffIds.length,0,'Unavailable staff must not follow the user to a different time')
assert.equal(selection.start,afternoon.start)
console.log('PASS: time comes first; changing time removes an incompatible practitioner without hiding other slots')
selection={context:scheduleContextKey(context),start:morning.start,staffIds:['a']}
for(const next of [{...context,date:'2099-11-03'},{...context,salonId:'salon-b'},{...context,serviceId:'duo'},{...context,durationMinutes:90},{...context,serviceIds:['solo','extra']}]) {
  const reconciled=reconcileSlotSelection(next,selection,slots)
  assert.equal(reconciled.start,'')
  assert.equal(reconciled.staffIds.length,0)
}
assert.equal(reconcileSlotSelection(context,selection,[slots[1]]).start,'')
console.log('PASS: date, salon, service and duration changes invalidate stale selections immediately')
const updated=[{...slots[0],available_staff:['b']}]
const reconciled=reconcileSlotSelection(context,selection,updated)
assert.equal(reconciled.start,morning.start)
assert.equal(reconciled.staffIds.length,0)
console.log('PASS: live staff changes preserve the slot but require a new available practitioner')
const duo={...context,requiredStaff:2}
const duoSlots=getSelectableSlots(duo,[{...morning,available_staff:['a']},afternoon],staff)
assert.equal(duoSlots.length,1)
const duoSelection=chooseScheduleSlot(duo,selection,duoSlots[0])
assert.deepEqual(Array.from(duoSelection.staffIds),['b','c'])
assert.equal(duoSelection.staffIds.length,2)
console.log('PASS: duo slots require two simultaneous full-duration practitioners; the only eligible team is preselected')
const invalid=[slot('09:00','09:30',['a','b']),{...morning,start:'invalid'}, {...morning,start:'2099-11-03T09:00:00Z',end:'2099-11-03T10:00:00Z'}]
assert.equal(getSelectableSlots(context,invalid,staff).length,0)
assert.equal(getSelectableSlots(context,[morning],staff,Date.parse(morning.start)+1).length,0)
assert.equal(getSelectableSlots(context,[],staff).length,0)
const evening=slot('19:00','20:00',['a'])
const many=getSelectableSlots(context,[...Array.from({length:28},(_,i)=>slot(`${String(8+Math.floor(i/4)).padStart(2,'0')}:${String(i%4*15).padStart(2,'0')}`,`${String(9+Math.floor(i/4)).padStart(2,'0')}:${String(i%4*15).padStart(2,'0')}`,['a'])),evening],staff)
assert.ok(many.some(item=>item.start===evening.start))
console.log('PASS: malformed, past, wrong-day and short slots rejected; evening slots never truncated')
const midnight={start:'2099-06-14T22:00:00Z',end:'2099-06-14T23:00:00Z',available_staff:['a']}
assert.equal(getSelectableSlots({...context,date:'2099-06-15'},[midnight],staff).length,1)
assert.equal(getSelectableSlots({...context,date:'2099-06-14'},[midnight],staff).length,0)
console.log('PASS: slot calendar dates use Paris time even when the UTC date differs')
const { ClientDataSchema } = load('lib/appointments/client-data.ts')
const contact=ClientDataSchema.parse({first_name:'  Camille ',last_name:' Test ',phone:'06 01-02.03.04',email:' client@example.com '})
assert.equal(contact.first_name,'Camille')
assert.equal(contact.phone,'0601020304')
assert.equal(contact.email,'client@example.com')
assert.equal(ClientDataSchema.safeParse({first_name:' ',last_name:'Test',phone:'123'}).success,false)
assert.equal(ClientDataSchema.safeParse({...contact,email:'bad'}).success,false)
console.log('PASS: client/server share contact validation and normalization')

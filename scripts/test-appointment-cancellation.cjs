const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const ts = require('typescript');
const Module = require('node:module');
const statusModule = new Module(require('node:path').join(process.cwd(), 'status-test.cjs'));
statusModule._compile(ts.transpileModule(fs.readFileSync('lib/appointments/status.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, statusModule.id);
const source = fs.readFileSync('app/api/appointments/[id]/route.ts', 'utf8');
const serviceSelectionModule = new Module(require('node:path').join(process.cwd(), 'service-selection-test.cjs'));
serviceSelectionModule._compile(ts.transpileModule(fs.readFileSync('lib/appointments/service-selection.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, serviceSelectionModule.id);
async function scenario(status, body, conflict) {
  let validations = 0;
  let persisted;
  const existing = { id: 'appointment', status, salon_id: 'salon', service_id: 'service', staff_id: 'staff', start_time: '2099-11-02T10:00:00Z', end_time: '2099-11-02T11:00:00Z', assignments: [] };
  const db = { from(table) {
    let update;
    const q = {
      select() { return q }, eq() { return q },
      update(value) { update = value; return q },
      async single() { if (update) persisted = update; return { data: update ? { ...existing, ...update } : existing, error: null } },
      then(resolve) { return Promise.resolve({ data: [], error: null }).then(resolve) }
    };
    return q;
  }};
  const mod = { exports: {} };
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, {
    exports: mod.exports,
    require(name) {
      if (name === '@/lib/appointments/status') return statusModule.exports;
      if (name === '@/lib/appointments/service-selection') return serviceSelectionModule.exports;
      if (name === '@/lib/supabase/admin') return { createAdminClient: () => db };
      if (name === '@/lib/appointments/create') return { validateAppointmentScheduling: async () => { validations++; if (conflict) throw new Error('conflict'); return { endTime: '2026-11-02T11:00:00Z' } } };
      if (name === '@/lib/auth/api-auth') return { requireStaffAuth: () => ({ payload: { role: 'admin' } }) };
      if (name === 'next/server') return { NextResponse: { json: (data, init) => ({ data, status: init?.status || 200 }) } };
      return require(name);
    }
  });
  const result = await mod.exports.PATCH({ json: async () => body }, { params: Promise.resolve({ id: 'appointment' }) });
  return { result, validations, persisted };
}
(async () => {
  const cancel = await scenario('confirmed', { status: 'cancelled' }, false);
  assert.equal(cancel.result.status, 200);
  assert.equal(cancel.persisted.status, 'cancelled');
  console.log('PASS: simple cancellation persists cancelled and does not require scheduling validation.');
  const reactivate = await scenario('cancelled', { status: 'confirmed' }, true);
  assert.equal(reactivate.result.status, 500);
  assert.equal(reactivate.validations, 1);
  console.log('PASS: reactivation checks conflicts and rejects an occupied slot.');
  assert.equal(reactivate.persisted, undefined);
  const freeReactivation = await scenario('cancelled', { status: 'confirmed' }, false);
  assert.equal(freeReactivation.result.status, 200);
  assert.equal(freeReactivation.validations, 1);
  assert.equal(freeReactivation.persisted.status, 'confirmed');
  console.log('PASS: reactivation succeeds when scheduling validation passes.');
  const repeatedCancel = await scenario('cancelled', { status: 'cancelled' }, true);
  assert.equal(repeatedCancel.result.status, 200);
  assert.equal(repeatedCancel.validations, 0);
  assert.equal(repeatedCancel.persisted.status, 'cancelled');
  console.log('PASS: repeated cancellation is safe.');
  const editCancel = await scenario('confirmed', { status: 'cancelled', start_time: '2026-11-02T10:00:00Z' }, true);
  assert.equal(editCancel.result.status, 200);
  assert.equal(editCancel.persisted.status, 'cancelled'); assert.equal(editCancel.persisted.start_time, undefined); assert.equal(editCancel.validations, 0);
  console.log('PASS: cancellation through edit preserves history and bypasses conflicts.');
})().catch(error => { console.error(error); process.exitCode = 1 });

const assert = require('node:assert/strict')
const fs = require('node:fs'), vm = require('node:vm'), ts = require('typescript'), path = require('node:path')
let skipped = false, smsEnabled = true, emailEnabled = false
const deliveries = []
const moduleObject = { exports: {} }
const filename = path.resolve(__dirname, '../lib/email/appointment-management.ts')
vm.runInNewContext(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, {
  exports: moduleObject.exports, process,
  require(name) {
    if (name.includes('supabase/admin')) return { createAdminClient() { throw Error('Live database forbidden in this test') } }
    if (name.includes('appointments/management-policy')) return { MANAGEMENT_RULE: 'Veille uniquement', MANAGEMENT_REFUND: 'Contacter le salon' }
    if (name.includes('appointments/management')) return { issueManagementLink: async () => 'https://example.test/mon-rendez-vous#cle=TEST' }
    if (name === './resend') return { get isEmailEnabled() { return emailEnabled }, sendEmail: async value => { deliveries.push(value); return { id: 'test-email' } } }
    if (name === './templates/sms') return { get isSmsEnabled() { return smsEnabled }, sendSms: async value => { deliveries.push(value); return skipped ? { skipped: true, reason: 'invalid_phone' } : { id: 'test-sms' } } }
    if (name === './html') return { escapeEmailHtml: value => String(value ?? '').replaceAll('<', '&lt;').replaceAll('>', '&gt;') }
    if (name.includes('service-selection')) return { presentAppointmentServices: value => value }
    throw Error(`Unexpected import: ${name}`)
  },
}, { filename })
async function main() {
  const notifications = moduleObject.exports
  const appointment = { start_time: '2099-11-02T10:00:00Z', client: { phone: 'INVALID', email: 'test@example.test' }, salon: { name: '<salon>' }, service: { name: '<soin>' } }
  skipped = true
  await assert.rejects(notifications.sendManagementLinkToClient(appointment), /échoué/)
  await assert.rejects(notifications.sendAppointmentClientChangedNotifications(appointment, 'cancel', appointment.start_time), /notification/)
  emailEnabled = true
  await notifications.sendManagementLinkToClient(appointment) // Email succeeds even if SMS is skipped.
  assert.ok(deliveries.some(value => value.html?.includes('&lt;salon&gt;')))
  assert.ok(deliveries.some(value => value.html?.includes('/mon-rendez-vous#cle=TEST')))
  skipped = false
  await notifications.sendAppointmentClientChangedNotifications(appointment, 'reschedule', appointment.start_time)
  emailEnabled = false; smsEnabled = false
  await assert.rejects(notifications.sendAppointmentClientChangedNotifications(appointment, 'cancel', appointment.start_time), /notification/)
  console.log('PASS: skipped SMS never reports delivery; email fallback, link content and disabled providers verified without live sends')
}
main().catch(error => { console.error(error); process.exitCode = 1 })

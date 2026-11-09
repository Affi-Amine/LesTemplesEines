// The booking confirmation is the only thing a client gets after reserving, and
// nothing in the UI reports its failure. These cases pin the delivery rules:
// every recipient is attempted, one refusal never cancels the others, and a slow
// management link never costs the confirmation itself.
const assert = require('node:assert/strict')
const fs = require('node:fs'), vm = require('node:vm'), ts = require('typescript'), path = require('node:path')

process.env.MANAGEMENT_LINK_TIMEOUT_MS = '50'
delete process.env.NOTIFICATIONS_ADMIN_EMAIL

let emailEnabled = true, smsEnabled = false
let sendEmailImpl = async () => ({ data: { id: 'email-id' } })
let sendSmsImpl = async () => ({ id: 'sms-id' })
let issueLinkImpl = async () => 'https://example.test/mon-rendez-vous#cle=TEST'
const sent = []
let inFlight = 0, peakInFlight = 0

const track = (channel, impl) => async (value) => {
  inFlight += 1
  peakInFlight = Math.max(peakInFlight, inFlight)
  try {
    const result = await impl(value)
    sent.push({ channel, to: value.to, subject: value.subject, html: value.html, message: value.message })
    return result
  } finally {
    inFlight -= 1
  }
}

const moduleObject = { exports: {} }
const filename = path.resolve(__dirname, '../lib/email/notifications.ts')
vm.runInNewContext(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText, {
  exports: moduleObject.exports, process, console, setTimeout, clearTimeout,
  require(name) {
    if (name.includes('appointments/management')) return { issueManagementLink: (...args) => issueLinkImpl(...args) }
    if (name === './resend') return {
      get isEmailEnabled() { return emailEnabled },
      sendEmail: track('email', value => sendEmailImpl(value)),
    }
    if (name === './templates/sms') return {
      get isSmsEnabled() { return smsEnabled },
      sendSms: track('sms', value => sendSmsImpl(value)),
    }
    if (name.includes('appointment-confirmation-client')) return {
      clientAppointmentBookedSubject: ({ salonName }) => `Votre rendez-vous est confirmé – ${salonName}`,
      clientAppointmentBookedHtml: (appointment, link) => `<p>client ${appointment.id} ${link || 'sans-lien'}</p>`,
    }
    if (name.includes('appointment-new-booking-admin')) return {
      adminAppointmentBookedSubject: ({ bookingSource }) => `Nouvelle réservation (${bookingSource})`,
      adminAppointmentBookedHtml: appointment => `<p>admin ${appointment.id}</p>`,
    }
    throw Error(`Unexpected import: ${name}`)
  },
}, { filename })

const { sendAppointmentBookedEmails } = moduleObject.exports

const booking = (overrides = {}) => ({
  id: 'appointment-1',
  start_time: '2099-11-02T10:00:00Z',
  end_time: '2099-11-02T11:00:00Z',
  status: 'confirmed',
  salon: { name: 'Les Temples Bastille' },
  service: { name: 'Massage thaï' },
  ...overrides,
  client: { email: 'cliente@example.test', phone: '+33600000000', ...(overrides.client || {}) },
})

function reset() {
  sent.length = 0
  inFlight = 0
  peakInFlight = 0
  emailEnabled = true
  smsEnabled = false
  sendEmailImpl = async () => ({ data: { id: 'email-id' } })
  sendSmsImpl = async () => ({ id: 'sms-id' })
  issueLinkImpl = async () => 'https://example.test/mon-rendez-vous#cle=TEST'
}

async function main() {
  // The client and the salon are both told, and the link reaches the client.
  reset()
  let outcomes = await sendAppointmentBookedEmails(booking(), { bookingSource: 'client' })
  assert.equal(sent.length, 2, 'the client and the salon are both notified')
  assert.equal(sent[0].to, 'cliente@example.test')
  assert.equal(Array.from(sent[1].to).join(), 'reservations@les-temples.com')
  assert.match(sent[0].html, /mon-rendez-vous#cle=TEST/)
  assert.ok(outcomes.every(outcome => outcome.status === 'sent'), 'every delivery is reported as sent')
  assert.equal(peakInFlight, 1, 'confirmations leave one at a time: two at once sit on Resend’s 2 req/s limit')

  // A provider refusing the client mail must not cost the salon its copy. The
  // call still resolves, because the booking is already saved.
  reset()
  sendEmailImpl = async value => {
    if (value.to === 'cliente@example.test') throw new Error('Too many requests')
    return { data: { id: 'admin-id' } }
  }
  outcomes = await sendAppointmentBookedEmails(booking())
  assert.equal(sent.length, 1, 'the salon copy is sent although the client copy failed')
  assert.equal(Array.from(sent[0].to).join(), 'reservations@les-temples.com')
  assert.equal(outcomes.find(outcome => outcome.to === 'cliente@example.test').status, 'failed')
  assert.match(outcomes.find(outcome => outcome.to === 'cliente@example.test').detail, /Too many requests/)

  // A management link that never comes back must not hold the confirmation.
  reset()
  issueLinkImpl = () => new Promise(() => {})
  const startedAt = Date.now()
  outcomes = await sendAppointmentBookedEmails(booking())
  assert.ok(Date.now() - startedAt < 2000, 'a hanging link insert does not block the confirmation')
  assert.equal(sent.length, 2)
  assert.match(sent[0].html, /sans-lien/, 'the client is written to without a link rather than not at all')
  assert.ok(outcomes.every(outcome => outcome.status === 'sent'))

  // Same when the link table is missing altogether.
  reset()
  issueLinkImpl = async () => { throw new Error('relation "appointment_management_links" does not exist') }
  await sendAppointmentBookedEmails(booking())
  assert.equal(sent.length, 2, 'a missing link table still lets both confirmations out')

  // A client who gave no email still produces the salon notification.
  reset()
  outcomes = await sendAppointmentBookedEmails(booking({ client: { email: null } }))
  assert.equal(sent.length, 1)
  assert.equal(Array.from(sent[0].to).join(), 'reservations@les-temples.com')
  assert.equal(outcomes.length, 1)

  // No Resend key: nothing is attempted and nothing throws.
  reset()
  emailEnabled = false
  outcomes = await sendAppointmentBookedEmails(booking())
  assert.equal(sent.length, 0, 'a disabled provider sends nothing')
  assert.equal(outcomes.length, 0)

  // An SMS the provider declines is reported as skipped, never as delivered.
  reset()
  smsEnabled = true
  sendSmsImpl = async () => ({ skipped: true, reason: 'invalid_phone' })
  outcomes = await sendAppointmentBookedEmails(booking())
  const sms = outcomes.find(outcome => outcome.channel === 'sms')
  assert.equal(sms.status, 'skipped')
  assert.equal(sms.detail, 'invalid_phone')
  assert.equal(peakInFlight, 1, 'the SMS waits its turn too')

  // Every provider down: the caller still gets a report instead of an exception.
  reset()
  smsEnabled = true
  sendEmailImpl = async () => { throw new Error('domain is not verified') }
  sendSmsImpl = async () => { throw new Error('gateway down') }
  outcomes = await sendAppointmentBookedEmails(booking())
  assert.equal(outcomes.length, 3)
  assert.ok(outcomes.every(outcome => outcome.status === 'failed'))

  console.log('PASS: both confirmations are attempted one at a time, a refused or slow one never cancels the rest, and every outcome is reported')
}

main().catch(error => { console.error(error); process.exitCode = 1 })

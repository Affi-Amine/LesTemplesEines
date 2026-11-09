const assert = require("node:assert/strict")
const fs = require("node:fs")
const path = require("node:path")
const vm = require("node:vm")
const ts = require("typescript")
const root = path.resolve(__dirname, "..")
const cache = new Map()
function load(file) {
  if (cache.has(file)) return cache.get(file)
  const exports = {}
  cache.set(file, exports)
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(root, file), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, { exports, require(name) {
    return name.startsWith("@/") ? load(name.slice(2) + ".ts") : require(name)
  } })
  return exports
}
const { countAppointmentPrestations } = load("lib/calendar/scheduling.ts")
const appointment = (id, status = "confirmed", duo = false) => ({
  id, status, staff_id: "a", start_time: "2026-11-05T10:00:00Z", end_time: "2026-11-05T11:00:00Z",
  // Repeated primary staff must not count twice.
  assignments: [{ staff_id: "a" }, ...(duo ? [{ staff_id: "b" }, { staff_id: "b" }] : [])],
})
const day = [
  ...Array.from({ length: 31 }, (_, i) => appointment(`simple-${i}`)),
  ...Array.from({ length: 14 }, (_, i) => appointment(`duo-${i}`, "confirmed", true)),
  ...["cancelled", "no_show", "blocked"].map(status => appointment(status, status, true)),
]
assert.equal(JSON.stringify(countAppointmentPrestations(day)), JSON.stringify({ singles: 31, duos: 14, total: 59 }))
assert.equal(JSON.stringify(countAppointmentPrestations([])), JSON.stringify({ singles: 0, duos: 0, total: 0 }))
assert.equal(countAppointmentPrestations([appointment("done", "completed"), appointment("ongoing", "in_progress")]).total, 2)
console.log("PASS: 31 simples + 14 duos = 59 prestations; exclusions, duplicate assignments, completed appointments and empty day")

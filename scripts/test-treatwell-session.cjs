const assert = require("node:assert/strict")
const fs = require("node:fs")
const path = require("node:path")
const vm = require("node:vm")

const root = path.resolve(__dirname, "..")
const ts = require(path.join(root, "node_modules/typescript"))

const modules = new Map()
function load(relative) {
  const filename = path.join(root, relative)
  if (modules.has(filename)) return modules.get(filename).exports
  const mod = { exports: {} }
  modules.set(filename, mod)
  const source = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText
  vm.runInNewContext(source, {
    exports: mod.exports, process, console, URL, URLSearchParams, Buffer,
    require(name) {
      if (name.startsWith("@/")) return load(`${name.slice(2)}.ts`)
      return require(name)
    },
  }, { filename })
  return mod.exports
}

const { parseTreatwellSessionInput } = load("lib/sync/treatwell-session.ts")

// 1. Raw Cookie header (existing format still works)
let s = parseTreatwellSessionInput("ATKT=abc123; ITKT=def456; extranet.currentVenueId=987")
assert.equal(s.cookies.length, 3)
assert.ok(s.cookies.some(c => c.name === "ATKT" && c.value === "abc123"))
console.log("PASS: raw cookie header")

// 2. Chrome "Copy as cURL (bash)"
const bash = `curl 'https://connect.treatwell.fr/api/calendar' \\
  -H 'accept: application/json' \\
  -H 'cookie: ATKT=abc123; ITKT=def456; extranet.currentVenueId=987' \\
  -H 'user-agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/130.0' \\
  --compressed`
s = parseTreatwellSessionInput(bash)
assert.equal(s.cookies.length, 3)
assert.equal(s.cookies.find(c => c.name === "ITKT").value, "def456")
assert.match(s.userAgent, /Mozilla/)
console.log("PASS: cURL bash")

// 3. Chrome "Copy as cURL (cmd)" — caret escapes and ^ line continuations
const cmd = `curl ^"https://connect.treatwell.fr/api/calendar^" ^
  -H ^"accept: application/json^" ^
  -H ^"cookie: ATKT=abc123; ITKT=def456^" ^
  -H ^"user-agent: Mozilla/5.0 Chrome/130.0^"`
s = parseTreatwellSessionInput(cmd)
assert.equal(s.cookies.length, 2)
assert.equal(s.cookies.find(c => c.name === "ATKT").value, "abc123")
console.log("PASS: cURL cmd")

// 4. cURL with -b flag
s = parseTreatwellSessionInput(`curl 'https://connect.treatwell.fr/' -b 'ATKT=x1; ITKT=y2'`)
assert.equal(s.cookies.length, 2)
console.log("PASS: cURL -b flag")

// 5. HAR export
const har = JSON.stringify({
  log: { entries: [
    { request: { url: "https://static.cdn.com/app.js", headers: [] } },
    { request: { url: "https://connect.treatwell.fr/login", headers: [{ name: "Cookie", value: "cf_clearance=zz" }] } },
    { request: { url: "https://connect.treatwell.fr/api/calendar", headers: [
      { name: "Cookie", value: "ATKT=harA; ITKT=harB; extranet.currentVenueId=55" },
      { name: "User-Agent", value: "Mozilla/5.0 HAR" },
    ] } },
  ] },
})
s = parseTreatwellSessionInput(har)
assert.equal(s.cookies.length, 3)
assert.equal(s.cookies.find(c => c.name === "ATKT").value, "harA")
assert.equal(s.userAgent, "Mozilla/5.0 HAR")
console.log("PASS: HAR export")

// 6. Session JSON (existing format still works)
s = parseTreatwellSessionInput(JSON.stringify({ cookies: [{ name: "ATKT", value: "j1" }, { name: "ITKT", value: "j2" }] }))
assert.equal(s.cookies.length, 2)
console.log("PASS: session JSON")

// 7. Errors stay explicit
assert.throws(() => parseTreatwellSessionInput("curl 'https://connect.treatwell.fr/'"), /cURL/)
assert.throws(() => parseTreatwellSessionInput("session_pref=1; theme=dark"), /ATKT \/ ITKT/)
assert.throws(() => parseTreatwellSessionInput(JSON.stringify({ log: { entries: [] } })), /HAR/)
console.log("PASS: explicit errors (no cookie in cURL, no auth cookies, empty HAR)")

console.log("All session parser tests passed.")

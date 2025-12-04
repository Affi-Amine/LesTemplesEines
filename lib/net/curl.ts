import { spawn } from "child_process"
import { URL } from "url"
import { httpRequest } from "@/lib/net/http" // fallback if curl not available

export async function curlRequest(
  url: string,
  opts: { method: string; headers?: Record<string, string>; body?: string },
  timeoutMs: number,
): Promise<{ status: number; bodyText: string }> {
  const u = new URL(url)
  const args = [
    "--silent",
    "--show-error",
    "--location",
    "--max-time",
    String(Math.ceil(timeoutMs / 1000)),
    "--request",
    opts.method,
  ]
  const resolveIp = process.env.SMS_RESOLVE_IP || ""
  if (resolveIp && u.protocol === "https:") args.push("--resolve", `${u.hostname}:443:${resolveIp}`)
  if (opts.headers) {
    for (const [k, v] of Object.entries(opts.headers)) args.push("-H", `${k}: ${v}`)
  }
  if (opts.body) args.push("--data", opts.body)
  args.push("--write-out", "\n%{http_code}")
  args.push(url)

  return new Promise((resolve, reject) => {
    let child
    try {
      child = spawn("curl", args)
    } catch (spawnErr: any) {
      // spawn threw synchronously (e.g., not allowed). Fallback to httpRequest
      console.warn("[curl] spawn failed synchronously, falling back to httpRequest:", spawnErr)
      httpRequest(url, { method: opts.method, headers: opts.headers, body: opts.body }, timeoutMs)
        .then(resolve)
        .catch(reject)
      return
    }

    const chunks: Buffer[] = []
    let stderr = ""

    // If curl binary is not found, an 'error' event with code ENOENT is typically emitted.
    child.on("error", (e: any) => {
      // Fallback to httpRequest for environments without curl (serverless)
      if (e && e.code === "ENOENT") {
        console.warn('[curl] curl binary not found (ENOENT), falling back to httpRequest')
        httpRequest(url, { method: opts.method, headers: opts.headers, body: opts.body }, timeoutMs)
          .then(resolve)
          .catch(reject)
        return
      }
      reject(e)
    })

    child.stdout.on("data", (d) => chunks.push(Buffer.isBuffer(d) ? d : Buffer.from(d)))
    child.stderr.on("data", (d) => (stderr += d.toString()))

    child.on("close", (code) => {
      if (code !== 0) return reject(new Error(stderr || `curl exited ${code}`))
      const text = Buffer.concat(chunks).toString("utf8")
      const idx = text.lastIndexOf("\n")
      const bodyText = idx >= 0 ? text.slice(0, idx) : text
      const statusStr = idx >= 0 ? text.slice(idx + 1).trim() : "0"
      const status = Number(statusStr || 0)
      resolve({ status, bodyText })
    })
  })
}

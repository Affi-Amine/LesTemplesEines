import http from "http"
import https from "https"
import { URL } from "url"

export async function httpRequest(
  urlStr: string,
  opts: { method: string; headers?: Record<string, string>; body?: string },
  timeoutMs: number,
): Promise<{ status: number; bodyText: string }> {
  const u = new URL(urlStr)
  const isHttps = u.protocol === "https:"
  const mod = isHttps ? https : http
  const agent = isHttps ? new https.Agent({ keepAlive: true }) : new http.Agent({ keepAlive: true })
  return new Promise((resolve, reject) => {
    const req = mod.request(
      {
        protocol: u.protocol,
        hostname: u.hostname,
        port: u.port || (isHttps ? 443 : 80),
        path: u.pathname + (u.search || ""),
        method: opts.method,
        headers: opts.headers,
        agent,
      },
      (res) => {
        const chunks: Buffer[] = []
        res.on("data", (d) => chunks.push(Buffer.isBuffer(d) ? d : Buffer.from(d)))
        res.on("end", () => {
          const bodyText = Buffer.concat(chunks).toString("utf8")
          resolve({ status: res.statusCode || 0, bodyText })
        })
      },
    )
    req.setTimeout(timeoutMs, () => {
      req.destroy(new Error("timeout"))
    })
    req.on("error", (err) => reject(err))
    if (opts.body) req.write(opts.body)
    req.end()
  })
}

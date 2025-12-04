"use client"

import { useState } from "react"

export default function SmsTestPage() {
  const [to, setTo] = useState("+33600000000")
  const [message, setMessage] = useState("Test SMS depuis /test")
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const [checking, setChecking] = useState(false)
  const [pendingResult, setPendingResult] = useState<string>("")
  const [smsId, setSmsId] = useState<string>("")
  const [marking, setMarking] = useState(false)

  async function send() {
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const res = await fetch("/api/sms-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to, message }),
      })
      const data = await res.json()
      if (!res.ok || data?.ok === false) {
        throw new Error(data?.error || `HTTP ${res.status}`)
      }
      setResult(data?.result)
    } catch (err: any) {
      setError(err?.message || "Unknown error")
    } finally {
      setLoading(false)
    }
  }

  async function checkPending() {
    setChecking(true)
    setPendingResult("")
    try {
      const res = await fetch("/api/sms-test/pending")
      const data = await res.json()
      setPendingResult(JSON.stringify(data, null, 2))
    } catch (err: any) {
      setPendingResult(`Error: ${err?.message || "Unknown error"}`)
    } finally {
      setChecking(false)
    }
  }

  async function markSent() {
    if (!smsId) {
      setError("Provide sms_id to mark as sent")
      return
    }
    setMarking(true)
    setError(null)
    try {
      const res = await fetch(`/api/sms-test/mark-sent/${encodeURIComponent(smsId)}`, {
        method: "PATCH",
      })
      const data = await res.json()
      setResult(data)
    } catch (err: any) {
      setError(err?.message || "Unknown error")
    } finally {
      setMarking(false)
    }
  }

  return (
    <div style={{ maxWidth: 640, margin: "40px auto", padding: 16 }}>
      <h1 style={{ fontSize: 22, fontWeight: 600 }}>SMS Test</h1>
      <p style={{ color: "#555" }}>
        Envoie un SMS via l'API serveur. Le bouton appelle <code>/api/sms-test</code>.
      </p>

      <div style={{ display: "grid", gap: 12, marginTop: 16 }}>
        <label style={{ display: "grid", gap: 6 }}>
          <span>Numéro (E.164 recommandé, ex. +33...)</span>
          <input
            value={to}
            onChange={(e) => setTo(e.target.value)}
            placeholder="+33XXXXXXXXX"
            style={{ padding: 10, border: "1px solid #ccc", borderRadius: 6 }}
          />
        </label>

        <label style={{ display: "grid", gap: 6 }}>
          <span>Message</span>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={3}
            style={{ padding: 10, border: "1px solid #ccc", borderRadius: 6 }}
          />
        </label>

        <button
          onClick={send}
          disabled={loading}
          style={{
            padding: "10px 14px",
            borderRadius: 6,
            border: "1px solid #222",
            background: loading ? "#ddd" : "#111",
            color: loading ? "#333" : "#fff",
            cursor: loading ? "not-allowed" : "pointer",
          }}
        >
          {loading ? "Envoi..." : "Envoyer le SMS"}
        </button>
      </div>

      {error && (
        <pre style={{ marginTop: 16, color: "#b00020" }}>Erreur: {error}</pre>
      )}
      {result && (
        <pre style={{ marginTop: 16, background: "#f7f7f7", padding: 12 }}>
          {JSON.stringify(result, null, 2)}
        </pre>
      )}

      <hr style={{ margin: "24px 0" }} />
      <h2 style={{ fontSize: 18, fontWeight: 600 }}>Diagnostics fournisseur</h2>
      <div style={{ display: "grid", gap: 12, marginTop: 12 }}>
        <button
          onClick={checkPending}
          disabled={checking}
          style={{
            padding: "10px 14px",
            borderRadius: 6,
            border: "1px solid #222",
            background: checking ? "#ddd" : "#111",
            color: checking ? "#333" : "#fff",
            cursor: checking ? "not-allowed" : "pointer",
          }}
        >
          {checking ? "Vérif..." : "Lister /sms/pending"}
        </button>
        {pendingResult && (
          <pre style={{ background: "#f7f7f7", padding: 12 }}>
            {pendingResult}
          </pre>
        )}
        <div style={{ display: "grid", gap: 8 }}>
          <label style={{ display: "grid", gap: 6 }}>
            <span>sms_id à marquer comme envoyé</span>
            <input
              value={smsId}
              onChange={(e) => setSmsId(e.target.value)}
              placeholder="uuid"
              style={{ padding: 10, border: "1px solid #ccc", borderRadius: 6 }}
            />
          </label>
          <button
            onClick={markSent}
            disabled={marking}
            style={{
              padding: "10px 14px",
              borderRadius: 6,
              border: "1px solid #222",
              background: marking ? "#ddd" : "#111",
              color: marking ? "#333" : "#fff",
              cursor: marking ? "not-allowed" : "pointer",
            }}
          >
            {marking ? "Marque..." : "PATCH /sms/{id}/mark-sent"}
          </button>
        </div>
      </div>
    </div>
  )
}

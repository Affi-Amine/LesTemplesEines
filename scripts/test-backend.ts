import fetch from "node-fetch"

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000"

interface TestResult {
  name: string
  status: "pass" | "fail"
  message: string
}

const results: TestResult[] = []

async function test(name: string, fn: () => Promise<void>) {
  try {
    await fn()
    results.push({ name, status: "pass", message: "Success" })
    console.log(`✓ ${name}`)
  } catch (error) {
    results.push({
      name,
      status: "fail",
      message: error instanceof Error ? error.message : String(error),
    })
    console.log(`✗ ${name}: ${error instanceof Error ? error.message : String(error)}`)
  }
}

async function runTests() {
  console.log("Starting backend tests...\n")

  // Test 1: Login endpoint
  await test("POST /api/auth/login - Valid credentials", async () => {
    const response = await fetch(`${BASE_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "admin@lestemples.fr",
        password: "admin123",
      }),
    })

    if (!response.ok) {
      throw new Error(`Expected 200, got ${response.status}`)
    }

    const data = (await response.json()) as { token?: string }
    if (!data.token) {
      throw new Error("No token in response")
    }
  })

  // Test 2: Login with invalid credentials
  await test("POST /api/auth/login - Invalid credentials", async () => {
    const response = await fetch(`${BASE_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "wrong@email.com",
        password: "wrongpassword",
      }),
    })

    if (response.ok) {
      throw new Error("Should have failed with invalid credentials")
    }
  })

  // Test 3: Get salons
  await test("GET /api/salons", async () => {
    const response = await fetch(`${BASE_URL}/api/salons`)

    if (!response.ok) {
      throw new Error(`Expected 200, got ${response.status}`)
    }

    const data = (await response.json()) as { salons?: unknown[] }
    if (!Array.isArray(data.salons)) {
      throw new Error("Expected salons array in response")
    }
  })

  // Test 4: Get services
  await test("GET /api/services", async () => {
    const response = await fetch(`${BASE_URL}/api/services`)

    if (!response.ok) {
      throw new Error(`Expected 200, got ${response.status}`)
    }

    const data = (await response.json()) as { services?: unknown[] }
    if (!Array.isArray(data.services)) {
      throw new Error("Expected services array in response")
    }
  })

  // Test 5: Get clients
  await test("GET /api/clients", async () => {
    const response = await fetch(`${BASE_URL}/api/clients`)

    if (!response.ok) {
      throw new Error(`Expected 200, got ${response.status}`)
    }

    const data = (await response.json()) as { clients?: unknown[] }
    if (!Array.isArray(data.clients)) {
      throw new Error("Expected clients array in response")
    }
  })

  // Test 6: Create appointment
  await test("POST /api/appointments - Create booking", async () => {
    const response = await fetch(`${BASE_URL}/api/appointments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        salon_id: "test-salon-1",
        service_id: "test-service-1",
        staff_id: "test-staff-1",
        client_phone: "+33612345678",
        client_name: "Test Client",
        start_time: new Date(Date.now() + 86400000).toISOString(),
      }),
    })

    if (!response.ok) {
      throw new Error(`Expected 200, got ${response.status}`)
    }

    const data = (await response.json()) as { appointment?: { id?: string } }
    if (!data.appointment?.id) {
      throw new Error("No appointment ID in response")
    }
  })

  // Print summary
  console.log("\n" + "=".repeat(50))
  const passed = results.filter((r) => r.status === "pass").length
  const failed = results.filter((r) => r.status === "fail").length
  console.log(`Tests completed: ${passed} passed, ${failed} failed`)
  console.log("=".repeat(50))

  if (failed > 0) {
    process.exit(1)
  }
}

runTests().catch((error) => {
  console.error("Test runner error:", error)
  process.exit(1)
})

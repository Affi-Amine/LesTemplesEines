"use client"

import { Card } from "@/components/ui/card"
import { BarChart3, PieChart as PieChartIcon, TrendingUp } from "lucide-react"
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid, LineChart, Line } from "recharts"

export function RevenueChart({ data }: { data?: { total_revenue_cents: number; total_appointments: number; period: { start: string; end: string } } }) {
  if (!data) {
    return (
      <Card className="p-6 h-full flex flex-col">
        <h3 className="font-semibold text-lg mb-4">Revenue & Bookings</h3>
        <div className="flex-1 min-h-[300px] flex items-center justify-center bg-muted/20 rounded-lg">
          <div className="text-center">
            <BarChart3 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">Loading revenue data...</p>
          </div>
        </div>
      </Card>
    )
  }

  const chartData = [
    {
      name: 'Current Period',
      revenue: data.total_revenue_cents / 100, // Convert cents to euros
      bookings: data.total_appointments,
    }
  ]

  return (
    <Card className="p-6 h-full flex flex-col">
      <h3 className="font-semibold text-lg mb-4">Revenue & Bookings</h3>
      <div className="flex-1 min-h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }} barGap={10} barCategoryGap="20%">
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis yAxisId="left" orientation="left" />
            <YAxis yAxisId="right" orientation="right" />
            <Tooltip 
              formatter={(value: number, name: string) => {
                if (name === 'revenue') return [`€${value.toFixed(2)}`, 'Revenue']
                if (name === 'bookings') return [value, 'Bookings']
                return [value, name]
              }}
            />
            <Legend />
            <Bar yAxisId="left" dataKey="revenue" fill="hsl(160, 60%, 50%)" name="Revenue (€)" />
            <Bar yAxisId="right" dataKey="bookings" fill="hsl(200, 60%, 60%)" name="Bookings" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  )
}

export function ServiceDistributionChart({ data }: { data?: Array<{ service_name: string; booking_count: number; revenue_cents: number }> }) {
  if (!data || data.length === 0) {
    return (
      <Card className="p-6">
        <h3 className="font-semibold text-lg mb-4">Service Distribution</h3>
        <div className="flex items-center justify-center h-[300px] bg-muted/20 rounded-lg">
          <div className="text-center">
            <PieChartIcon className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">No service data available</p>
          </div>
        </div>
      </Card>
    )
  }

  const chartData = data.map((service, index) => ({
    name: service.service_name,
    value: service.booking_count,
    revenue: service.revenue_cents / 100, // Convert cents to euros
    fill: `hsl(${160 + index * 40}, 60%, ${50 + index * 10}%)` // Generate colors based on the theme
  }))

  return (
    <Card className="p-6">
      <h3 className="font-semibold text-lg mb-4">Service Distribution</h3>
      <div className="h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={({ percent }) => `${(percent * 100).toFixed(0)}%`}
              outerRadius={80}
              fill="#8884d8"
              dataKey="value"
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.fill} />
              ))}
            </Pie>
            <Tooltip 
              formatter={(value: number, name: string, props: any) => [
                `${value} bookings`,
                name
              ]}
              labelFormatter={(label) => `Service: ${label}`}
            />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </Card>
  )
}

export function PaymentMethodChart({ data }: { data?: Array<{ method: string; count: number; revenue_cents: number }> }) {
  if (!data || data.length === 0) {
    return (
      <Card className="p-6">
        <h3 className="font-semibold text-lg mb-4">Modes de Paiement</h3>
        <div className="flex items-center justify-center h-[300px] bg-muted/20 rounded-lg">
          <div className="text-center">
            <PieChartIcon className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">Aucune donnée de paiement disponible</p>
          </div>
        </div>
      </Card>
    )
  }

  const formatMethod = (method: string) => {
    switch (method) {
      case 'card': return 'Carte Bancaire'
      case 'cash': return 'Espèces'
      case 'check': return 'Chèque'
      case 'other': return 'Autre'
      default: return method
    }
  }

  const chartData = data.map((item, index) => ({
    name: formatMethod(item.method),
    value: item.count,
    revenue: item.revenue_cents / 100,
    fill: `hsl(${200 + index * 40}, 60%, ${50 + index * 10}%)`
  }))

  return (
    <Card className="p-6">
      <h3 className="font-semibold text-lg mb-4">Modes de Paiement</h3>
      <div className="h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={({ percent }) => `${(percent * 100).toFixed(0)}%`}
              outerRadius={80}
              fill="#8884d8"
              dataKey="value"
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.fill} />
              ))}
            </Pie>
            <Tooltip 
              formatter={(value: number, name: string, props: any) => [
                `${value} paiements (€${props.payload.revenue.toFixed(2)})`,
                name
              ]}
            />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </Card>
  )
}

export function ClientRetentionChart({ data }: { data?: { total_clients: number } }) {
  if (!data) {
    return (
      <Card className="p-6">
        <h3 className="font-semibold text-lg mb-4">Client Retention</h3>
        <div className="flex items-center justify-center h-[300px] bg-muted/20 rounded-lg">
          <div className="text-center">
            <TrendingUp className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">Loading client data...</p>
          </div>
        </div>
      </Card>
    )
  }

  // For now, create a simple visualization showing client metrics
  // In the future, this could be enhanced with time-series data
  const chartData = [
    {
      name: 'Total Clients',
      value: data.total_clients,
      fill: 'hsl(160, 60%, 50%)'
    },
    {
      name: 'Active Period',
      value: data.total_clients,
      fill: 'hsl(200, 60%, 60%)'
    }
  ]

  return (
    <Card className="p-6">
      <h3 className="font-semibold text-lg mb-4">Client Retention</h3>
      <div className="h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip formatter={(value: number) => [value, 'Clients']} />
            <Bar dataKey="value" fill="hsl(160, 60%, 50%)" />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-4 text-sm text-muted-foreground">
        <p>Showing unique clients for the selected period. Enhanced retention metrics coming soon.</p>
      </div>
    </Card>
  )
}

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
        <h3 className="font-semibold text-lg mb-4">Aperçu Clients</h3>
        <div className="flex items-center justify-center h-[300px] bg-muted/20 rounded-lg">
          <div className="text-center">
            <TrendingUp className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">Chargement des données clients...</p>
          </div>
        </div>
      </Card>
    )
  }

  // Simplified single-metric visualization for clarity
  const chartData = [
    {
      name: 'Clients uniques',
      value: data.total_clients,
      fill: 'hsl(160, 60%, 50%)'
    }
  ]

  return (
    <Card className="p-6 border-l-4 border-l-primary">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="font-semibold text-lg">Aperçu Clients</h3>
          <p className="text-xs text-muted-foreground mt-1">
            Nombre de clients uniques sur la période sélectionnée
          </p>
        </div>
        <div className="bg-primary/10 px-3 py-1 rounded-full">
          <span className="text-sm font-semibold text-primary">
            {data.total_clients} client{data.total_clients > 1 ? 's' : ''}
          </span>
        </div>
      </div>

      <div className="h-[250px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 40 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 12 }}
              angle={0}
            />
            <YAxis
              tick={{ fontSize: 12 }}
              label={{ value: 'Nombre de clients', angle: -90, position: 'insideLeft', style: { fontSize: 12 } }}
            />
            <Tooltip
              formatter={(value: number) => [value, 'Clients uniques']}
              contentStyle={{
                backgroundColor: 'rgba(255, 255, 255, 0.95)',
                border: '1px solid #ccc',
                borderRadius: '8px',
                padding: '10px'
              }}
              labelStyle={{ fontWeight: 'bold', marginBottom: '5px' }}
            />
            <Bar
              dataKey="value"
              fill="hsl(160, 60%, 50%)"
              radius={[8, 8, 0, 0]}
              maxBarSize={120}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
        <div className="flex items-start gap-2">
          <div className="bg-blue-500 rounded-full p-1 mt-0.5">
            <TrendingUp className="h-3 w-3 text-white" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-blue-900 mb-1">
              💡 Comment est calculé ce nombre ?
            </p>
            <p className="text-xs text-blue-800 leading-relaxed">
              Ce graphique affiche le <strong>nombre de clients distincts</strong> ayant eu au moins un rendez-vous sur la période sélectionnée.
              Un même client n'est compté qu'une seule fois, même s'il a eu plusieurs rendez-vous.
            </p>
          </div>
        </div>
      </div>

      <div className="mt-3 p-3 bg-amber-50 rounded-lg border border-amber-200">
        <p className="text-xs text-amber-800">
          <strong>🚀 Bientôt disponible :</strong> Analyse détaillée de fidélisation (taux de rétention, fréquence de visite, évolution dans le temps)
        </p>
      </div>
    </Card>
  )
}

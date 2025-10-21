"use client"

import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts"
import { Card } from "@/components/ui/card"

const revenueData = [
  { month: "Jan", revenue: 2400, bookings: 24 },
  { month: "Feb", revenue: 1398, bookings: 22 },
  { month: "Mar", revenue: 9800, bookings: 29 },
  { month: "Apr", revenue: 3908, bookings: 20 },
  { month: "May", revenue: 4800, bookings: 22 },
  { month: "Jun", revenue: 3800, bookings: 25 },
]

const serviceData = [
  { name: "Massage Relaxant", value: 35, fill: "hsl(var(--primary))" },
  { name: "Massage Sportif", value: 25, fill: "hsl(var(--secondary))" },
  { name: "Soin du Visage", value: 20, fill: "hsl(var(--accent))" },
  { name: "Massage Duo", value: 15, fill: "hsl(var(--chart-4))" },
  { name: "Pierres Chaudes", value: 5, fill: "hsl(var(--chart-5))" },
]

const clientRetentionData = [
  { month: "Jan", newClients: 40, returning: 24 },
  { month: "Feb", newClients: 30, returning: 13 },
  { month: "Mar", newClients: 20, returning: 98 },
  { month: "Apr", newClients: 27, returning: 39 },
  { month: "May", newClients: 20, returning: 48 },
  { month: "Jun", newClients: 30, returning: 40 },
]

export function RevenueChart() {
  return (
    <Card className="p-6">
      <h3 className="font-semibold text-lg mb-4">Revenue & Bookings</h3>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={revenueData}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="month" />
          <YAxis />
          <Tooltip />
          <Legend />
          <Bar dataKey="revenue" fill="hsl(var(--primary))" />
          <Bar dataKey="bookings" fill="hsl(var(--secondary))" />
        </BarChart>
      </ResponsiveContainer>
    </Card>
  )
}

export function ServiceDistributionChart() {
  return (
    <Card className="p-6">
      <h3 className="font-semibold text-lg mb-4">Service Distribution</h3>
      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie
            data={serviceData}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={({ name, value }) => `${name}: ${value}%`}
            outerRadius={80}
            fill="#8884d8"
            dataKey="value"
          >
            {serviceData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.fill} />
            ))}
          </Pie>
          <Tooltip />
        </PieChart>
      </ResponsiveContainer>
    </Card>
  )
}

export function ClientRetentionChart() {
  return (
    <Card className="p-6">
      <h3 className="font-semibold text-lg mb-4">Client Retention</h3>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={clientRetentionData}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="month" />
          <YAxis />
          <Tooltip />
          <Legend />
          <Line type="monotone" dataKey="newClients" stroke="hsl(var(--primary))" strokeWidth={2} />
          <Line type="monotone" dataKey="returning" stroke="hsl(var(--secondary))" strokeWidth={2} />
        </LineChart>
      </ResponsiveContainer>
    </Card>
  )
}

"use client"

import { AdminHeader } from "@/components/admin-header"
import { RevenueChart, ServiceDistributionChart, ClientRetentionChart } from "@/components/analytics-charts"
import { StatCard } from "@/components/stat-card"
import { Card } from "@/components/ui/card"
import { TrendingUp, Users, DollarSign, Calendar } from "lucide-react"

export default function AnalyticsPage() {
  return (
    <div className="min-h-screen bg-background">
      <AdminHeader title="Analytics" description="Business performance and insights" />

      <div className="p-6 space-y-6">
        {/* Key Metrics */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard
            title="Total Revenue"
            value="€24,580"
            description="Last 6 months"
            icon={DollarSign}
            trend={{ value: 12, isPositive: true }}
          />
          <StatCard
            title="Total Bookings"
            value="157"
            description="Last 6 months"
            icon={Calendar}
            trend={{ value: 8, isPositive: true }}
          />
          <StatCard
            title="New Clients"
            value="42"
            description="Last 6 months"
            icon={Users}
            trend={{ value: 15, isPositive: true }}
          />
          <StatCard
            title="Avg. Booking Value"
            value="€156"
            description="Per appointment"
            icon={TrendingUp}
            trend={{ value: 5, isPositive: true }}
          />
        </div>

        {/* Charts */}
        <div className="grid lg:grid-cols-2 gap-6">
          <RevenueChart />
          <ServiceDistributionChart />
        </div>

        <ClientRetentionChart />

        {/* Additional Insights */}
        <div className="grid md:grid-cols-2 gap-6">
          <Card className="p-6">
            <h3 className="font-semibold text-lg mb-4">Top Performing Salons</h3>
            <div className="space-y-3">
              {[
                { name: "Paris", revenue: 12500, bookings: 85 },
                { name: "Lyon", revenue: 8200, bookings: 55 },
                { name: "Marseille", revenue: 3880, bookings: 17 },
              ].map((salon) => (
                <div key={salon.name} className="flex justify-between items-center pb-3 border-b last:border-0">
                  <div>
                    <p className="font-medium">{salon.name}</p>
                    <p className="text-xs text-muted-foreground">{salon.bookings} bookings</p>
                  </div>
                  <p className="font-semibold">€{salon.revenue}</p>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-6">
            <h3 className="font-semibold text-lg mb-4">Peak Hours</h3>
            <div className="space-y-3">
              {[
                { time: "14:00 - 15:00", bookings: 12, percentage: 85 },
                { time: "15:00 - 16:00", bookings: 11, percentage: 78 },
                { time: "10:00 - 11:00", bookings: 9, percentage: 64 },
              ].map((slot) => (
                <div key={slot.time}>
                  <div className="flex justify-between mb-1">
                    <p className="text-sm font-medium">{slot.time}</p>
                    <p className="text-sm text-muted-foreground">{slot.bookings} bookings</p>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div className="bg-primary h-2 rounded-full" style={{ width: `${slot.percentage}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}

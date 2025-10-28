"use client"

import { useState } from "react"
import { AdminHeader } from "@/components/admin-header"
import { AnalyticsFilters } from "@/components/analytics-filters"
import { RevenueChart, ServiceDistributionChart, ClientRetentionChart } from "@/components/analytics-charts"
import { StatCard } from "@/components/stat-card"
import { Card } from "@/components/ui/card"
import { TrendingUp, Users, DollarSign, Calendar, Clock, MapPin } from "lucide-react"
import { useAnalyticsData, useSalons, useStaff } from "@/lib/hooks/use-analytics-data"
import { format, subDays } from "date-fns"

export default function AnalyticsPage() {
  const [filters, setFilters] = useState({
    startDate: format(subDays(new Date(), 30), 'yyyy-MM-dd'),
    endDate: format(new Date(), 'yyyy-MM-dd'),
    startHour: '',
    endHour: '',
    salonId: '',
    staffId: ''
  })

  const { data: analyticsData, isLoading: analyticsLoading } = useAnalyticsData(filters)
  const { data: salons = [], isLoading: salonsLoading } = useSalons()
  const { data: staff = [], isLoading: staffLoading } = useStaff()

  const formatCurrency = (cents: number) => `€${(cents / 100).toFixed(2)}`
  const formatNumber = (num: number) => num.toLocaleString()

  const avgBookingValue = analyticsData?.kpis?.total_appointments && analyticsData.kpis.total_appointments > 0 
    ? analyticsData.kpis.total_revenue_cents / analyticsData.kpis.total_appointments 
    : 0

  return (
    <div className="min-h-screen bg-background">
      <AdminHeader title="Analytics" description="Business performance and insights" />

      <div className="p-6 space-y-6">
        {/* Filters */}
        <AnalyticsFilters
          filters={filters}
          onFiltersChange={setFilters}
          salons={salons}
          staff={staff}
        />

        {/* Key Metrics */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard
            title="Total Revenue"
            value={analyticsData ? formatCurrency(analyticsData.kpis?.total_revenue_cents || 0) : "€0"}
            description={`${format(new Date(filters.startDate), 'MMM d')} - ${format(new Date(filters.endDate), 'MMM d')}`}
            icon={DollarSign}
          />
          <StatCard
            title="Total Bookings"
            value={analyticsData ? formatNumber(analyticsData.kpis?.total_appointments || 0) : "0"}
            description={`${format(new Date(filters.startDate), 'MMM d')} - ${format(new Date(filters.endDate), 'MMM d')}`}
            icon={Calendar}
          />
          <StatCard
            title="Unique Clients"
            value={analyticsData ? formatNumber(analyticsData.kpis?.total_clients || 0) : "0"}
            description={`${format(new Date(filters.startDate), 'MMM d')} - ${format(new Date(filters.endDate), 'MMM d')}`}
            icon={Users}
          />
          <StatCard
            title="Avg. Booking Value"
            value={formatCurrency(avgBookingValue)}
            description="Per appointment"
            icon={TrendingUp}
          />
        </div>

        {/* Charts */}
        <div className="grid lg:grid-cols-2 gap-6">
          <RevenueChart data={analyticsData ? {
            total_revenue_cents: analyticsData.kpis?.total_revenue_cents || 0,
            total_appointments: analyticsData.kpis?.total_appointments || 0,
            period: analyticsData.period
          } : undefined} />
          <ServiceDistributionChart data={analyticsData?.popular_services} />
        </div>

        <ClientRetentionChart data={analyticsData ? {
          total_clients: analyticsData.kpis?.total_clients || 0
        } : undefined} />

        {/* Additional Insights */}
        <div className="grid md:grid-cols-2 gap-6">
          <Card className="p-6">
            <h3 className="font-semibold text-lg mb-4">Upcoming Appointments</h3>
            <div className="space-y-3">
              {analyticsData?.upcoming_appointments?.length ? (
                analyticsData.upcoming_appointments.slice(0, 5).map((appointment: any) => (
                  <div key={appointment.id} className="flex justify-between items-center pb-3 border-b last:border-0">
                    <div>
                      <p className="font-medium">
                        {appointment.client?.first_name} {appointment.client?.last_name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(appointment.start_time), 'MMM d, HH:mm')}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">{formatCurrency(appointment.service?.price_cents || 0)}</p>
                      <p className="text-xs text-muted-foreground">{appointment.service?.name}</p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-muted-foreground text-sm">No upcoming appointments</p>
              )}
            </div>
          </Card>

          <Card className="p-6">
            <h3 className="font-semibold text-lg mb-4">Popular Services</h3>
            <div className="space-y-3">
              {analyticsData?.popular_services?.length ? (
                analyticsData.popular_services.slice(0, 5).map((service, index) => {
                  const maxCount = analyticsData.popular_services[0]?.booking_count || 1
                  const percentage = (service.booking_count / maxCount) * 100
                  return (
                    <div key={service.service_name}>
                      <div className="flex justify-between mb-1">
                        <p className="text-sm font-medium">{service.service_name}</p>
                        <p className="text-sm text-muted-foreground">{service.booking_count} bookings</p>
                      </div>
                      <div className="w-full bg-muted rounded-full h-2">
                        <div className="bg-primary h-2 rounded-full" style={{ width: `${percentage}%` }} />
                      </div>
                    </div>
                  )
                })
              ) : (
                <p className="text-muted-foreground text-sm">No service data available</p>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}

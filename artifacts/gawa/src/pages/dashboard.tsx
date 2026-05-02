import { useGetDashboardSummary, getGetDashboardSummaryQueryKey, useGetRecentActivity, getGetRecentActivityQueryKey } from "@workspace/api-client-react";
import { Link } from "wouter";
import { formatCurrency, formatDate } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, ArrowUpRight, ArrowDownRight, Wallet, Receipt, Map as MapIcon, Activity, ArrowDownLeft, Sparkles } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

function getActivityIcon(type: string) {
  switch (type) {
    case 'payment_received': return <ArrowDownLeft className="h-4 w-4 text-primary" />;
    case 'payment_requested': return <ArrowUpRight className="h-4 w-4 text-amber-500" />;
    case 'event_created': return <Receipt className="h-4 w-4 text-blue-500" />;
    case 'event_settled': return <Sparkles className="h-4 w-4 text-primary" />;
    default: return <Activity className="h-4 w-4" />;
  }
}

function getActivityMessage(item: any) {
  switch (item.type) {
    case 'payment_received':
      return <><span className="font-medium">{item.participantName}</span> paid {formatCurrency(item.amount)} for <span className="font-medium">{item.eventTitle}</span></>;
    case 'payment_requested':
      return <>Requested {formatCurrency(item.amount)} from <span className="font-medium">{item.participantName}</span></>;
    case 'event_created':
      return <>Created split <span className="font-medium">{item.eventTitle}</span> for {formatCurrency(item.amount)}</>;
    case 'event_settled':
      return <><span className="font-medium">{item.eventTitle}</span> is fully settled!</>;
    default:
      return <span>{item.type}</span>;
  }
}

export default function Dashboard() {
  const { data: summary, isLoading } = useGetDashboardSummary({
    query: {
      queryKey: getGetDashboardSummaryQueryKey(),
    }
  });

  const { data: activity, isLoading: activityLoading } = useGetRecentActivity({ limit: 5 }, {
    query: {
      queryKey: getGetRecentActivityQueryKey({ limit: 5 }),
      refetchInterval: 15000,
    }
  });

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Overview</h1>
          <p className="text-muted-foreground text-sm">Welcome back to Gawa.</p>
        </div>
        <Link href="/events/new">
          <Button className="gap-2 font-bold shadow-lg shadow-primary/20">
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">New Split</span>
            <span className="sm:hidden">Split</span>
          </Button>
        </Link>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
      ) : summary ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="bg-primary/10 border-primary/20">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 px-4 pt-4">
              <CardTitle className="text-xs font-medium text-primary">Outstanding</CardTitle>
              <ArrowDownRight className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="text-xl md:text-2xl font-bold text-primary">
                {formatCurrency(summary.totalOutstanding)}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 px-4 pt-4">
              <CardTitle className="text-xs font-medium">Collected</CardTitle>
              <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="text-xl md:text-2xl font-bold">
                {formatCurrency(summary.totalCollected)}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 px-4 pt-4">
              <CardTitle className="text-xs font-medium">Total Split</CardTitle>
              <Wallet className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="text-xl md:text-2xl font-bold">
                {formatCurrency(summary.totalAmountSplit)}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 px-4 pt-4">
              <CardTitle className="text-xs font-medium">Active Events</CardTitle>
              <Receipt className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="text-xl md:text-2xl font-bold">
                {summary.pendingEvents}
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}

      <div className="grid md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Quick Actions</h2>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Link href="/events/new" className="block">
              <Card className="hover:bg-secondary/50 transition-colors cursor-pointer h-full">
                <CardContent className="flex flex-col items-center justify-center p-6 gap-3">
                  <div className="p-3 bg-primary/10 rounded-full">
                    <Receipt className="h-6 w-6 text-primary" />
                  </div>
                  <span className="font-medium text-sm">Split a Bill</span>
                </CardContent>
              </Card>
            </Link>
            <Link href="/trips" className="block">
              <Card className="hover:bg-secondary/50 transition-colors cursor-pointer h-full">
                <CardContent className="flex flex-col items-center justify-center p-6 gap-3">
                  <div className="p-3 bg-secondary rounded-full">
                    <MapIcon className="h-6 w-6" />
                  </div>
                  <span className="font-medium text-sm">Manage Trip</span>
                </CardContent>
              </Card>
            </Link>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Recent Activity</h2>
            <Link href="/activity" className="text-sm text-primary hover:underline">
              View all
            </Link>
          </div>
          <Card>
            <CardContent className="p-0">
              {activityLoading ? (
                <div className="p-4 space-y-3">
                  {[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full rounded-lg" />)}
                </div>
              ) : !activity || activity.length === 0 ? (
                <div className="p-6 text-center text-muted-foreground text-sm">
                  No recent activity. Create a split to get started!
                </div>
              ) : (
                <div className="divide-y divide-border/50">
                  {activity.map((item) => (
                    <div key={item.id} className="flex items-center gap-3 p-4">
                      <div className="bg-secondary p-2 rounded-full flex-shrink-0">
                        {getActivityIcon(item.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm truncate">{getActivityMessage(item)}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{formatDate(item.createdAt)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

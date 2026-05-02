import { useGetRecentActivity, getGetRecentActivityQueryKey } from "@workspace/api-client-react";
import { formatCurrency, formatDate } from "@/lib/format";
import { Card, CardContent } from "@/components/ui/card";
import { Activity, ArrowDownLeft, ArrowUpRight, Receipt, Sparkles } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export default function ActivityFeed() {
  const { data: activity, isLoading } = useGetRecentActivity({ limit: 50 }, {
    query: {
      queryKey: getGetRecentActivityQueryKey({ limit: 50 }),
    }
  });

  const getIcon = (type: string) => {
    switch (type) {
      case 'payment_received': return <ArrowDownLeft className="h-4 w-4 text-primary" />;
      case 'payment_requested': return <ArrowUpRight className="h-4 w-4 text-amber-500" />;
      case 'event_created': return <Receipt className="h-4 w-4 text-blue-500" />;
      case 'event_settled': return <Sparkles className="h-4 w-4 text-primary" />;
      default: return <Activity className="h-4 w-4" />;
    }
  };

  const getMessage = (item: any) => {
    switch (item.type) {
      case 'payment_received': 
        return <><span className="font-medium">{item.participantName}</span> paid {formatCurrency(item.amount)} for <span className="font-medium">{item.eventTitle}</span></>;
      case 'payment_requested': 
        return <>Requested {formatCurrency(item.amount)} from <span className="font-medium">{item.participantName}</span> for <span className="font-medium">{item.eventTitle}</span></>;
      case 'event_created': 
        return <>Created split <span className="font-medium">{item.eventTitle}</span> for {formatCurrency(item.amount)}</>;
      case 'event_settled': 
        return <><span className="font-medium">{item.eventTitle}</span> is fully settled!</>;
      default: return item.type;
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-2xl mx-auto space-y-6 pb-20">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Activity</h1>
        <p className="text-muted-foreground text-sm">Recent payments and events</p>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}
        </div>
      ) : activity?.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <div className="bg-secondary p-4 rounded-full mb-4">
              <Activity className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-2">No activity yet</h3>
            <p className="text-muted-foreground text-sm">
              Create a bill split to see activity here.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {activity?.map((item) => (
            <Card key={item.id} className="bg-card/50">
              <CardContent className="p-4 flex items-center gap-4">
                <div className="bg-secondary p-3 rounded-full flex-shrink-0">
                  {getIcon(item.type)}
                </div>
                <div className="flex-1">
                  <p className="text-sm">{getMessage(item)}</p>
                  <p className="text-xs text-muted-foreground mt-1">{formatDate(item.createdAt)}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

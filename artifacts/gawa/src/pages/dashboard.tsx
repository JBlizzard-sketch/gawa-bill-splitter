import {
  useGetDashboardSummary, getGetDashboardSummaryQueryKey,
  useGetRecentActivity, getGetRecentActivityQueryKey,
  useGetWeeklyStats, getGetWeeklyStatsQueryKey,
  useListRecurring, getListRecurringQueryKey,
  useFireRecurring,
  useGetNetBalances, getGetNetBalancesQueryKey,
} from "@workspace/api-client-react";
import { Link } from "wouter";
import { formatCurrency, formatDate, formatShortDate } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, ArrowUpRight, ArrowDownRight, Wallet, Receipt, Map as MapIcon, Activity, ArrowDownLeft, Sparkles, CalendarClock, Bell, Send, Loader2, MessageCircle, Phone, TrendingDown } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer,
} from "recharts";

function getActivityIcon(type: string) {
  switch (type) {
    case 'payment_received':  return <ArrowDownLeft  className="h-4 w-4 text-primary"    />;
    case 'payment_requested': return <ArrowUpRight   className="h-4 w-4 text-amber-500" />;
    case 'event_created':     return <Receipt        className="h-4 w-4 text-blue-500"  />;
    case 'event_settled':     return <Sparkles       className="h-4 w-4 text-primary"   />;
    default:                  return <Activity       className="h-4 w-4"               />;
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

function kshFormatter(value: number) {
  if (value >= 1000) return `${(value / 1000).toFixed(0)}k`;
  return String(value);
}

interface TooltipPayload {
  name: string;
  value: number;
  color: string;
}

function WeeklyTooltip({ active, payload, label }: { active?: boolean; payload?: TooltipPayload[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-lg shadow-lg p-3 text-sm min-w-[140px]">
      <p className="font-semibold mb-2">{label}</p>
      {payload.map((p) => (
        <div key={p.name} className="flex justify-between gap-4">
          <span style={{ color: p.color }}>{p.name}</span>
          <span className="font-medium">{formatCurrency(p.value)}</span>
        </div>
      ))}
    </div>
  );
}

function daysUntil(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const due = new Date(dateStr);
  due.setHours(0, 0, 0, 0);
  return Math.round((due.getTime() - now.getTime()) / 86_400_000);
}

function urgencyLabel(days: number): { label: string; className: string } {
  if (days < 0)  return { label: "Overdue",   className: "bg-red-500/15 text-red-400 border-red-500/25" };
  if (days === 0) return { label: "Due today", className: "bg-amber-500/15 text-amber-400 border-amber-500/25" };
  if (days === 1) return { label: "Tomorrow",  className: "bg-amber-500/15 text-amber-400 border-amber-500/25" };
  return { label: `In ${days} days`,           className: "bg-secondary text-muted-foreground border-border/50" };
}

const AVATAR_COLORS = [
  "bg-primary/20 text-primary",
  "bg-blue-500/20 text-blue-400",
  "bg-amber-500/20 text-amber-400",
  "bg-emerald-500/20 text-emerald-400",
  "bg-purple-500/20 text-purple-400",
  "bg-rose-500/20 text-rose-400",
];
function avatarColor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffff;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}
function initials(name: string) {
  return name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
}
function toKenyanE164(phone: string) {
  const d = phone.replace(/\D/g, "");
  if (d.startsWith("254")) return d;
  if (d.startsWith("0")) return "254" + d.slice(1);
  return "254" + d;
}
function waLink(phone: string, name: string, amount: number) {
  const msg = `Hi ${name.split(" ")[0]}! 👋 Just a reminder that you have an outstanding balance of *${formatCurrency(amount)}* on Gawa. Please send via M-Pesa when you can. Thanks!`;
  return `https://wa.me/${toKenyanE164(phone)}?text=${encodeURIComponent(msg)}`;
}

export default function Dashboard() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [firingId, setFiringId] = useState<number | null>(null);
  const [showAllBalances, setShowAllBalances] = useState(false);

  const { data: summary, isLoading } = useGetDashboardSummary({
    query: { queryKey: getGetDashboardSummaryQueryKey() }
  });

  const { data: activity, isLoading: activityLoading } = useGetRecentActivity({ limit: 5 }, {
    query: {
      queryKey: getGetRecentActivityQueryKey({ limit: 5 }),
      refetchInterval: 15000,
    }
  });

  const { data: weekly, isLoading: weeklyLoading } = useGetWeeklyStats({
    query: { queryKey: getGetWeeklyStatsQueryKey() }
  });

  const { data: allRecurring } = useListRecurring(undefined, {
    query: { queryKey: getListRecurringQueryKey() }
  });

  const fireRecurring = useFireRecurring();

  const dueSoon = (allRecurring ?? []).filter(b => {
    if (!b.isActive) return false;
    const days = daysUntil(b.nextFireAt);
    return days !== null && days <= 7;
  }).sort((a, b) => {
    const da = daysUntil(a.nextFireAt) ?? 999;
    const db = daysUntil(b.nextFireAt) ?? 999;
    return da - db;
  });

  const handleFire = (id: number, name: string) => {
    setFiringId(id);
    fireRecurring.mutate(
      { id },
      {
        onSuccess: (event: any) => {
          toast({
            title: `${name} sent!`,
            description: `Split created — ${event.participantCount ?? 0} M-Pesa request${(event.participantCount ?? 0) !== 1 ? "s" : ""} queued.`,
          });
          queryClient.invalidateQueries({ queryKey: getListRecurringQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetRecentActivityQueryKey({ limit: 5 }) });
        },
        onError: () => toast({ title: `Failed to send ${name}`, variant: "destructive" }),
        onSettled: () => setFiringId(null),
      }
    );
  };

  const { data: balances, isLoading: balancesLoading } = useGetNetBalances({
    query: { queryKey: getGetNetBalancesQueryKey(), refetchInterval: 15000 }
  });

  const weeklyHasData = weekly?.some(d => d.collected > 0 || d.pending > 0);
  const BALANCE_PREVIEW = 5;
  const visibleBalances = showAllBalances ? (balances ?? []) : (balances ?? []).slice(0, BALANCE_PREVIEW);
  const totalOwed = (balances ?? []).reduce((s, b) => s + b.pendingAmount, 0);

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

      {/* Due Soon banner */}
      {dueSoon.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-amber-500/15 rounded-full">
              <Bell className="h-3.5 w-3.5 text-amber-500" />
            </div>
            <h2 className="text-sm font-semibold">
              {dueSoon.length} recurring bill{dueSoon.length !== 1 ? "s" : ""} due soon
            </h2>
            <Link href="/recurring" className="ml-auto text-xs text-primary hover:underline">
              View all
            </Link>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {dueSoon.map(bill => {
              const days = daysUntil(bill.nextFireAt) ?? 0;
              const { label, className } = urgencyLabel(days);
              const isFiring = firingId === bill.id;

              return (
                <Card key={bill.id} className="border-amber-500/20 bg-amber-500/5">
                  <CardContent className="p-4 flex items-center gap-4">
                    {/* Icon */}
                    <div className="bg-amber-500/15 p-2.5 rounded-lg flex-shrink-0">
                      <CalendarClock className="h-5 w-5 text-amber-500" />
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold truncate">{bill.name}</span>
                        <Badge
                          variant="outline"
                          className={`text-[10px] px-1.5 py-0 border ${className}`}
                        >
                          {label}
                        </Badge>
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {formatCurrency(bill.amount)} · {bill.frequency} · due {formatShortDate(bill.nextFireAt)}
                      </div>
                    </div>

                    {/* Action */}
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5 flex-shrink-0 border-amber-500/30 hover:bg-amber-500/10 text-xs"
                      disabled={isFiring}
                      onClick={() => handleFire(bill.id, bill.name)}
                    >
                      {isFiring
                        ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        : <Send className="h-3.5 w-3.5" />
                      }
                      <span className="hidden sm:inline">Send</span>
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Weekly chart */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold">Last 7 days</CardTitle>
          <p className="text-xs text-muted-foreground">Daily collected vs outstanding splits</p>
        </CardHeader>
        <CardContent className="pt-2">
          {weeklyLoading ? (
            <Skeleton className="h-52 w-full rounded-lg" />
          ) : !weeklyHasData ? (
            <div className="h-52 flex items-center justify-center text-sm text-muted-foreground">
              No payment activity yet — create a split to see trends here.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={210}>
              <BarChart data={weekly} barGap={4} barCategoryGap="28%">
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis
                  dataKey="day"
                  tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tickFormatter={kshFormatter}
                  tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  width={36}
                />
                <Tooltip content={<WeeklyTooltip />} cursor={{ fill: "hsl(var(--secondary))" }} />
                <Legend
                  iconType="circle"
                  iconSize={8}
                  wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
                />
                <Bar dataKey="collected" name="Collected" fill="hsl(var(--primary))"    radius={[4, 4, 0, 0]} />
                <Bar dataKey="pending"   name="Pending"   fill="hsl(var(--secondary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Who Owes You */}
      {(balancesLoading || (balances && balances.length > 0)) && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-primary/10 rounded-full">
                  <TrendingDown className="h-3.5 w-3.5 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-base font-semibold">Who Owes You</CardTitle>
                  {!balancesLoading && balances && balances.length > 0 && (
                    <p className="text-xs text-muted-foreground">
                      {formatCurrency(totalOwed)} outstanding across {balances.length} person{balances.length !== 1 ? "s" : ""}
                    </p>
                  )}
                </div>
              </div>
              <Link href="/activity" className="text-xs text-primary hover:underline">
                Activity
              </Link>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            {balancesLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => <Skeleton key={i} className="h-14 w-full rounded-lg" />)}
              </div>
            ) : (
              <div className="divide-y divide-border/40">
                {visibleBalances.map((b, idx) => (
                  <div key={b.phone} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                    {/* Rank badge */}
                    <div className="w-5 text-center">
                      <span className="text-xs font-bold text-muted-foreground">#{idx + 1}</span>
                    </div>
                    {/* Avatar */}
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0 ${avatarColor(b.name)}`}>
                      {initials(b.name)}
                    </div>
                    {/* Name + meta */}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{b.name}</p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Phone className="h-2.5 w-2.5" />{b.phone}
                        <span className="mx-1">·</span>
                        {b.pendingEvents} pending event{b.pendingEvents !== 1 ? "s" : ""}
                        {b.paidAmount > 0 && (
                          <><span className="mx-1">·</span>
                          <span className="text-primary">{formatCurrency(b.paidAmount)} paid before</span></>
                        )}
                      </p>
                    </div>
                    {/* Amount */}
                    <div className="text-right flex-shrink-0 mr-2">
                      <p className="font-bold text-amber-400">{formatCurrency(b.pendingAmount)}</p>
                      <p className="text-[10px] text-muted-foreground">owed</p>
                    </div>
                    {/* WhatsApp nudge */}
                    <a
                      href={waLink(b.phone, b.name, b.pendingAmount)}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-green-500 hover:text-green-400 hover:bg-green-500/10 flex-shrink-0">
                        <MessageCircle className="h-4 w-4" />
                      </Button>
                    </a>
                  </div>
                ))}
              </div>
            )}

            {/* Show more / less toggle */}
            {balances && balances.length > BALANCE_PREVIEW && (
              <div className="pt-3 border-t border-border/40 mt-3">
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full text-xs text-muted-foreground hover:text-foreground"
                  onClick={() => setShowAllBalances(v => !v)}
                >
                  {showAllBalances
                    ? "Show less"
                    : `Show ${balances.length - BALANCE_PREVIEW} more`}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

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

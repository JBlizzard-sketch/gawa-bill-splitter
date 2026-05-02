import { useState } from "react";
import { useListRecurring, getListRecurringQueryKey, useCreateRecurring } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { formatCurrency, formatShortDate } from "@/lib/format";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CalendarClock, Plus, Loader2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

const FREQUENCIES = ["weekly", "monthly", "custom"] as const;

export default function RecurringList() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: "",
    description: "",
    amount: "",
    frequency: "monthly" as typeof FREQUENCIES[number],
    splitType: "equal" as "equal" | "custom",
    payerName: "Me",
    participants: "",
  });

  const { data: bills, isLoading } = useListRecurring(undefined, {
    query: { queryKey: getListRecurringQueryKey() }
  });

  const createRecurring = useCreateRecurring();

  const handleCreate = () => {
    if (!form.name.trim() || !form.amount) return;

    createRecurring.mutate(
      {
        data: {
          name: form.name,
          description: form.description || undefined,
          amount: Number(form.amount),
          frequency: form.frequency,
          splitType: form.splitType,
          payerName: form.payerName,
          participants: form.participants,
        }
      },
      {
        onSuccess: () => {
          toast({ title: "Recurring bill created!" });
          queryClient.invalidateQueries({ queryKey: getListRecurringQueryKey() });
          setOpen(false);
          setForm({ name: "", description: "", amount: "", frequency: "monthly", splitType: "equal", payerName: "Me", participants: "" });
        },
        onError: () => toast({ title: "Failed to create recurring bill", variant: "destructive" }),
      }
    );
  };

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Recurring</h1>
          <p className="text-muted-foreground text-sm">Rent, WiFi, and fixed schedules</p>
        </div>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              New Schedule
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>New Recurring Bill</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input
                  placeholder="e.g. House Rent, Netflix, WiFi"
                  value={form.name}
                  onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Amount (Ksh)</Label>
                  <Input
                    type="number"
                    placeholder="0"
                    value={form.amount}
                    onChange={e => setForm(p => ({ ...p, amount: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Paid by</Label>
                  <Input
                    placeholder="Me"
                    value={form.payerName}
                    onChange={e => setForm(p => ({ ...p, payerName: e.target.value }))}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Participants <span className="text-muted-foreground text-xs">(Mpesa numbers, comma-separated)</span></Label>
                <Input
                  placeholder="0722456789, 0733567890"
                  value={form.participants}
                  onChange={e => setForm(p => ({ ...p, participants: e.target.value }))}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Frequency</Label>
                  <Select
                    value={form.frequency}
                    onValueChange={v => setForm(p => ({ ...p, frequency: v as any }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {FREQUENCIES.map(f => (
                        <SelectItem key={f} value={f}>
                          {f.charAt(0).toUpperCase() + f.slice(1)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Split Type</Label>
                  <Select
                    value={form.splitType}
                    onValueChange={v => setForm(p => ({ ...p, splitType: v as any }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="equal">Equal</SelectItem>
                      <SelectItem value="custom">Custom</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button
                onClick={handleCreate}
                disabled={!form.name.trim() || !form.amount || createRecurring.isPending}
                className="w-full"
              >
                {createRecurring.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create Schedule
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2].map(i => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}
        </div>
      ) : bills?.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <div className="bg-secondary p-4 rounded-full mb-4">
              <CalendarClock className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-2">No recurring bills</h3>
            <p className="text-muted-foreground mb-4 max-w-sm">
              Set up automatic splits for rent, internet, or any shared subscription.
            </p>
            <Button onClick={() => setOpen(true)}>Setup a Bill</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {bills?.map((bill) => (
            <Card key={bill.id} className={bill.isActive ? "" : "opacity-60"}>
              <CardContent className="p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-start gap-4 w-full sm:w-auto">
                  <div className="bg-primary/10 p-3 rounded-lg flex-shrink-0">
                    <CalendarClock className="h-6 w-6 text-primary" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-lg">{bill.name}</h3>
                      <Badge variant={bill.isActive ? "default" : "secondary"}>
                        {bill.frequency}
                      </Badge>
                      {!bill.isActive && (
                        <Badge variant="outline" className="text-muted-foreground">inactive</Badge>
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground mt-1">
                      {bill.description || `${bill.splitType} split • Paid by ${bill.payerName}`}
                    </div>
                  </div>
                </div>

                <div className="flex sm:flex-col items-center sm:items-end justify-between w-full sm:w-auto mt-2 sm:mt-0 pt-2 sm:pt-0 border-t border-border/50 sm:border-0">
                  <div className="font-bold text-xl">{formatCurrency(bill.amount)}</div>
                  <div className="text-sm mt-1">
                    <span className="text-muted-foreground">Next: </span>
                    <span className="font-medium text-foreground">{formatShortDate(bill.nextFireAt)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

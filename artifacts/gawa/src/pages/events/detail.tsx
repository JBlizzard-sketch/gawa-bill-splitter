import { useLocation, useParams } from "wouter";
import { 
  useGetEvent, getGetEventQueryKey,
  useAddParticipant, 
  useSendPaymentRequests,
  useMarkPaid,
  useListContacts, getListContactsQueryKey,
  useGetParticipantHistory, getGetParticipantHistoryQueryKey,
  useListGroups, getListGroupsQueryKey,
  useGetGroup, getGetGroupQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { formatCurrency, formatPhone, formatDate, formatShortDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Send, CheckCircle2, UserPlus, Phone, Loader2, MoreVertical, MessageCircle, Share2, Link2, Check, Users, FileDown, History, TrendingUp, ExternalLink } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { exportEventPdf } from "@/lib/export-pdf";

function getInitials(name: string) {
  return name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
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
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) & 0xffff;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

function toKenyanE164(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("254")) return digits;
  if (digits.startsWith("0")) return "254" + digits.slice(1);
  return "254" + digits;
}

function buildWhatsAppLink(phone: string, message: string): string {
  return `https://wa.me/${toKenyanE164(phone)}?text=${encodeURIComponent(message)}`;
}

function buildReminderMessage(eventTitle: string, amount: number, payerName: string): string {
  return `Hi! 👋 You owe *${formatCurrency(amount)}* for *${eventTitle}* (paid by ${payerName}). Please send via Mpesa when you get a chance. Thanks!`;
}

export default function EventDetail() {
  const { id } = useParams();
  const eventId = Number(id);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isAddParticipantOpen, setIsAddParticipantOpen] = useState(false);
  const [newParticipant, setNewParticipant] = useState({ name: "", phone: "", amount: "" });
  const [markingPaid, setMarkingPaid] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [historyPhone, setHistoryPhone] = useState<string | null>(null);
  const [addGroupId, setAddGroupId] = useState<number | null>(null);
  const [addingGroup, setAddingGroup] = useState(false);

  const { data: historyData, isLoading: historyLoading } = useGetParticipantHistory(
    { phone: historyPhone ?? "" },
    {
      query: {
        enabled: !!historyPhone,
        queryKey: getGetParticipantHistoryQueryKey({ phone: historyPhone ?? "" }),
      }
    }
  );

  const { data: event, isLoading } = useGetEvent(eventId, {
    query: {
      enabled: !!eventId,
      queryKey: getGetEventQueryKey(eventId),
      refetchInterval: 10000,
    }
  });

  const addParticipant = useAddParticipant();
  const sendRequests = useSendPaymentRequests();
  const markPaid = useMarkPaid();

  const { data: contacts } = useListContacts({ query: { queryKey: getListContactsQueryKey() } });
  const { data: groups } = useListGroups({ query: { queryKey: getListGroupsQueryKey() } });
  const { data: selectedGroupData } = useGetGroup(
    addGroupId ?? 0,
    { query: { enabled: addGroupId !== null, queryKey: getGetGroupQueryKey(addGroupId ?? 0) } }
  );

  const alreadyAddedPhones = new Set(
    (event?.participants ?? []).map((p: any) => p.mpesaPhone.replace(/\D/g, ""))
  );

  const availableContacts = (contacts ?? []).filter(
    c => !alreadyAddedPhones.has(c.mpesaPhone.replace(/\D/g, ""))
  );

  function pickContact(contact: { name: string; mpesaPhone: string }) {
    setNewParticipant(prev => ({ ...prev, name: contact.name, phone: contact.mpesaPhone }));
  }

  const invalidate = () => queryClient.invalidateQueries({ queryKey: getGetEventQueryKey(eventId) });

  const handleAddParticipant = () => {
    addParticipant.mutate({
      eventId,
      data: {
        name: newParticipant.name,
        mpesaPhone: newParticipant.phone,
        shareAmount: Number(newParticipant.amount) || null
      }
    }, {
      onSuccess: () => {
        setIsAddParticipantOpen(false);
        setNewParticipant({ name: "", phone: "", amount: "" });
        invalidate();
        toast({ title: "Participant added" });
      },
      onError: () => toast({ title: "Error adding participant", variant: "destructive" })
    });
  };

  const handleAddAllFromGroup = async () => {
    if (!selectedGroupData || !selectedGroupData.members.length) return;
    setAddingGroup(true);
    const alreadyPhones = new Set(
      (event?.participants ?? []).map((p: any) => p.mpesaPhone.replace(/\D/g, ""))
    );
    const toAdd = selectedGroupData.members.filter(
      m => !alreadyPhones.has(m.mpesaPhone.replace(/\D/g, ""))
    );
    if (toAdd.length === 0) {
      toast({ title: "All group members are already in this split" });
      setAddingGroup(false);
      return;
    }
    let added = 0;
    for (const m of toAdd) {
      await new Promise<void>((resolve) => {
        addParticipant.mutate(
          { eventId, data: { name: m.name, mpesaPhone: m.mpesaPhone, shareAmount: null } },
          { onSuccess: () => { added++; resolve(); }, onError: () => resolve() }
        );
      });
    }
    invalidate();
    setAddingGroup(false);
    setIsAddParticipantOpen(false);
    setAddGroupId(null);
    toast({ title: `Added ${added} member${added !== 1 ? "s" : ""} from ${selectedGroupData.name}` });
  };

  const handleSendRequests = () => {
    sendRequests.mutate({ eventId }, {
      onSuccess: (res) => {
        toast({ title: `Sent ${res.sent} payment request${res.sent !== 1 ? 's' : ''}!` });
        invalidate();
      },
      onError: () => toast({ title: "Failed to send requests", variant: "destructive" })
    });
  };

  const handleMarkPaid = (participantId: number) => {
    setMarkingPaid(participantId);
    markPaid.mutate({ eventId, participantId }, {
      onSuccess: () => {
        toast({ title: "Marked as paid" });
        invalidate();
        setMarkingPaid(null);
      },
      onError: () => {
        toast({ title: "Failed to mark as paid", variant: "destructive" });
        setMarkingPaid(null);
      }
    });
  };

  const handleCopyLink = () => {
    const base = window.location.origin + import.meta.env.BASE_URL.replace(/\/$/, "");
    const shareUrl = `${base}/share/${eventId}`;
    navigator.clipboard.writeText(shareUrl).then(() => {
      setCopied(true);
      toast({ title: "Link copied!", description: "Share it in your group chat." });
      setTimeout(() => setCopied(false), 2500);
    });
  };

  const handleExportPdf = async () => {
    if (!event) return;
    setExportingPdf(true);
    try {
      const base = window.location.origin + import.meta.env.BASE_URL.replace(/\/$/, "");
      const shareUrl = `${base}/share/${eventId}`;
      await exportEventPdf(event as any, shareUrl);
      toast({ title: "Receipt downloaded!" });
    } catch {
      toast({ title: "Failed to generate PDF", variant: "destructive" });
    } finally {
      setExportingPdf(false);
    }
  };

  const handleShareAll = () => {
    if (!event) return;
    const unpaid = event.participants.filter((p: any) => p.paymentStatus !== "paid");
    unpaid.forEach((p: any) => {
      const msg = buildReminderMessage(event.title, p.shareAmount, event.payerName);
      window.open(buildWhatsAppLink(p.mpesaPhone, msg), "_blank", "noopener,noreferrer");
    });
    toast({ title: `Opened ${unpaid.length} WhatsApp chat${unpaid.length !== 1 ? "s" : ""}` });
  };

  if (isLoading) {
    return <div className="p-4 md:p-8 space-y-4"><Skeleton className="h-32 w-full" /><Skeleton className="h-64 w-full" /></div>;
  }

  if (!event) return <div>Not found</div>;

  const unpaidParticipants = event.participants.filter((p: any) => p.paymentStatus !== "paid");
  const paidParticipants = event.participants.filter((p: any) => p.paymentStatus === "paid");

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto space-y-6 pb-32">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => setLocation("/events")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold tracking-tight truncate">{event.title}</h1>
          <p className="text-muted-foreground text-sm">
            {formatCurrency(event.totalAmount)} • {event.splitType} split • Paid by {event.payerName}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 text-xs"
            onClick={handleExportPdf}
            disabled={exportingPdf}
          >
            {exportingPdf
              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
              : <FileDown className="h-3.5 w-3.5" />
            }
            <span className="hidden sm:inline">PDF</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 text-xs"
            onClick={handleCopyLink}
          >
            {copied
              ? <><Check className="h-3.5 w-3.5 text-primary" /> Copied</>
              : <><Link2 className="h-3.5 w-3.5" /> Share</>
            }
          </Button>
          <Badge variant={
            event.status === 'settled' ? 'default' :
            event.status === 'partial' ? 'outline' :
            event.status === 'sent' ? 'secondary' : 'outline'
          }>
            {event.status === 'settled' ? '✓ Settled' :
             event.status === 'partial' ? `${paidParticipants.length}/${event.participants.length} paid` :
             event.status === 'sent' ? 'Requests Sent' : 'Draft'}
          </Badge>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-lg">
                Participants
                <span className="text-sm font-normal text-muted-foreground ml-2">
                  {paidParticipants.length}/{event.participants.length} paid
                </span>
              </CardTitle>
              <Dialog open={isAddParticipantOpen} onOpenChange={setIsAddParticipantOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-2">
                    <UserPlus className="h-4 w-4" /> Add
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add Participant</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 py-2">
                    {/* Groups picker */}
                    {groups && groups.length > 0 && (
                      <div className="space-y-2">
                        <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                          <Users className="h-3.5 w-3.5" />
                          From Group
                        </div>
                        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide -mx-1 px-1">
                          {groups.map(g => {
                            const selected = addGroupId === g.id;
                            return (
                              <button
                                key={g.id}
                                type="button"
                                onClick={() => setAddGroupId(selected ? null : g.id)}
                                className={`flex flex-col items-center gap-1 p-2 rounded-xl border transition-all flex-shrink-0 min-w-[64px] ${
                                  selected
                                    ? "border-primary bg-primary/10"
                                    : "border-border bg-secondary/40 hover:border-primary/50 hover:bg-secondary/80"
                                }`}
                              >
                                <div className="w-9 h-9 rounded-full bg-primary/15 flex items-center justify-center">
                                  <Users className="h-4 w-4 text-primary" />
                                </div>
                                <span className="text-[10px] font-medium leading-tight text-center line-clamp-2 w-full">
                                  {g.name.split(" ")[0]}
                                </span>
                                <span className="text-[9px] text-muted-foreground">{g.memberCount}p</span>
                                {selected && <Check className="h-3 w-3 text-primary" />}
                              </button>
                            );
                          })}
                        </div>
                        {addGroupId && selectedGroupData && (
                          <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 space-y-2">
                            <div className="text-xs font-medium text-muted-foreground">
                              Adding {selectedGroupData.members.length} member{selectedGroupData.members.length !== 1 ? "s" : ""} from {selectedGroupData.name}
                            </div>
                            <div className="flex flex-wrap gap-1">
                              {selectedGroupData.members.map(m => (
                                <span key={m.id} className="text-xs bg-secondary px-2 py-0.5 rounded-full">{m.name}</span>
                              ))}
                            </div>
                            <Button
                              size="sm"
                              className="w-full gap-2"
                              onClick={handleAddAllFromGroup}
                              disabled={addingGroup}
                            >
                              {addingGroup ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Users className="h-3.5 w-3.5" />}
                              Add All from {selectedGroupData.name}
                            </Button>
                          </div>
                        )}
                        {!addGroupId && (
                          <div className="relative">
                            <div className="absolute inset-0 flex items-center">
                              <span className="w-full border-t border-border/50" />
                            </div>
                            <div className="relative flex justify-center text-xs uppercase">
                              <span className="bg-background px-2 text-muted-foreground">or add one person</span>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                    {/* Contacts picker strip */}
                    {!addGroupId && availableContacts.length > 0 && (
                      <div className="space-y-2">
                        <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                          <Users className="h-3.5 w-3.5" />
                          From Contacts
                        </div>
                        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide -mx-1 px-1">
                          {availableContacts.map(c => {
                            const selected = newParticipant.name === c.name && newParticipant.phone === c.mpesaPhone;
                            return (
                              <button
                                key={c.id}
                                type="button"
                                onClick={() => pickContact(c)}
                                className={`flex flex-col items-center gap-1 p-2 rounded-xl border transition-all flex-shrink-0 w-16 ${
                                  selected
                                    ? "border-primary bg-primary/10"
                                    : "border-border bg-secondary/40 hover:border-primary/50 hover:bg-secondary/80"
                                }`}
                              >
                                <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-semibold ${avatarColor(c.name)}`}>
                                  {getInitials(c.name)}
                                </div>
                                <span className="text-[10px] font-medium leading-tight text-center line-clamp-2 w-full">
                                  {c.name.split(" ")[0]}
                                </span>
                                {selected && (
                                  <Check className="h-3 w-3 text-primary" />
                                )}
                              </button>
                            );
                          })}
                        </div>
                        <div className="relative">
                          <div className="absolute inset-0 flex items-center">
                            <span className="w-full border-t border-border/50" />
                          </div>
                          <div className="relative flex justify-center text-xs uppercase">
                            <span className="bg-background px-2 text-muted-foreground">or enter manually</span>
                          </div>
                        </div>
                      </div>
                    )}

                    {!addGroupId && (
                      <>
                        <div className="space-y-2">
                          <Label>Name</Label>
                          <Input
                            value={newParticipant.name}
                            onChange={e => setNewParticipant(prev => ({ ...prev, name: e.target.value }))}
                            placeholder="e.g. John Doe"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Mpesa Phone Number</Label>
                          <Input
                            value={newParticipant.phone}
                            onChange={e => setNewParticipant(prev => ({ ...prev, phone: e.target.value }))}
                            placeholder="07XX XXX XXX"
                          />
                        </div>
                        {event.splitType === 'custom' && (
                          <div className="space-y-2">
                            <Label>Amount (Ksh)</Label>
                            <Input
                              type="number"
                              value={newParticipant.amount}
                              onChange={e => setNewParticipant(prev => ({ ...prev, amount: e.target.value }))}
                              placeholder="0"
                            />
                          </div>
                        )}
                      </>
                    )}
                  </div>
                  {!addGroupId && (
                    <DialogFooter>
                      <Button
                        onClick={handleAddParticipant}
                        disabled={!newParticipant.name || !newParticipant.phone || addParticipant.isPending}
                      >
                        {addParticipant.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Add Person
                      </Button>
                    </DialogFooter>
                  )}
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              {event.participants.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  No participants yet. Add friends to split the bill.
                </div>
              ) : (
                <div className="space-y-3 mt-2">
                  {event.participants.map((p: any) => (
                    <div key={p.id} className="flex items-center justify-between py-3 border-b border-border/40 last:border-0">
                      <button
                        type="button"
                        className="flex items-center gap-3 flex-1 min-w-0 text-left hover:opacity-80 transition-opacity group"
                        onClick={() => setHistoryPhone(p.mpesaPhone)}
                      >
                        <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${avatarColor(p.name)}`}>
                          {getInitials(p.name)}
                        </div>
                        <div className="min-w-0">
                          <div className="font-medium truncate group-hover:text-primary transition-colors">{p.name}</div>
                          <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                            <Phone className="h-3 w-3 flex-shrink-0" /> {formatPhone(p.mpesaPhone)}
                          </div>
                        </div>
                      </button>
                      <div className="flex items-center gap-3 flex-shrink-0 pl-2">
                        <div className="text-right">
                          <div className="font-semibold">{formatCurrency(p.shareAmount)}</div>
                          <div className="mt-1">
                            {p.paymentStatus === 'paid' ? (
                              <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-xs">
                                <CheckCircle2 className="h-3 w-3 mr-1" /> Paid
                              </Badge>
                            ) : p.paymentStatus === 'requested' ? (
                              <Badge variant="secondary" className="text-xs">Requested</Badge>
                            ) : p.paymentStatus === 'failed' ? (
                              <Badge variant="destructive" className="text-xs">Failed</Badge>
                            ) : (
                              <Badge variant="outline" className="text-xs">Pending</Badge>
                            )}
                          </div>
                        </div>
                        {p.paymentStatus !== 'paid' && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0">
                                {markingPaid === p.id
                                  ? <Loader2 className="h-4 w-4 animate-spin" />
                                  : <MoreVertical className="h-4 w-4" />
                                }
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                asChild
                              >
                                <a
                                  href={buildWhatsAppLink(
                                    p.mpesaPhone,
                                    buildReminderMessage(event.title, p.shareAmount, event.payerName)
                                  )}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center cursor-pointer"
                                >
                                  <MessageCircle className="h-4 w-4 mr-2 text-green-500" />
                                  Send WhatsApp Reminder
                                </a>
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => handleMarkPaid(p.id)}>
                                <CheckCircle2 className="h-4 w-4 mr-2 text-primary" />
                                Mark as Paid
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {event.items && event.items.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">Bill Items</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {event.items.map((item: any) => (
                    <div key={item.id} className="flex justify-between items-center py-2 border-b border-border/40 last:border-0">
                      <span className="text-sm">{item.name}</span>
                      <span className="font-medium text-sm">{formatCurrency(item.amount)}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-4">
          <Card className="bg-secondary/20">
            <CardContent className="p-6">
              <div className="text-sm font-medium text-muted-foreground mb-1">Outstanding</div>
              <div className="text-3xl font-bold text-primary mb-2">{formatCurrency(event.outstandingAmount)}</div>
              <div className="text-xs text-muted-foreground mb-6">
                of {formatCurrency(event.totalAmount)} total
              </div>

              {event.outstandingAmount > 0 ? (
                <Button
                  size="lg"
                  className="w-full font-bold shadow-lg shadow-primary/20 py-6"
                  disabled={unpaidParticipants.length === 0 || sendRequests.isPending}
                  onClick={handleSendRequests}
                >
                  {sendRequests.isPending
                    ? <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    : <Send className="mr-2 h-5 w-5" />
                  }
                  Send Mpesa Requests
                </Button>
              ) : (
                <div className="text-center py-4">
                  <CheckCircle2 className="h-12 w-12 text-primary mx-auto mb-2" />
                  <p className="font-semibold text-primary">All paid!</p>
                  <p className="text-xs text-muted-foreground mt-1">Everyone has settled up.</p>
                </div>
              )}

              {unpaidParticipants.length > 0 && (
                <p className="text-xs text-muted-foreground text-center mt-3">
                  {unpaidParticipants.length} person{unpaidParticipants.length !== 1 ? 's' : ''} still owe
                </p>
              )}
            </CardContent>
          </Card>

          {unpaidParticipants.length > 0 && (
            <Card className="border-green-500/20 bg-green-500/5">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className="bg-green-500 rounded-full p-1.5 flex-shrink-0">
                    <MessageCircle className="h-3.5 w-3.5 text-white" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold">WhatsApp Reminders</div>
                    <div className="text-xs text-muted-foreground">
                      Nudge all {unpaidParticipants.length} unpaid at once
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  {unpaidParticipants.map((p: any) => (
                    <a
                      key={p.id}
                      href={buildWhatsAppLink(
                        p.mpesaPhone,
                        buildReminderMessage(event.title, p.shareAmount, event.payerName)
                      )}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-between p-2.5 rounded-lg bg-background/60 hover:bg-background transition-colors border border-border/30 group"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <MessageCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                        <div className="min-w-0">
                          <div className="text-sm font-medium truncate">{p.name}</div>
                          <div className="text-xs text-muted-foreground">{formatCurrency(p.shareAmount)}</div>
                        </div>
                      </div>
                      <Share2 className="h-3.5 w-3.5 text-muted-foreground group-hover:text-green-500 transition-colors flex-shrink-0 ml-2" />
                    </a>
                  ))}
                </div>
                {unpaidParticipants.length > 1 && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full mt-3 border-green-500/30 text-green-500 hover:bg-green-500/10 hover:text-green-400 hover:border-green-500/50"
                    onClick={handleShareAll}
                  >
                    <MessageCircle className="h-4 w-4 mr-2" />
                    Message All {unpaidParticipants.length}
                  </Button>
                )}
              </CardContent>
            </Card>
          )}

          {event.payments && event.payments.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Payment History</CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <div className="space-y-2">
                  {event.payments.slice(0, 5).map((pmt: any) => (
                    <div key={pmt.id} className="flex justify-between items-center text-xs py-1">
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${
                          pmt.status === 'completed' ? 'bg-primary' :
                          pmt.status === 'failed' ? 'bg-destructive' : 'bg-amber-500'
                        }`} />
                        <span className="text-muted-foreground">{pmt.mpesaReference || 'Mpesa Request'}</span>
                      </div>
                      <span className="font-medium">{formatCurrency(pmt.amount)}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Participant History Sheet */}
      <Sheet open={!!historyPhone} onOpenChange={(open) => { if (!open) setHistoryPhone(null); }}>
        <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader className="pb-4">
            <div className="flex items-center gap-3">
              {historyData && (
                <div className={`w-11 h-11 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${avatarColor(historyData.name || "")}`}>
                  {getInitials(historyData.name || "?")}
                </div>
              )}
              <div>
                <SheetTitle className="text-lg">
                  {historyLoading ? "Loading…" : historyData?.name || "Participant"}
                </SheetTitle>
                <p className="text-xs text-muted-foreground mt-0.5">{historyPhone ? formatPhone(historyPhone) : ""}</p>
              </div>
            </div>
          </SheetHeader>

          {historyLoading ? (
            <div className="space-y-3 pt-2">
              <Skeleton className="h-20 w-full rounded-xl" />
              <Skeleton className="h-16 w-full rounded-xl" />
              <Skeleton className="h-16 w-full rounded-xl" />
            </div>
          ) : historyData ? (
            <div className="space-y-5 pt-1">
              {/* Summary stats */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-primary/10 rounded-xl p-3 text-center">
                  <div className="text-lg font-bold text-primary">{historyData.paidCount}</div>
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wide mt-0.5">Paid</div>
                </div>
                <div className="bg-secondary/50 rounded-xl p-3 text-center">
                  <div className="text-lg font-bold">{historyData.totalCount}</div>
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wide mt-0.5">Total</div>
                </div>
                <div className={`rounded-xl p-3 text-center ${historyData.totalCount > 0 && historyData.paidCount / historyData.totalCount >= 0.8 ? "bg-primary/10" : "bg-amber-500/10"}`}>
                  <div className={`text-lg font-bold ${historyData.totalCount > 0 && historyData.paidCount / historyData.totalCount >= 0.8 ? "text-primary" : "text-amber-500"}`}>
                    {historyData.totalCount > 0 ? Math.round((historyData.paidCount / historyData.totalCount) * 100) : 0}%
                  </div>
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wide mt-0.5">Rate</div>
                </div>
              </div>

              {/* Totals row */}
              <div className="flex gap-3">
                <div className="flex-1 bg-secondary/30 rounded-xl p-3">
                  <div className="text-xs text-muted-foreground">Total paid</div>
                  <div className="font-bold text-primary">{formatCurrency(historyData.totalPaid)}</div>
                </div>
                <div className="flex-1 bg-secondary/30 rounded-xl p-3">
                  <div className="text-xs text-muted-foreground">Outstanding</div>
                  <div className="font-bold text-amber-500">{formatCurrency(historyData.totalPending)}</div>
                </div>
              </div>

              {/* Reliability bar */}
              {historyData.totalCount > 0 && (
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-medium flex items-center gap-1.5">
                      <TrendingUp className="h-3.5 w-3.5 text-muted-foreground" />
                      Payment reliability
                    </span>
                    <span className="text-xs text-muted-foreground">{historyData.paidCount}/{historyData.totalCount} events</span>
                  </div>
                  <div className="h-2 bg-secondary rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${Math.round((historyData.paidCount / historyData.totalCount) * 100)}%`,
                        background: historyData.paidCount / historyData.totalCount >= 0.8
                          ? "hsl(var(--primary))"
                          : historyData.paidCount / historyData.totalCount >= 0.5
                          ? "#f59e0b"
                          : "#ef4444",
                      }}
                    />
                  </div>
                </div>
              )}

              {/* Event history entries */}
              <div className="space-y-2">
                <h3 className="text-sm font-semibold flex items-center gap-1.5">
                  <History className="h-3.5 w-3.5 text-muted-foreground" />
                  Event history
                </h3>
                {historyData.entries.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">No events found.</p>
                ) : (
                  historyData.entries.map((entry, i) => (
                    <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-secondary/30 border border-border/30">
                      <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${
                        entry.paymentStatus === "paid" ? "bg-primary" :
                        entry.paymentStatus === "failed" ? "bg-destructive" :
                        entry.paymentStatus === "requested" ? "bg-amber-500" : "bg-muted-foreground"
                      }`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-medium truncate">{entry.eventTitle}</span>
                          {entry.paymentStatus === "paid" && (
                            <CheckCircle2 className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          Paid by {entry.payerName} · {formatShortDate(entry.eventCreatedAt)}
                        </div>
                        {entry.mpesaReceiptNumber && (
                          <div className="text-[10px] text-muted-foreground font-mono mt-0.5">
                            {entry.mpesaReceiptNumber}
                          </div>
                        )}
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="text-sm font-semibold">{formatCurrency(entry.shareAmount)}</div>
                        <div className={`text-[10px] font-medium mt-0.5 ${
                          entry.paymentStatus === "paid" ? "text-primary" :
                          entry.paymentStatus === "failed" ? "text-destructive" :
                          entry.paymentStatus === "requested" ? "text-amber-500" : "text-muted-foreground"
                        }`}>
                          {entry.paymentStatus === "paid" ? "Paid" :
                           entry.paymentStatus === "requested" ? "Requested" :
                           entry.paymentStatus === "failed" ? "Failed" : "Pending"}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Open event link */}
              {historyData.entries.length > 0 && (
                <button
                  type="button"
                  onClick={() => { setHistoryPhone(null); setLocation(`/events/${historyData.entries[0].eventId}`); }}
                  className="w-full text-center text-xs text-primary hover:underline flex items-center justify-center gap-1"
                >
                  <ExternalLink className="h-3 w-3" />
                  View latest event
                </button>
              )}
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}

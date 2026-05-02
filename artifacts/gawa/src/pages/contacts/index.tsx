import { useState } from "react";
import {
  useListContacts, getListContactsQueryKey,
  useCreateContact, useDeleteContact,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Users, Trash2, Plus, Phone, X } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

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

export default function ContactsList() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const qKey = getListContactsQueryKey();

  const { data: contacts, isLoading } = useListContacts({ query: { queryKey: qKey } });
  const createContact = useCreateContact();
  const deleteContact = useDeleteContact();

  const [addOpen, setAddOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [search, setSearch] = useState("");

  const [form, setForm] = useState({ name: "", mpesaPhone: "" });
  const [errors, setErrors] = useState<{ name?: string; mpesaPhone?: string }>({});

  function validate() {
    const e: typeof errors = {};
    if (form.name.trim().length < 2) e.name = "Name must be at least 2 characters";
    const digits = form.mpesaPhone.replace(/\D/g, "");
    if (digits.length < 9) e.mpesaPhone = "Enter a valid Kenyan phone number";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function handleAdd() {
    if (!validate()) return;
    createContact.mutate(
      { data: { name: form.name.trim(), mpesaPhone: form.mpesaPhone.trim() } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: qKey });
          toast({ title: "Contact saved" });
          setAddOpen(false);
          setForm({ name: "", mpesaPhone: "" });
          setErrors({});
        },
        onError: (err: any) => {
          const msg = err?.response?.data?.error ?? "Failed to save contact";
          toast({ title: msg, variant: "destructive" });
        },
      }
    );
  }

  function handleDelete() {
    if (deleteId == null) return;
    deleteContact.mutate(
      { id: deleteId },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: qKey });
          toast({ title: "Contact removed" });
          setDeleteId(null);
        },
        onError: () => toast({ title: "Failed to remove contact", variant: "destructive" }),
      }
    );
  }

  const filtered = (contacts ?? []).filter(c =>
    !search.trim() ||
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.mpesaPhone.includes(search)
  );

  return (
    <div className="p-4 md:p-8 max-w-2xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Contacts</h1>
          <p className="text-muted-foreground text-sm">Quick-add people to your splits</p>
        </div>
        <Button className="gap-2" onClick={() => setAddOpen(true)}>
          <Plus className="h-4 w-4" />
          Add Contact
        </Button>
      </div>

      {!isLoading && (contacts?.length ?? 0) > 0 && (
        <div className="relative">
          <Input
            placeholder="Search by name or phone…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pr-8"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      )}

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
        </div>
      ) : contacts?.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <div className="bg-primary/10 p-4 rounded-full mb-4">
              <Users className="h-8 w-8 text-primary" />
            </div>
            <h3 className="text-lg font-semibold mb-2">No contacts yet</h3>
            <p className="text-muted-foreground mb-4 max-w-sm text-sm">
              Save the people you split with most often — their name and M-Pesa number will
              be available as one-tap picks when you add participants to a split.
            </p>
            <Button onClick={() => setAddOpen(true)}>Add your first contact</Button>
          </CardContent>
        </Card>
      ) : filtered.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-10 text-center">
            <p className="text-muted-foreground text-sm">No contacts match your search.</p>
            <button onClick={() => setSearch("")} className="text-sm text-primary hover:underline mt-2">Clear</button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map(contact => (
            <Card key={contact.id} className="hover:bg-secondary/30 transition-colors">
              <CardContent className="p-4 flex items-center gap-4">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold text-sm flex-shrink-0 ${avatarColor(contact.name)}`}>
                  {getInitials(contact.name)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{contact.name}</div>
                  <div className="text-sm text-muted-foreground flex items-center gap-1">
                    <Phone className="h-3 w-3" />
                    {contact.mpesaPhone}
                  </div>
                </div>
                <button
                  onClick={() => setDeleteId(contact.id)}
                  className="text-muted-foreground hover:text-destructive transition-colors p-1"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </CardContent>
            </Card>
          ))}
          <p className="text-xs text-muted-foreground text-center pt-1">
            {filtered.length} contact{filtered.length !== 1 ? "s" : ""}
          </p>
        </div>
      )}

      {/* Add dialog */}
      <Dialog open={addOpen} onOpenChange={open => { setAddOpen(open); if (!open) { setForm({ name: "", mpesaPhone: "" }); setErrors({}); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Contact</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="cname">Name</Label>
              <Input
                id="cname"
                placeholder="e.g. Amina Wanjiku"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              />
              {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cphone">M-Pesa Phone</Label>
              <Input
                id="cphone"
                placeholder="e.g. 0712 345 678"
                value={form.mpesaPhone}
                onChange={e => setForm(f => ({ ...f, mpesaPhone: e.target.value }))}
              />
              {errors.mpesaPhone && <p className="text-xs text-destructive">{errors.mpesaPhone}</p>}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button onClick={handleAdd} disabled={createContact.isPending}>
              {createContact.isPending ? "Saving…" : "Save Contact"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={deleteId != null} onOpenChange={open => { if (!open) setDeleteId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove contact?</AlertDialogTitle>
            <AlertDialogDescription>
              This only removes them from your contact list. Existing splits are not affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

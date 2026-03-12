import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { LayoutShell } from "@/components/layout-shell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { User, Mail, Briefcase, Building2, IdCard, Edit, Clock, CheckCircle, XCircle, Send } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";

interface ProfileData {
  id: number;
  username: string;
  role: string;
  fullName: string | null;
  employeeCode: string | null;
  designation: string | null;
  department: string | null;
  pendingRequest: {
    id: number;
    status: string;
    requestedData: Record<string, string>;
    requestedAt: string;
  } | null;
}

export default function ProfilePage() {
  const { toast } = useToast();
  const [editOpen, setEditOpen] = useState(false);
  const [form, setForm] = useState({ fullName: "", designation: "", department: "" });

  const { data: profile, isLoading } = useQuery<ProfileData>({
    queryKey: ["/api/profile"],
  });

  const requestMutation = useMutation({
    mutationFn: async (data: typeof form) => {
      const res = await apiRequest("POST", "/api/profile/update-request", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/profile"] });
      setEditOpen(false);
      toast({ title: "Request Submitted", description: "Your profile update request has been sent to the admin for approval." });
    },
    onError: async (err: any) => {
      const body = await err.response?.json?.().catch(() => null);
      toast({ title: "Error", description: body?.message || "Failed to submit request", variant: "destructive" });
    },
  });

  const openEdit = () => {
    setForm({
      fullName: profile?.fullName || "",
      designation: profile?.designation || "",
      department: profile?.department || "",
    });
    setEditOpen(true);
  };

  const handleSubmit = () => {
    if (!form.fullName.trim()) {
      toast({ title: "Validation Error", description: "Full name is required", variant: "destructive" });
      return;
    }
    requestMutation.mutate(form);
  };

  const statusBadge = (status: string) => {
    if (status === "Pending") return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200"><Clock className="w-3 h-3 mr-1" />Pending</Badge>;
    if (status === "Approved") return <Badge className="bg-green-100 text-green-800 border-green-200"><CheckCircle className="w-3 h-3 mr-1" />Approved</Badge>;
    return <Badge className="bg-red-100 text-red-800 border-red-200"><XCircle className="w-3 h-3 mr-1" />Rejected</Badge>;
  };

  if (isLoading) {
    return (
      <LayoutShell>
        <div className="flex items-center justify-center h-64 text-muted-foreground">Loading profile...</div>
      </LayoutShell>
    );
  }

  return (
    <LayoutShell>
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">My Profile</h1>
          <p className="text-muted-foreground text-sm">View your account details and request changes.</p>
        </div>

        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-600 font-bold text-2xl">
                  {(profile?.fullName || profile?.username || "U").slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <CardTitle className="text-xl">{profile?.fullName || profile?.username}</CardTitle>
                  <p className="text-sm text-muted-foreground capitalize">{profile?.role}</p>
                </div>
              </div>
              {!profile?.pendingRequest && (
                <Button onClick={openEdit} variant="outline" size="sm" data-testid="button-edit-profile">
                  <Edit className="w-4 h-4 mr-2" /> Request Changes
                </Button>
              )}
            </div>
          </CardHeader>
          <Separator />
          <CardContent className="pt-6 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <InfoRow icon={<Mail className="w-4 h-4" />} label="Email" value={profile?.username || "-"} />
              <InfoRow icon={<User className="w-4 h-4" />} label="Full Name" value={profile?.fullName || "-"} />
              <InfoRow icon={<IdCard className="w-4 h-4" />} label="Employee Code" value={profile?.employeeCode || "-"} />
              <InfoRow icon={<Briefcase className="w-4 h-4" />} label="Designation" value={profile?.designation || "-"} />
              <InfoRow icon={<Building2 className="w-4 h-4" />} label="Department" value={profile?.department || "-"} />
            </div>
          </CardContent>
        </Card>

        {profile?.pendingRequest && (
          <Card className="border-yellow-200 bg-yellow-50/50 dark:bg-yellow-950/20 dark:border-yellow-900">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Send className="w-4 h-4" /> Profile Update Request
                </CardTitle>
                {statusBadge(profile.pendingRequest.status)}
              </div>
              <CardDescription>
                Submitted on {new Date(profile.pendingRequest.requestedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {Object.entries(profile.pendingRequest.requestedData).map(([key, val]) => (
                  <div key={key} className="flex gap-2 text-sm">
                    <span className="text-muted-foreground capitalize w-28">{key.replace(/([A-Z])/g, " $1")}:</span>
                    <span className="font-medium text-foreground">{val}</span>
                  </div>
                ))}
              </div>
              {profile.pendingRequest.status === "Pending" && (
                <p className="text-xs text-yellow-700 dark:text-yellow-400 mt-3">
                  Waiting for admin approval. You cannot request further changes until this is reviewed.
                </p>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Request Profile Update</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">Fill in the details you want to change. An admin will review and approve your request.</p>
            <div className="space-y-2">
              <Label htmlFor="fullName">Full Name <span className="text-red-500">*</span></Label>
              <Input id="fullName" data-testid="input-fullName" value={form.fullName} onChange={e => setForm(f => ({ ...f, fullName: e.target.value }))} placeholder="Your full name" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="designation">Designation</Label>
              <Input id="designation" data-testid="input-designation" value={form.designation} onChange={e => setForm(f => ({ ...f, designation: e.target.value }))} placeholder="Your designation" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="department">Department</Label>
              <Input id="department" data-testid="input-department" value={form.department} onChange={e => setForm(f => ({ ...f, department: e.target.value }))} placeholder="Your department" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={requestMutation.isPending} data-testid="button-submit-profile-request">
              {requestMutation.isPending ? "Submitting..." : "Submit Request"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </LayoutShell>
  );
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/40">
      <span className="text-muted-foreground mt-0.5">{icon}</span>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-medium text-foreground">{value}</p>
      </div>
    </div>
  );
}

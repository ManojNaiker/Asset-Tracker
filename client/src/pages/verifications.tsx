import { useQuery, useMutation } from "@tanstack/react-query";
import { LayoutShell } from "@/components/layout-shell";
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { FileCheck, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { api, queryClient } from "@/lib/queryClient";
import { Badge } from "@/components/ui/badge";
import { Verification, Allocation } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useState } from "react";

export default function VerificationsPage() {
  const { data: allocations, isLoading } = useQuery<(Allocation & { asset: any, employee: any })[]>({ 
    queryKey: ["/api/allocations"] 
  });

  const { data: verifications } = useQuery<Verification[]>({ 
    queryKey: ["/api/verifications"] 
  });

  if (isLoading) return <LayoutShell><div className="flex justify-center p-8"><Loader2 className="animate-spin text-primary" /></div></LayoutShell>;

  // Filter allocations that are Active and haven't been Approved yet
  const pendingAllocations = allocations?.filter(a => 
    a.status === "Active" && !verifications?.some(v => v.assetId === a.assetId && v.status === "Approved")
  );

  return (
    <LayoutShell>
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Asset Verification</h1>
          <p className="text-muted-foreground mt-1">Verify assets received by employees.</p>
        </div>
      </div>

      <div className="bg-card rounded-xl border border-border shadow-sm overflow-x-auto">
        <Table className="min-w-[800px] md:min-w-full">
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="text-foreground">Asset SN</TableHead>
              <TableHead className="text-foreground">Employee</TableHead>
              <TableHead className="text-foreground">Allocation Date</TableHead>
              <TableHead className="text-foreground">Status</TableHead>
              <TableHead className="text-right text-foreground">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pendingAllocations?.map((alloc) => (
              <TableRow key={alloc.id} className="hover:bg-muted/30 transition-colors">
                <TableCell className="font-mono text-foreground">{alloc.asset.serialNumber}</TableCell>
                <TableCell className="text-foreground">
                  <div>
                    <div className="font-medium">{alloc.employee.name}</div>
                    <div className="text-xs text-muted-foreground">{alloc.employee.empId}</div>
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {new Date(alloc.allocatedAt!).toLocaleDateString()}
                </TableCell>
                <TableCell>
                  <Badge variant="secondary" className="bg-amber-500/10 text-amber-500 border-amber-500/20">
                    Pending Verification
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <VerificationDialog assetId={alloc.assetId} serialNumber={alloc.asset.serialNumber} />
                </TableCell>
              </TableRow>
            ))}
            {(!pendingAllocations || pendingAllocations.length === 0) && (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                  <div className="flex flex-col items-center gap-2">
                    <FileCheck className="w-8 h-8 opacity-20" />
                    <p>No assets pending verification found.</p>
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="mt-12">
        <h2 className="text-xl font-bold mb-4 text-foreground">Verification History</h2>
        <div className="bg-card rounded-xl border border-border shadow-sm overflow-x-auto">
          <Table className="min-w-[800px] md:min-w-full">
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead className="text-foreground">Asset SN</TableHead>
                <TableHead className="text-foreground">Status</TableHead>
                <TableHead className="text-foreground">Date</TableHead>
                <TableHead className="text-foreground">Remarks</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {verifications?.map((v) => {
                const asset = allocations?.find(a => a.assetId === v.assetId)?.asset;
                return (
                  <TableRow key={v.id} className="hover:bg-muted/30 transition-colors">
                    <TableCell className="font-mono text-foreground">{asset?.serialNumber || `#${v.assetId}`}</TableCell>
                    <TableCell>
                      <Badge className={v.status === "Approved" ? "bg-green-500/10 text-green-500 border-green-500/20" : "bg-destructive/10 text-destructive border-destructive/20"} variant="outline">
                        {v.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{new Date(v.verifiedAt!).toLocaleDateString()}</TableCell>
                    <TableCell className="max-w-xs truncate text-muted-foreground">{v.remarks || "-"}</TableCell>
                  </TableRow>
                );
              })}
              {(!verifications || verifications.length === 0) && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                    No history found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </LayoutShell>
  );
}

function VerificationDialog({ assetId, serialNumber }: { assetId: number, serialNumber: string }) {
  const [open, setOpen] = useState(false);
  const [remarks, setRemarks] = useState("");
  const { toast } = useToast();

  const mutation = useMutation({
    mutationFn: async (status: "Approved" | "Rejected") => {
      const res = await fetch("/api/verifications", {
        method: "POST",
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assetId,
          status,
          remarks
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/verifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/allocations"] });
      toast({ title: "Verification submitted successfully" });
      setOpen(false);
      setRemarks("");
    }
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="bg-primary hover:bg-primary/90 shadow-md shadow-primary/10">Verify</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Verify Asset: {serialNumber}</DialogTitle>
          <DialogDescription>
            Confirm if the employee has received this asset. Approved assets will be marked as verified.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4 space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Verification Remarks</label>
            <Textarea 
              placeholder="e.g. Asset received in good condition, charger included..." 
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              className="min-h-[100px] bg-background text-foreground"
            />
          </div>
        </div>
        <DialogFooter className="flex flex-col sm:flex-row gap-2">
          <Button 
            variant="outline"
            className="flex-1 border-destructive/20 text-destructive hover:bg-destructive/10"
            onClick={() => mutation.mutate("Rejected")}
            disabled={mutation.isPending}
          >
            <XCircle className="w-4 h-4 mr-2" /> Reject
          </Button>
          <Button 
            className="flex-1 bg-green-600 hover:bg-green-700 text-white shadow-md shadow-green-500/10"
            onClick={() => mutation.mutate("Approved")}
            disabled={mutation.isPending}
          >
            <CheckCircle2 className="w-4 h-4 mr-2" /> Approve
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

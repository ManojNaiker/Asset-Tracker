import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { LayoutShell } from "@/components/layout-shell";
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from "@/components/ui/table";
import { Box, CheckCircle2, AlertCircle, X } from "lucide-react";
import { Allocation, Asset } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";

export default function MyAssetsPage() {
  const { toast } = useToast();
  const { data: allocations, isLoading } = useQuery<(Allocation & { asset: Asset })[]>({ 
    queryKey: ["/api/allocations"] 
  });

  const verifyMutation = useMutation({
    mutationFn: async ({ assetId, status, remarks }: { assetId: number; status: string; remarks?: string }) => {
      return apiRequest("POST", "/api/verifications", {
        assetId,
        status,
        remarks: remarks || `User self-acknowledgement: ${status}`
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/verifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/allocations"] });
      toast({
        title: "Asset Status Updated",
        description: "Your response has been recorded successfully.",
      });
    },
  });

  const [comment, setComment] = useState("");

  if (isLoading) return <LayoutShell>Loading...</LayoutShell>;

  return (
    <LayoutShell>
      <div className="mb-8">
        <h1 className="text-3xl font-display font-bold text-foreground">Asset Allocation Confirmation</h1>
        <p className="text-muted-foreground mt-1">Review equipment currently assigned to you and acknowledge receipt.</p>
      </div>

      <div className="bg-card rounded-xl border border-border shadow-sm overflow-x-auto mb-6">
        <Table className="min-w-[900px] md:min-w-full">
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="w-12"></TableHead>
              <TableHead className="text-foreground">Inventory No.</TableHead>
              <TableHead className="text-foreground">Asset No.</TableHead>
              <TableHead className="text-foreground">Category</TableHead>
              <TableHead className="text-foreground">Asset Name</TableHead>
              <TableHead className="text-foreground">Description</TableHead>
              <TableHead className="text-foreground">Allocated Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {allocations?.map((a) => (
              <TableRow key={a.id} className="hover:bg-muted/30 transition-colors">
                <TableCell>
                  <input type="checkbox" defaultChecked className="rounded border-border bg-background" />
                </TableCell>
                <TableCell className="text-muted-foreground font-mono text-xs">{a.asset?.serialNumber}</TableCell>
                <TableCell className="text-primary underline text-xs">{a.asset?.serialNumber}</TableCell>
                <TableCell className="text-muted-foreground text-xs">{a.asset?.type?.name || "General"}</TableCell>
                <TableCell className="text-foreground text-xs font-medium">{a.asset?.type?.name}</TableCell>
                <TableCell className="text-muted-foreground text-xs">{a.remarks || "No description provided"}</TableCell>
                <TableCell className="text-muted-foreground text-xs">{a.allocatedAt ? new Date(a.allocatedAt).toLocaleDateString() : "N/A"}</TableCell>
              </TableRow>
            ))}
            {allocations?.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  No assets currently allocated to you.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {allocations && allocations.length > 0 && (
        <div className="space-y-4 max-w-2xl">
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Comment</label>
            <textarea 
              className="w-full min-h-[100px] p-3 rounded-md border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="Add your comments here..."
              value={comment}
              onChange={(e) => setComment(e.target.value)}
            />
          </div>
          
          <div className="flex flex-wrap gap-3">
            <Button 
              className="bg-green-600 hover:bg-green-700 text-white min-w-[120px]"
              onClick={() => {
                if (allocations && allocations.length > 0) {
                  verifyMutation.mutate({ 
                    assetId: allocations[0].assetId, 
                    status: "Approved",
                    remarks: comment 
                  });
                }
              }}
              disabled={verifyMutation.isPending}
            >
              <CheckCircle2 className="w-4 h-4 mr-2" /> Approve
            </Button>
            <Button 
              variant="destructive"
              className="min-w-[120px]"
              onClick={() => {
                if (allocations && allocations.length > 0) {
                  verifyMutation.mutate({ 
                    assetId: allocations[0].assetId, 
                    status: "Rejected",
                    remarks: comment 
                  });
                }
              }}
              disabled={verifyMutation.isPending}
            >
              <X className="w-4 h-4 mr-2" /> Reject
            </Button>
            <Button 
              variant="outline"
              className="bg-primary/10 text-primary border-none hover:bg-primary/20"
            >
              View Other Assignment
            </Button>
          </div>
        </div>
      )}
    </LayoutShell>
  );
}

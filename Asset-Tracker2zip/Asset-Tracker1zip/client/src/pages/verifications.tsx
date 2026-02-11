import { useQuery, useMutation } from "@tanstack/react-query";
import { LayoutShell } from "@/components/layout-shell";
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { FileCheck, Plus, CheckCircle2, XCircle } from "lucide-react";
import { api, queryClient } from "@/lib/queryClient";
import { Badge } from "@/components/ui/badge";
import { Verification } from "@shared/schema";

export default function VerificationsPage() {
  const { data: verifications, isLoading } = useQuery<Verification[]>({ 
    queryKey: ["/api/verifications"] 
  });

  if (isLoading) return <LayoutShell>Loading...</LayoutShell>;

  return (
    <LayoutShell>
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-display font-bold text-slate-900">Verifications</h1>
          <p className="text-muted-foreground mt-1">Review and verify asset allocations.</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50">
              <TableHead>Asset ID</TableHead>
              <TableHead>Verifier ID</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Remarks</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {verifications?.map((v) => (
              <TableRow key={v.id}>
                <TableCell>#{v.assetId}</TableCell>
                <TableCell>#{v.verifierId}</TableCell>
                <TableCell>
                  <Badge variant={v.status === "Approved" ? "default" : v.status === "Rejected" ? "destructive" : "secondary"}>
                    {v.status}
                  </Badge>
                </TableCell>
                <TableCell>{v.verifiedAt ? new Date(v.verifiedAt).toLocaleDateString() : "N/A"}</TableCell>
                <TableCell className="max-w-xs truncate">{v.remarks}</TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="sm">View Details</Button>
                </TableCell>
              </TableRow>
            ))}
            {verifications?.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  No verification records found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </LayoutShell>
  );
}

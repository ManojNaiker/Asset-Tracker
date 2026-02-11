import { useQuery } from "@tanstack/react-query";
import { LayoutShell } from "@/components/layout-shell";
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from "@/components/ui/table";
import { Box } from "lucide-react";
import { Allocation, Asset } from "@shared/schema";

export default function MyAssetsPage() {
  const { data: allocations, isLoading } = useQuery<(Allocation & { asset: Asset })[]>({ 
    queryKey: ["/api/allocations"] 
  });

  // In a real app, we'd filter these by the logged-in user on the backend
  // For now, showing all allocations associated with assets

  if (isLoading) return <LayoutShell>Loading...</LayoutShell>;

  return (
    <LayoutShell>
      <div className="mb-8">
        <h1 className="text-3xl font-display font-bold text-slate-900">My Allocated Assets</h1>
        <p className="text-muted-foreground mt-1">View equipment currently assigned to you.</p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50">
              <TableHead>Asset</TableHead>
              <TableHead>Serial Number</TableHead>
              <TableHead>Allocated Date</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {allocations?.map((a) => (
              <TableRow key={a.id}>
                <TableCell className="font-medium flex items-center gap-2">
                  <Box className="w-4 h-4 text-blue-500" />
                  Asset #{a.assetId}
                </TableCell>
                <TableCell>{a.asset?.serialNumber}</TableCell>
                <TableCell>{a.allocatedAt ? new Date(a.allocatedAt).toLocaleDateString() : "N/A"}</TableCell>
                <TableCell>{a.status}</TableCell>
              </TableRow>
            ))}
            {allocations?.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                  No assets currently allocated to you.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </LayoutShell>
  );
}

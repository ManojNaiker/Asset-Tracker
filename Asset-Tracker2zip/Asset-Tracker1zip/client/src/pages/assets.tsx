import { useState } from "react";
import { useAssets, useCreateAsset, useAssetTypes } from "@/hooks/use-assets";
import { LayoutShell } from "@/components/layout-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertAssetSchema, type InsertAsset } from "@shared/schema";
import { Plus, Search, Filter, Loader2, FileText, Eye, History } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";

export default function AssetsPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined);
  const { data: assets, isLoading } = useAssets({ search, status: statusFilter });
  const { data: assetTypes } = useAssetTypes();

  return (
    <LayoutShell>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-slate-900">Asset Inventory</h1>
          <p className="text-muted-foreground mt-1">Manage and track company assets.</p>
        </div>
        <div className="flex gap-2">
            <CreateAssetDialog assetTypes={assetTypes || []} />
        </div>
      </div>

      <Card className="mb-6 shadow-sm border-slate-200">
        <CardContent className="p-4 flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
                <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                <Input 
                    placeholder="Search by serial number..." 
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9 bg-slate-50 border-slate-200 focus:bg-white transition-colors"
                />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full md:w-[200px]">
                    <div className="flex items-center gap-2">
                        <Filter className="w-4 h-4 text-slate-500" />
                        <SelectValue placeholder="Filter Status" />
                    </div>
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="Available">Available</SelectItem>
                    <SelectItem value="Allocated">Allocated</SelectItem>
                    <SelectItem value="Damaged">Damaged</SelectItem>
                    <SelectItem value="Lost">Lost</SelectItem>
                    <SelectItem value="Scrapped">Scrapped</SelectItem>
                </SelectContent>
            </Select>
            {statusFilter && (
                <Button variant="ghost" onClick={() => setStatusFilter(undefined)}>Clear</Button>
            )}
        </CardContent>
      </Card>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <Table>
          <TableHeader className="bg-slate-50">
            <TableRow>
              <TableHead>Serial Number</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Added Date</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
                <TableRow>
                    <TableCell colSpan={5} className="h-32 text-center">
                        <Loader2 className="w-6 h-6 animate-spin mx-auto text-blue-500" />
                    </TableCell>
                </TableRow>
            ) : assets?.length === 0 ? (
                <TableRow>
                    <TableCell colSpan={5} className="h-32 text-center text-slate-500">
                        No assets found.
                    </TableCell>
                </TableRow>
            ) : (
                assets?.map((asset) => (
                    <TableRow key={asset.id} className="hover:bg-slate-50/50 transition-colors">
                        <TableCell className="font-medium font-mono text-slate-700">{asset.serialNumber}</TableCell>
                        <TableCell>{asset.type.name}</TableCell>
                        <TableCell>
                            <StatusBadge status={asset.status} />
                        </TableCell>
                        <TableCell className="text-slate-500 text-sm">
                            {new Date(asset.createdAt!).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-right">
                            <ViewAssetLifecycleDialog asset={asset} />
                        </TableCell>
                    </TableRow>
                ))
            )}
          </TableBody>
        </Table>
      </div>
    </LayoutShell>
  );
}

function ViewAssetLifecycleDialog({ asset }: { asset: any }) {
    const { data: allocations, isLoading } = useQuery<(any)[]>({
        queryKey: ["/api/allocations"],
    });

    const assetAllocations = allocations?.filter(a => a.assetId === asset.id);

    return (
        <Dialog>
            <DialogTrigger asChild>
                <Button variant="ghost" size="sm" className="text-blue-600 hover:text-blue-700">
                    <Eye className="w-4 h-4 mr-1" /> View
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px]">
                <DialogHeader>
                    <DialogTitle>Asset Lifecycle: {asset.serialNumber}</DialogTitle>
                </DialogHeader>
                <div className="space-y-6 py-4">
                    <div className="grid grid-cols-3 gap-4 bg-slate-50 p-4 rounded-lg border border-slate-100">
                        <div>
                            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Type</p>
                            <p className="text-sm font-medium">{asset.type?.name}</p>
                        </div>
                        <div>
                            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Status</p>
                            <StatusBadge status={asset.status} />
                        </div>
                        <div>
                            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Added On</p>
                            <p className="text-sm font-medium">{new Date(asset.createdAt).toLocaleDateString()}</p>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                            <History className="w-4 h-4" /> Allocation History
                        </h3>
                        {isLoading ? (
                            <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-blue-500" /></div>
                        ) : !assetAllocations || assetAllocations.length === 0 ? (
                            <p className="text-center py-4 text-slate-500 text-sm">No allocation history found.</p>
                        ) : (
                            <div className="relative border-l-2 border-slate-100 ml-3 pl-6 space-y-6">
                                {assetAllocations.map((a, i) => (
                                    <div key={a.id} className="relative">
                                        <div className="absolute -left-[31px] top-1 w-4 h-4 rounded-full bg-white border-2 border-blue-500" />
                                        <div className="space-y-1">
                                            <div className="flex justify-between items-start">
                                                <p className="text-sm font-semibold text-slate-900">
                                                    Allocated to {a.employee?.name}
                                                </p>
                                                <Badge variant="outline" className="text-[10px]">{a.status}</Badge>
                                            </div>
                                            <p className="text-xs text-slate-500">
                                                {new Date(a.allocatedAt).toLocaleString()}
                                            </p>
                                            {a.returnDate && (
                                                <p className="text-xs text-orange-600 font-medium">
                                                    Returned: {new Date(a.returnDate).toLocaleString()}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

function StatusBadge({ status }: { status: string }) {
    const styles: Record<string, string> = {
        Available: "bg-green-100 text-green-700 border-green-200",
        Allocated: "bg-blue-100 text-blue-700 border-blue-200",
        Damaged: "bg-red-100 text-red-700 border-red-200",
        Lost: "bg-orange-100 text-orange-700 border-orange-200",
        Scrapped: "bg-slate-100 text-slate-700 border-slate-200",
    };
    return <Badge variant="outline" className={`${styles[status] || "bg-slate-100"} px-2 py-0.5 rounded-full`}>{status}</Badge>;
}

function CreateAssetDialog({ assetTypes }: { assetTypes: any[] }) {
    const [open, setOpen] = useState(false);
    const mutation = useCreateAsset();
    const form = useForm<InsertAsset>({
        resolver: zodResolver(insertAssetSchema),
        defaultValues: {
            assetTypeId: undefined as any,
            serialNumber: "",
            status: "Available",
            specifications: {},
            images: [],
        }
    });

    const onSubmit = (data: InsertAsset) => {
        // Ensure numbers are numbers
        const submissionData = {
            ...data,
            assetTypeId: Number(data.assetTypeId)
        };
        mutation.mutate(submissionData, {
            onSuccess: () => {
                setOpen(false);
                form.reset();
            }
        });
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button className="bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-500/20">
                    <Plus className="w-4 h-4 mr-2" /> Add Asset
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Add New Asset</DialogTitle>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <FormField
                            control={form.control}
                            name="serialNumber"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Serial Number</FormLabel>
                                    <FormControl>
                                        <Input placeholder="SN-12345" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="assetTypeId"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Asset Type</FormLabel>
                                    <Select 
                                        onValueChange={(val) => {
                                            field.onChange(Number(val));
                                        }} 
                                        value={field.value ? String(field.value) : ""}
                                    >
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select type" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            {assetTypes.map(t => (
                                                <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <Button type="submit" className="w-full" disabled={mutation.isPending}>
                            {mutation.isPending ? "Adding..." : "Add Asset"}
                        </Button>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}

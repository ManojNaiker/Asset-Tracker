import { useState, useRef } from "react";
import { useAllocations, useCreateAllocation, useReturnAllocation } from "@/hooks/use-allocations";
import { useAssets, useAssetTypes } from "@/hooks/use-assets";
import { useEmployees } from "@/hooks/use-employees";
import { LayoutShell } from "@/components/layout-shell";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertAllocationSchema, type InsertAllocation } from "@shared/schema";
import { Plus, Loader2, ArrowRightLeft, CheckCircle2, Camera, X, Upload } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { BulkAllocationUploadDialog } from "@/components/bulk-upload-dialogs";

export default function AllocationsPage() {
  const { data: allocations, isLoading } = useAllocations();

  return (
    <LayoutShell>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-slate-900">Allocations</h1>
          <p className="text-muted-foreground mt-1">Assign assets to employees.</p>
        </div>
        <div className="flex gap-2">
            <BulkAllocationUploadDialog />
            <CreateAllocationDialog />
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <Table>
          <TableHeader className="bg-slate-50">
            <TableRow>
              <TableHead>Asset SN</TableHead>
              <TableHead>Employee</TableHead>
              <TableHead>Department</TableHead>
              <TableHead>Allocated Date</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
                <TableRow>
                    <TableCell colSpan={6} className="h-32 text-center">
                        <Loader2 className="w-6 h-6 animate-spin mx-auto text-blue-500" />
                    </TableCell>
                </TableRow>
            ) : allocations?.length === 0 ? (
                <TableRow>
                    <TableCell colSpan={6} className="h-32 text-center text-slate-500">
                        No active allocations.
                    </TableCell>
                </TableRow>
            ) : (
                allocations?.map((alloc) => (
                    <TableRow key={alloc.id} className="hover:bg-slate-50/50">
                        <TableCell className="font-medium font-mono">{alloc.asset.serialNumber}</TableCell>
                        <TableCell>
                            <div className="flex flex-col">
                                <span className="font-medium text-slate-900">{alloc.employee.name}</span>
                                <span className="text-xs text-slate-500">{alloc.employee.empId}</span>
                            </div>
                        </TableCell>
                        <TableCell className="text-slate-600">{alloc.employee.department}</TableCell>
                        <TableCell className="text-slate-500">
                            {new Date(alloc.allocatedAt!).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                            <Badge variant="outline" className={alloc.status === 'Active' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-slate-100'}>
                                {alloc.status}
                            </Badge>
                        </TableCell>
                        <TableCell className="text-right space-x-2">
                           <ViewAllocationDetailsDialog allocation={alloc} />
                           {alloc.status === 'Active' && (
                               <ReturnAssetDialog allocationId={alloc.id} />
                           )}
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

function ViewAllocationDetailsDialog({ allocation }: { allocation: any }) {
    return (
        <Dialog>
            <DialogTrigger asChild>
                <Button variant="ghost" size="sm">Details</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>Allocation Details</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <p className="text-xs text-slate-500 font-medium uppercase">Asset</p>
                            <p className="font-mono">{allocation.asset.serialNumber}</p>
                        </div>
                        <div>
                            <p className="text-xs text-slate-500 font-medium uppercase">Employee</p>
                            <p>{allocation.employee.name} ({allocation.employee.empId})</p>
                        </div>
                        <div>
                            <p className="text-xs text-slate-500 font-medium uppercase">Date</p>
                            <p>{new Date(allocation.allocatedAt).toLocaleDateString()}</p>
                        </div>
                        <div>
                            <p className="text-xs text-slate-500 font-medium uppercase">Status</p>
                            <Badge variant="outline">{allocation.status}</Badge>
                        </div>
                    </div>
                    {allocation.returnReason && (
                        <div>
                            <p className="text-xs text-slate-500 font-medium uppercase">Return Reason</p>
                            <p className="text-slate-700">{allocation.returnReason}</p>
                        </div>
                    )}
                    <div className="border-t pt-4">
                        <p className="text-xs text-slate-500 font-medium uppercase mb-2">Audit Trail</p>
                        <div className="space-y-2">
                             <div className="text-sm bg-slate-50 p-2 rounded border border-slate-100">
                                <span className="text-slate-500">{new Date(allocation.allocatedAt).toLocaleString()}</span> - Asset Allocated
                             </div>
                             {allocation.returnDate && (
                                 <div className="text-sm bg-slate-50 p-2 rounded border border-slate-100">
                                    <span className="text-slate-500">{new Date(allocation.returnDate).toLocaleString()}</span> - Asset Returned
                                 </div>
                             )}
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

function CreateAllocationDialog() {
    const [open, setOpen] = useState(false);
    const mutation = useCreateAllocation();
    // Only fetch AVAILABLE assets
    const { data: assets } = useAssets({ status: "Available" });
    const { data: employees } = useEmployees();
    const { data: assetTypes } = useAssetTypes();

    const form = useForm<any>({
        defaultValues: {
            mode: "select",
            assetId: "",
            employeeId: "",
            empId: "",
            name: "",
            email: "",
            serialNumber: "",
            assetTypeId: "",
            status: "Active",
            remarks: ""
        }
    });

    const [uploading, setUploading] = useState(false);
    const [imageUrl, setImageUrl] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { toast } = useToast();

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploading(true);
        const formData = new FormData();
        formData.append("image", file);

        try {
            const res = await fetch("/api/upload", {
                method: "POST",
                body: formData
            });
            const data = await res.json();
            setImageUrl(data.url);
        } catch (err) {
            toast({ title: "Upload failed", variant: "destructive" });
        } finally {
            setUploading(false);
        }
    };

    const onSubmit = (data: any) => {
        const payload: any = {
            status: data.status,
            remarks: data.remarks,
            details: imageUrl ? { imageUrl } : {}
        };

        if (data.mode === "select") {
            payload.assetId = Number(data.assetId);
            payload.employeeId = Number(data.employeeId);
        } else {
            payload.employeeData = {
                empId: data.empId,
                name: data.name,
                email: data.email,
                branch: data.branch,
                department: data.department,
                designation: data.designation,
                mobile: data.mobile,
                status: "Active"
            };
            payload.assetData = {
                serialNumber: data.serialNumber,
                assetTypeId: Number(data.assetTypeId),
                status: "Available",
                specifications: {}
            };
        }

        mutation.mutate(payload, {
            onSuccess: () => {
                setOpen(false);
                form.reset();
                setImageUrl(null);
            }
        });
    };

    const mode = form.watch("mode");

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button className="bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-500/20">
                    <ArrowRightLeft className="w-4 h-4 mr-2" /> Allocate Asset
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Allocate Asset</DialogTitle>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <FormField
                            control={form.control}
                            name="mode"
                            render={({ field }) => (
                                <FormItem className="space-y-3">
                                    <FormControl>
                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Selection Mode" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="select">Select Existing</SelectItem>
                                                <SelectItem value="create">Auto-Create New</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </FormControl>
                                </FormItem>
                            )}
                        />

                        {mode === "select" ? (
                            <>
                                <FormField
                                    control={form.control}
                                    name="employeeId"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Employee</FormLabel>
                                            <Select onValueChange={field.onChange} value={field.value}>
                                                <FormControl>
                                                    <SelectTrigger>
                                                        <SelectValue placeholder="Select Employee" />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    {employees?.map(e => (
                                                        <SelectItem key={e.id} value={String(e.id)}>{e.name} ({e.empId})</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="assetId"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Available Asset</FormLabel>
                                            <Select onValueChange={field.onChange} value={field.value}>
                                                <FormControl>
                                                    <SelectTrigger>
                                                        <SelectValue placeholder="Select Asset" />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    {assets?.map(a => (
                                                        <SelectItem key={a.id} value={String(a.id)}>{a.serialNumber} ({a.type.name})</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </>
                        ) : (
                            <div className="space-y-4 border-t pt-4 mt-4">
                                <h3 className="font-medium text-sm text-slate-900">New Employee Info</h3>
                                <div className="grid grid-cols-2 gap-2">
                                    <FormField
                                        control={form.control}
                                        name="empId"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Emp ID</FormLabel>
                                                <FormControl><Input {...field} /></FormControl>
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="name"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Name</FormLabel>
                                                <FormControl><Input {...field} /></FormControl>
                                            </FormItem>
                                        )}
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    <FormField
                                        control={form.control}
                                        name="branch"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Branch</FormLabel>
                                                <FormControl><Input {...field} /></FormControl>
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="department"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Department</FormLabel>
                                                <FormControl><Input {...field} /></FormControl>
                                            </FormItem>
                                        )}
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    <FormField
                                        control={form.control}
                                        name="designation"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Designation</FormLabel>
                                                <FormControl><Input {...field} /></FormControl>
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="mobile"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Mobile</FormLabel>
                                                <FormControl><Input {...field} /></FormControl>
                                            </FormItem>
                                        )}
                                    />
                                </div>
                                <FormField
                                    control={form.control}
                                    name="email"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Email</FormLabel>
                                            <FormControl><Input {...field} type="email" /></FormControl>
                                        </FormItem>
                                    )}
                                />
                                <h3 className="font-medium text-sm text-slate-900 border-t pt-4">New Asset Info</h3>
                                <div className="grid grid-cols-2 gap-2">
                                    <FormField
                                        control={form.control}
                                        name="serialNumber"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Serial No</FormLabel>
                                                <FormControl><Input {...field} /></FormControl>
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="assetTypeId"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Type</FormLabel>
                                                <Select onValueChange={field.onChange} value={field.value}>
                                                    <FormControl><SelectTrigger><SelectValue placeholder="Type" /></SelectTrigger></FormControl>
                                                    <SelectContent>
                                                        {assetTypes?.map(t => (
                                                            <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </FormItem>
                                        )}
                                    />
                                </div>
                            </div>
                        )}
                        <FormField
                            control={form.control}
                            name="remarks"
                            render={({ field }) => (
                                <FormItem className="border-t pt-4">
                                    <FormLabel>Remarks</FormLabel>
                                    <FormControl><Input {...field} placeholder="Internal notes..." /></FormControl>
                                </FormItem>
                            )}
                        />
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Asset Photo (Allocation)</label>
                            <div className="flex items-center gap-4">
                                <input 
                                    type="file" 
                                    className="hidden" 
                                    ref={fileInputRef} 
                                    accept="image/*" 
                                    onChange={handleFileUpload}
                                />
                                {imageUrl ? (
                                    <div className="relative w-24 h-24 rounded border overflow-hidden">
                                        <img src={imageUrl} alt="Asset" className="w-full h-full object-cover" />
                                        <button 
                                            type="button"
                                            onClick={() => setImageUrl(null)}
                                            className="absolute top-1 right-1 bg-white rounded-full p-0.5 shadow"
                                        >
                                            <X className="w-3 h-3 text-red-500" />
                                        </button>
                                    </div>
                                ) : (
                                    <Button 
                                        type="button" 
                                        variant="outline" 
                                        className="w-24 h-24 border-dashed"
                                        onClick={() => fileInputRef.current?.click()}
                                        disabled={uploading}
                                    >
                                        {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-6 h-6 text-slate-400" />}
                                    </Button>
                                )}
                            </div>
                        </div>
                        <Button type="submit" className="w-full" disabled={mutation.isPending}>
                            {mutation.isPending ? "Allocating..." : "Allocate Asset"}
                        </Button>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}

function ReturnAssetDialog({ allocationId }: { allocationId: number }) {
    const [open, setOpen] = useState(false);
    const mutation = useReturnAllocation();
    const [reason, setReason] = useState("");
    const [status, setStatus] = useState("Available");
    const [imageUrl, setImageUrl] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { toast } = useToast();

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const formData = new FormData();
        formData.append("image", file);

        try {
            const res = await fetch("/api/upload", {
                method: "POST",
                body: formData
            });
            const data = await res.json();
            setImageUrl(data.url);
        } catch (err) {
            toast({ title: "Upload failed", variant: "destructive" });
        }
    };

    const handleSubmit = () => {
        mutation.mutate({ 
            id: allocationId, 
            returnReason: reason, 
            status,
            details: imageUrl ? { imageUrl } : {}
        } as any, {
            onSuccess: () => {
                setOpen(false);
                setImageUrl(null);
                setReason("");
            }
        });
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="text-orange-600 hover:text-orange-700 hover:bg-orange-50 border-orange-200">
                    Return
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Return Asset</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Return Reason</label>
                        <Input 
                            placeholder="e.g. Employee left, Upgrade" 
                            value={reason} 
                            onChange={e => setReason(e.target.value)} 
                        />
                    </div>
                    <div className="space-y-2">
                         <label className="text-sm font-medium">New Asset Status</label>
                         <Select value={status} onValueChange={setStatus}>
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="Available">Available</SelectItem>
                                <SelectItem value="Damaged">Damaged</SelectItem>
                                <SelectItem value="Scrapped">Scrapped</SelectItem>
                            </SelectContent>
                         </Select>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium">Asset Photo (Return)</label>
                        <div className="flex items-center gap-4">
                            <input 
                                type="file" 
                                className="hidden" 
                                ref={fileInputRef} 
                                accept="image/*" 
                                onChange={handleFileUpload}
                            />
                            {imageUrl ? (
                                <div className="relative w-24 h-24 rounded border overflow-hidden">
                                    <img src={imageUrl} alt="Asset" className="w-full h-full object-cover" />
                                    <button 
                                        onClick={() => setImageUrl(null)}
                                        className="absolute top-1 right-1 bg-white rounded-full p-0.5 shadow"
                                    >
                                        <X className="w-3 h-3 text-red-500" />
                                    </button>
                                </div>
                            ) : (
                                <Button 
                                    type="button" 
                                    variant="outline" 
                                    className="w-24 h-24 border-dashed"
                                    onClick={() => fileInputRef.current?.click()}
                                >
                                    <Camera className="w-6 h-6 text-slate-400" />
                                </Button>
                            )}
                        </div>
                    </div>

                    <Button onClick={handleSubmit} className="w-full" disabled={mutation.isPending || !reason}>
                        {mutation.isPending ? "Processing..." : "Confirm Return"}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}

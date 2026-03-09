import { useState, useRef, useMemo } from "react";
import { useAllocations, useCreateAllocation, useReturnAllocation } from "@/hooks/use-allocations";
import { useAssets, useAssetTypes } from "@/hooks/use-assets";
import { useEmployees } from "@/hooks/use-employees";
import { useDepartments, useDesignations, useCreateDepartment, useCreateDesignation } from "@/hooks/use-settings";
import { LayoutShell } from "@/components/layout-shell";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertAllocationSchema, type InsertAllocation } from "@shared/schema";
import { Plus, Loader2, ArrowRightLeft, CheckCircle2, Camera, X, Upload, Send, Check, ChevronsUpDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { api, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { BulkAllocationUploadDialog } from "@/components/bulk-upload-dialogs";
import { QRBarcodeScanner } from "@/components/qr-barcode-scanner";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { ImagePreview } from "@/components/image-preview";
import { Textarea } from "@/components/ui/textarea";

function ComboboxFieldWithAdd({ label, options, value, onChange, placeholder, onAddNew }: {
  label: string;
  options: { label: string; value: string }[];
  value: string;
  onChange: (val: string) => void;
  onAddNew?: (name: string) => Promise<void>;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const { toast } = useToast();

  const handleAddNew = async () => {
    if (!inputValue.trim() || !onAddNew) return;
    try {
      setIsAdding(true);
      await onAddNew(inputValue.trim());
      setInputValue("");
      onChange(inputValue.trim());
      toast({ title: "Success", description: `${label} added successfully` });
    } catch (error) {
      toast({ title: "Error", description: `Failed to add ${label}`, variant: "destructive" });
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <div className="space-y-2">
      <FormLabel>{label}</FormLabel>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className={cn("w-full justify-between font-normal", !value && "text-muted-foreground")}
          >
            {value ? options.find(o => o.value === value)?.label || value : (placeholder || "Select...")}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-full p-0" align="start">
          <Command>
            <CommandInput 
              placeholder={`Search ${label.toLowerCase()}...`}
              value={inputValue}
              onValueChange={setInputValue}
            />
            <CommandList>
              <CommandEmpty>
                {inputValue && onAddNew ? (
                  <div className="flex flex-col gap-2 p-2">
                    <p className="text-xs text-muted-foreground">"{inputValue}" not found</p>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleAddNew}
                      disabled={isAdding}
                      className="w-full"
                    >
                      {isAdding ? "Adding..." : `Add "${inputValue}"`}
                    </Button>
                  </div>
                ) : (
                  "No results found."
                )}
              </CommandEmpty>
              <CommandGroup>
                {options.map((option) => (
                  <CommandItem
                    key={option.value}
                    value={option.label}
                    onSelect={() => { onChange(option.value); setOpen(false); setInputValue(""); }}
                  >
                    <Check className={cn("mr-2 h-4 w-4", value === option.value ? "opacity-100" : "opacity-0")} />
                    {option.label}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}

export default function AllocationsPage() {
  const { data: allocations, isLoading } = useAllocations();

  return (
    <LayoutShell>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Allocations</h1>
          <p className="text-muted-foreground mt-1">Assign assets to employees.</p>
        </div>
        <div className="flex gap-2">
            <BulkAllocationUploadDialog />
            <CreateAllocationDialog />
        </div>
      </div>

      <div className="bg-card rounded-xl shadow-sm border border-border overflow-x-auto">
        <Table className="min-w-[800px] md:min-w-full">
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead className="text-foreground">Asset SN</TableHead>
              <TableHead className="text-foreground">Employee</TableHead>
              <TableHead className="text-foreground">Department</TableHead>
              <TableHead className="text-foreground">Allocated Date</TableHead>
              <TableHead className="text-foreground">Status</TableHead>
              <TableHead className="text-right text-foreground">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
                <TableRow>
                    <TableCell colSpan={6} className="h-32 text-center">
                        <Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" />
                    </TableCell>
                </TableRow>
            ) : allocations?.length === 0 ? (
                <TableRow>
                    <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                        No active allocations.
                    </TableCell>
                </TableRow>
            ) : (
                allocations?.map((alloc) => (
                    <TableRow key={alloc.id} className="hover:bg-muted/30 transition-colors">
                        <TableCell className="font-medium font-mono text-foreground">{alloc.asset.serialNumber}</TableCell>
                        <TableCell className="text-foreground">
                            <div className="flex flex-col">
                                <span className="font-medium">{alloc.employee.name}</span>
                                <span className="text-xs text-muted-foreground">{alloc.employee.empId}</span>
                            </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{alloc.employee.department}</TableCell>
                        <TableCell className="text-muted-foreground">
                            {new Date(alloc.allocatedAt!).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                            <Badge variant="outline" className={alloc.status === 'Active' ? 'bg-primary/10 text-primary border-primary/20' : 'bg-muted text-muted-foreground'}>
                                {alloc.status}
                            </Badge>
                        </TableCell>
                        <TableCell className="text-right space-x-2">
                           <SendVerificationButton 
                             allocationId={alloc.id} 
                             disabled={alloc.status !== 'Active' || alloc.verificationStatus === 'Approved' || alloc.verificationStatus === 'Rejected'} 
                           />
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

function SendVerificationButton({ allocationId, disabled }: { allocationId: number, disabled: boolean }) {
    const { toast } = useToast();
    const [loading, setLoading] = useState(false);

    const sendEmail = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/allocations/${allocationId}/send-verification`, { method: "POST" });
            if (!res.ok) throw new Error(await res.text());
            toast({ title: "Email sent successfully" });
        } catch (err: any) {
            toast({ title: "Failed to send email", description: err.message, variant: "destructive" });
        } finally {
            setLoading(false);
        }
    };

    return (
        <Button 
            variant="ghost" 
            size="sm" 
            onClick={sendEmail} 
            disabled={disabled || loading}
            className="text-primary hover:text-primary/80 hover:bg-primary/10"
        >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </Button>
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
                            <p className="text-xs text-muted-foreground font-medium uppercase">Asset</p>
                            <p className="font-mono text-foreground">{allocation.asset.serialNumber}</p>
                        </div>
                        <div>
                            <p className="text-xs text-muted-foreground font-medium uppercase">Employee</p>
                            <p className="text-foreground">{allocation.employee.name} ({allocation.employee.empId})</p>
                        </div>
                        <div>
                            <p className="text-xs text-muted-foreground font-medium uppercase">Date</p>
                            <p className="text-foreground">{new Date(allocation.allocatedAt).toLocaleDateString()}</p>
                        </div>
                        <div>
                            <p className="text-xs text-muted-foreground font-medium uppercase">Status</p>
                            <Badge variant="outline">{allocation.status}</Badge>
                        </div>
                    </div>
                    {allocation.returnReason && (
                        <div>
                            <p className="text-xs text-muted-foreground font-medium uppercase">Return Reason</p>
                            <p className="text-foreground">{allocation.returnReason}</p>
                        </div>
                    )}
                    <div className="border-t border-border pt-4">
                        <p className="text-xs text-muted-foreground font-medium uppercase mb-2">Audit Trail</p>
                        <div className="space-y-2">
                             <div className="text-sm bg-muted/50 p-2 rounded border border-border">
                                <span className="text-muted-foreground">{new Date(allocation.allocatedAt).toLocaleString()}</span> - Asset Allocated
                             </div>
                             {allocation.verificationStatus && allocation.verificationStatus !== 'Pending' && (
                                 <div className="text-sm bg-primary/10 p-2 rounded border border-primary/20">
                                    <span className="text-muted-foreground">Verification Status:</span> 
                                    <Badge variant="outline" className="ml-2 h-5 text-[10px]">
                                        {allocation.verificationStatus}
                                    </Badge>
                                 </div>
                             )}
                             {allocation.returnDate && (
                                 <div className="text-sm bg-muted/50 p-2 rounded border border-border">
                                    <span className="text-muted-foreground">{new Date(allocation.returnDate).toLocaleString()}</span> - Asset Returned
                                 </div>
                             )}
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

function ReturnAssetDialog({ allocationId }: { allocationId: number }) {
    const [open, setOpen] = useState(false);
    const [reason, setRemarks] = useState("");
    const { toast } = useToast();
    const mutation = useReturnAllocation();

    const onSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        mutation.mutate({ id: allocationId, returnReason: reason, status: "Returned" }, {
            onSuccess: () => {
                setOpen(false);
                setRemarks("");
                toast({ title: "Asset returned successfully" });
            }
        });
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="ghost" size="sm" className="text-destructive hover:bg-destructive/10">Return</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Return Asset</DialogTitle>
                </DialogHeader>
                <form onSubmit={onSubmit} className="space-y-4">
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Return Reason</label>
                        <Input 
                            value={reason} 
                            onChange={(e) => setRemarks(e.target.value)} 
                            placeholder="e.g. Employee resignation, asset upgrade..."
                            required
                        />
                    </div>
                    <Button type="submit" variant="destructive" className="w-full" disabled={mutation.isPending}>
                        {mutation.isPending ? "Processing..." : "Confirm Return"}
                    </Button>
                </form>
            </DialogContent>
        </Dialog>
    );
}

function CreateAllocationDialog() {
    const [open, setOpen] = useState(false);
    const mutation = useCreateAllocation();
    const { data: assets } = useAssets({ status: "Available" });
    const { data: employees } = useEmployees();
    const { data: assetTypes } = useAssetTypes();
    const { data: departments } = useDepartments();
    const { data: designations } = useDesignations();
    const createDeptMutation = useCreateDepartment();
    const createDesigMutation = useCreateDesignation();

    const deptOptions = useMemo(() => 
      departments?.map(d => ({ label: d.name, value: d.name })) || [], 
      [departments]
    );
    
    const desigOptions = useMemo(() => 
      designations?.map(d => ({ label: d.name, value: d.name })) || [], 
      [designations]
    );

    const handleAddDepartment = async (name: string): Promise<void> => {
      return new Promise((resolve, reject) => {
        createDeptMutation.mutate({ name }, {
          onSuccess: () => resolve(),
          onError: reject
        });
      });
    };

    const handleAddDesignation = async (name: string): Promise<void> => {
      return new Promise((resolve, reject) => {
        createDesigMutation.mutate({ name }, {
          onSuccess: () => resolve(),
          onError: reject
        });
      });
    };

    const form = useForm<any>({
        defaultValues: {
            mode: "select",
            assetId: "",
            employeeId: "",
            empId: "",
            name: "",
            email: "",
            branch: "",
            department: "",
            designation: "",
            mobile: "",
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
            imageUrl: imageUrl || undefined
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
                <Button className="bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20">
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
                            <div className="space-y-4 border-t border-border pt-4 mt-4">
                                <h3 className="font-medium text-sm text-foreground">New Employee Info</h3>
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
                                    <ComboboxFieldWithAdd 
                                        label="Department"
                                        options={deptOptions}
                                        value={form.watch("department")}
                                        onChange={(val) => form.setValue("department", val)}
                                        onAddNew={handleAddDepartment}
                                        placeholder="Select or add department"
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    <ComboboxFieldWithAdd 
                                        label="Designation"
                                        options={desigOptions}
                                        value={form.watch("designation")}
                                        onChange={(val) => form.setValue("designation", val)}
                                        onAddNew={handleAddDesignation}
                                        placeholder="Select or add designation"
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

                                <h3 className="font-medium text-sm text-foreground border-t border-border pt-4">New Asset Info</h3>
                                <div className="grid grid-cols-2 gap-2">
                                    <FormField
                                        control={form.control}
                                        name="serialNumber"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Serial Number</FormLabel>
                                                <div className="relative">
                                                    <FormControl><Input {...field} onChange={e => field.onChange(e.target.value.toUpperCase())} placeholder="SN-12345" className="pr-10" /></FormControl>
                                                    <QRBarcodeScanner 
                                                        onDetected={(value) => field.onChange(value)} 
                                                        placeholder="SN-12345"
                                                        inline
                                                    />
                                                </div>
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="assetTypeId"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Asset Type</FormLabel>
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

                        <div className="space-y-2 border-t border-border pt-4">
                            <FormLabel>Asset Photo (Optional)</FormLabel>
                            <div 
                                onClick={() => fileInputRef.current?.click()}
                                className="border-2 border-dashed border-border rounded-lg p-4 flex flex-col items-center justify-center cursor-pointer hover:bg-muted/50 transition-colors"
                            >
                                <input 
                                    type="file" 
                                    ref={fileInputRef} 
                                    className="hidden" 
                                    accept="image/*"
                                    onChange={handleFileUpload}
                                />
                                {imageUrl ? (
                                    <div className="relative w-full aspect-video">
                                        <img src={imageUrl} className="w-full h-full object-cover rounded" />
                                        <Button 
                                            size="icon" 
                                            variant="destructive" 
                                            className="absolute top-1 right-1 h-6 w-6"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setImageUrl(null);
                                            }}
                                        >
                                            <X className="w-3 h-3" />
                                        </Button>
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center">
                                        {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-6 h-6 text-muted-foreground" />}
                                        <p className="text-xs text-muted-foreground mt-2">Click to upload asset image</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        <FormField
                            control={form.control}
                            name="remarks"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Remarks</FormLabel>
                                    <FormControl><Textarea {...field} placeholder="Allocation notes..." /></FormControl>
                                </FormItem>
                            )}
                        />

                        <Button type="submit" className="w-full" disabled={mutation.isPending || uploading}>
                            {mutation.isPending ? "Creating..." : "Confirm Allocation"}
                        </Button>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}

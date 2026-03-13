import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { LayoutShell } from "@/components/layout-shell";
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Plus, Pencil, Settings2, Trash2, X } from "lucide-react";
import { api, queryClient } from "@/lib/queryClient";
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger 
} from "@/components/ui/dialog";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertAssetTypeSchema } from "@shared/schema";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { AssetType } from "@shared/schema";
import { Badge } from "@/components/ui/badge";

const FIELD_TYPES = [
  { value: "text", label: "Text" },
  { value: "number", label: "Number" },
  { value: "date", label: "Date" },
  { value: "boolean", label: "Yes / No" },
  { value: "dropdown", label: "Dropdown" },
];

interface SchemaField {
  name: string;
  type: string;
  required?: boolean;
  options?: string[];
}

// ── Edit Asset Type Dialog ──────────────────────────────────────────────────
function EditAssetTypeDialog({ type, onClose }: { type: AssetType; onClose: () => void }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(true);

  const form = useForm({
    resolver: zodResolver(insertAssetTypeSchema),
    defaultValues: {
      name: type.name,
      description: type.description ?? "",
      schema: type.schema ?? [],
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (values: any) => {
      const res = await api.put(`/api/asset-types/${type.id}`, values);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/asset-types"] });
      toast({ title: "Saved", description: "Asset type updated successfully." });
      setOpen(false);
      onClose();
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message || "Failed to update asset type.", variant: "destructive" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { setOpen(false); onClose(); } }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Asset Type</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((v) => updateMutation.mutate(v))} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl><Input {...field} className="bg-background" /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl><Textarea {...field} className="bg-background" /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" className="w-full" disabled={updateMutation.isPending}>
              {updateMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

// ── Schema Fields Dialog ────────────────────────────────────────────────────
function SchemaFieldsDialog({ type, onClose }: { type: AssetType; onClose: () => void }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(true);
  const [fields, setFields] = useState<SchemaField[]>(
    Array.isArray(type.schema) ? (type.schema as SchemaField[]) : []
  );
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState("text");
  const [newRequired, setNewRequired] = useState(false);
  const [newOptions, setNewOptions] = useState("");

  const saveMutation = useMutation({
    mutationFn: async (schema: SchemaField[]) => {
      const res = await api.put(`/api/asset-types/${type.id}`, {
        name: type.name,
        description: type.description ?? "",
        schema,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/asset-types"] });
      toast({ title: "Saved", description: "Schema fields updated." });
      setOpen(false);
      onClose();
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message || "Failed to save.", variant: "destructive" });
    },
  });

  const addField = () => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    if (fields.some((f) => f.name.toLowerCase() === trimmed.toLowerCase())) {
      toast({ title: "Duplicate", description: "A field with this name already exists.", variant: "destructive" });
      return;
    }

    const field: SchemaField = { name: trimmed, type: newType, required: newRequired };

    if (newType === "dropdown") {
      const opts = newOptions.split(",").map(o => o.trim()).filter(Boolean);
      if (opts.length === 0) {
        toast({ title: "Missing Options", description: "Please add at least one dropdown option.", variant: "destructive" });
        return;
      }
      field.options = opts;
    }

    setFields((prev) => [...prev, field]);
    setNewName("");
    setNewType("text");
    setNewRequired(false);
    setNewOptions("");
  };

  const removeField = (idx: number) => {
    setFields((prev) => prev.filter((_, i) => i !== idx));
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { setOpen(false); onClose(); } }}>
      <DialogContent className="sm:max-w-[540px]">
        <DialogHeader>
          <DialogTitle>Schema Fields — {type.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
          {/* Existing fields */}
          {fields.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No fields defined yet.</p>
          ) : (
            <div className="space-y-2">
              {fields.map((f, i) => (
                <div key={i} className="flex items-center justify-between bg-muted/40 rounded-lg px-3 py-2 border border-border">
                  <div className="flex items-start gap-2 flex-1 min-w-0">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-foreground">{f.name}</span>
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 capitalize">{f.type}</Badge>
                        {f.required && <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Required</Badge>}
                      </div>
                      {f.type === "dropdown" && f.options && f.options.length > 0 && (
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">
                          Options: {f.options.join(", ")}
                        </p>
                      )}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive hover:text-destructive shrink-0 ml-2"
                    onClick={() => removeField(i)}
                    data-testid={`button-remove-field-${i}`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          {/* Add new field row */}
          <div className="border-t border-border pt-4 space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Add New Field</p>
            <div className="flex gap-2">
              <Input
                placeholder="Field name (e.g. RAM)"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addField())}
                className="bg-background flex-1"
                data-testid="input-new-field-name"
              />
              <Select value={newType} onValueChange={(v) => { setNewType(v); setNewOptions(""); }}>
                <SelectTrigger className="w-36 bg-background" data-testid="select-new-field-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FIELD_TYPES.map((ft) => (
                    <SelectItem key={ft.value} value={ft.value}>{ft.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {newType === "dropdown" && (
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">
                  Dropdown Options <span className="text-red-500">*</span>
                  <span className="ml-1 text-muted-foreground/70">(comma separated)</span>
                </label>
                <Input
                  placeholder="e.g. Option A, Option B, Option C"
                  value={newOptions}
                  onChange={(e) => setNewOptions(e.target.value)}
                  className="bg-background"
                  data-testid="input-dropdown-options"
                />
                {newOptions && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {newOptions.split(",").map(o => o.trim()).filter(Boolean).map((opt, i) => (
                      <Badge key={i} variant="secondary" className="text-xs">{opt}</Badge>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="new-field-required"
                checked={newRequired}
                onChange={(e) => setNewRequired(e.target.checked)}
                className="rounded border-border"
                data-testid="checkbox-new-field-required"
              />
              <label htmlFor="new-field-required" className="text-sm text-muted-foreground cursor-pointer">Required field</label>
            </div>
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={addField}
              disabled={!newName.trim()}
              data-testid="button-add-field"
            >
              <Plus className="w-4 h-4 mr-2" /> Add Field
            </Button>
          </div>

          {/* Save */}
          <Button
            className="w-full"
            onClick={() => {
              let finalFields = [...fields];
              const trimmed = newName.trim();
              if (trimmed) {
                if (!finalFields.some((f) => f.name.toLowerCase() === trimmed.toLowerCase())) {
                  const pending: SchemaField = { name: trimmed, type: newType, required: newRequired };
                  if (newType === "dropdown") {
                    const opts = newOptions.split(",").map(o => o.trim()).filter(Boolean);
                    if (opts.length > 0) pending.options = opts;
                  }
                  finalFields = [...finalFields, pending];
                }
              }
              saveMutation.mutate(finalFields);
            }}
            disabled={saveMutation.isPending}
            data-testid="button-save-schema"
          >
            {saveMutation.isPending ? "Saving..." : "Save Schema"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Main Page ───────────────────────────────────────────────────────────────
export default function AssetTypesPage() {
  const [createOpen, setCreateOpen] = useState(false);
  const [editingType, setEditingType] = useState<AssetType | null>(null);
  const [schemaType, setSchemaType] = useState<AssetType | null>(null);
  const { toast } = useToast();
  const { data: types, isLoading } = useQuery<AssetType[]>({ 
    queryKey: ["/api/asset-types"] 
  });

  const createMutation = useMutation({
    mutationFn: async (values: any) => {
      const res = await api.post("/api/asset-types", values);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/asset-types"] });
      toast({ title: "Success", description: "Asset type created successfully." });
      setCreateOpen(false);
      form.reset();
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message || "Failed to create asset type.", variant: "destructive" });
    },
  });

  const form = useForm({
    resolver: zodResolver(insertAssetTypeSchema),
    defaultValues: {
      name: "",
      description: "",
      schema: [],
    },
  });

  if (isLoading) return <LayoutShell>Loading...</LayoutShell>;

  return (
    <LayoutShell>
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Asset Types</h1>
          <p className="text-muted-foreground mt-1">Manage asset categories and their custom fields.</p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button className="bg-primary hover:bg-primary/90" data-testid="button-add-type">
              <Plus className="w-4 h-4 mr-2" />
              Add Type
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Asset Type</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit((v) => createMutation.mutate(v))} className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Name</FormLabel>
                      <FormControl><Input {...field} placeholder="e.g. Laptop" className="bg-background" data-testid="input-type-name" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl><Textarea {...field} className="bg-background" data-testid="input-type-description" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" className="w-full" disabled={createMutation.isPending} data-testid="button-submit-type">
                  {createMutation.isPending ? "Creating..." : "Create Type"}
                </Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="bg-card rounded-xl border border-border shadow-sm overflow-x-auto">
        <Table className="min-w-[600px] md:min-w-full">
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead className="text-foreground">Name</TableHead>
              <TableHead className="text-foreground">Description</TableHead>
              <TableHead className="text-foreground">Fields</TableHead>
              <TableHead className="text-right text-foreground">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {types?.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground py-8">No asset types yet.</TableCell>
              </TableRow>
            )}
            {types?.map((type) => (
              <TableRow key={type.id} className="hover:bg-muted/30 transition-colors">
                <TableCell className="font-medium text-foreground">{type.name}</TableCell>
                <TableCell className="text-muted-foreground">{type.description || '—'}</TableCell>
                <TableCell className="text-muted-foreground">{(type.schema as any[])?.length || 0} fields</TableCell>
                <TableCell className="text-right space-x-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground hover:text-foreground"
                    title="Manage schema fields"
                    data-testid={`button-schema-${type.id}`}
                    onClick={() => setSchemaType(type)}
                  >
                    <Settings2 className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground hover:text-foreground"
                    title="Edit asset type"
                    data-testid={`button-edit-type-${type.id}`}
                    onClick={() => setEditingType(type)}
                  >
                    <Pencil className="w-4 h-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {editingType && (
        <EditAssetTypeDialog
          type={editingType}
          onClose={() => setEditingType(null)}
        />
      )}
      {schemaType && (
        <SchemaFieldsDialog
          type={schemaType}
          onClose={() => setSchemaType(null)}
        />
      )}
    </LayoutShell>
  );
}

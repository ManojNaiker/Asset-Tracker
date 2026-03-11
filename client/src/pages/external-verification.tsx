import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { 
  Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle 
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Loader2, CheckCircle2, XCircle, Info, Camera, Upload, X } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";

export default function ExternalVerificationPage({ params }: { params: { token: string } }) {
  const [remarks, setRemarks] = useState("");
  const [selectedAssets, setSelectedAssets] = useState<number[]>([]);
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const { data: allocation, isLoading, error } = useQuery<any>({
    queryKey: ["/api/verifications/token", params.token],
    queryFn: async () => {
      const res = await fetch(`/api/verifications/token/${params.token}`);
      if (!res.ok) {
        const errorText = await res.text();
        try {
          const errorJson = JSON.parse(errorText);
          throw new Error(errorJson.message || "Invalid or expired verification link");
        } catch (e) {
          throw new Error("Invalid or expired verification link");
        }
      }
      return res.json();
    }
  });

  const uploadFile = async (file: File): Promise<string | null> => {
    const formData = new FormData();
    formData.append("image", file);
    try {
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const data = await res.json();
      return data.url as string;
    } catch {
      return null;
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setUploading(true);
    const uploaded: string[] = [];
    for (const file of files) {
      const url = await uploadFile(file);
      if (url) uploaded.push(url);
    }
    if (uploaded.length < files.length) {
      toast({ title: "Some uploads failed", variant: "destructive" });
    }
    setImageUrls(prev => [...prev, ...uploaded]);
    e.target.value = "";
    setUploading(false);
  };

  const mutation = useMutation({
    mutationFn: async (status: "Approved" | "Rejected") => {
      if (selectedAssets.length === 0) {
        throw new Error("Please select the asset to proceed with verification");
      }
      const res = await fetch("/api/verifications/external", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: params.token,
          status,
          remarks,
          images: imageUrls.length > 0 ? imageUrls : undefined
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: (verification: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/allocations"] });
      toast({ title: "Verification submitted successfully" });
      setLocation(`/verification-success?id=${verification.id}`);
    },
    onError: (err: Error) => {
      toast({ 
        title: "Verification failed", 
        description: err.message,
        variant: "destructive" 
      });
    }
  });

  const toggleAsset = (id: number) => {
    setSelectedAssets(prev => 
      prev.includes(id) ? prev.filter(a => a !== id) : [...prev, id]
    );
  };

  if (isLoading) return <div className="min-h-screen flex items-center justify-center bg-background"><Loader2 className="animate-spin text-primary" /></div>;
  if (error) return <div className="min-h-screen flex items-center justify-center bg-background text-destructive font-medium">{error.message}</div>;

  return (
    <div className="min-h-screen bg-background p-4 flex items-center justify-center">
      <Card className="w-full max-w-lg border-border">
        <CardHeader>
          <CardTitle className="text-foreground">Asset Verification</CardTitle>
          <CardDescription className="text-muted-foreground">
            Hello {allocation.employee.name}, please select and verify the asset(s) allocated to you.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <label className="text-sm font-medium flex items-center gap-2 text-foreground">
              <Info className="w-4 h-4 text-primary" />
              Allocated Assets
            </label>
            <div 
              className={`p-3 sm:p-4 rounded-lg border-2 transition-colors cursor-pointer flex items-start sm:items-center gap-3 sm:gap-4 ${
                selectedAssets.includes(allocation.asset.id) 
                  ? "bg-primary/10 border-primary/20" 
                  : "bg-card border-border"
              }`}
              onClick={() => toggleAsset(allocation.asset.id)}
            >
              <div className="pt-1 sm:pt-0">
                <Checkbox 
                  checked={selectedAssets.includes(allocation.asset.id)}
                  onCheckedChange={() => toggleAsset(allocation.asset.id)}
                />
              </div>
              <div className="flex-1 space-y-1">
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1">
                  <span className="font-medium text-foreground text-sm sm:text-base">{allocation.asset.type.name}</span>
                  <span className="text-[10px] sm:text-xs font-mono bg-muted text-muted-foreground px-2 py-1 rounded self-start">
                    {allocation.asset.serialNumber}
                  </span>
                </div>
                <p className="text-[10px] sm:text-xs text-muted-foreground">
                  Select this asset to approve or reject its current status.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Remarks (Optional)</label>
            <Textarea 
              placeholder="e.g. Asset received in good condition..." 
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              className="min-h-[100px] bg-background text-foreground border-border"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Asset Photos (Optional)</label>
            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              accept="image/*"
              multiple
              onChange={handleFileChange}
            />
            <input
              type="file"
              ref={cameraInputRef}
              className="hidden"
              accept="image/*"
              capture="environment"
              onChange={handleFileChange}
            />
            {imageUrls.length > 0 && (
              <div className="grid grid-cols-3 gap-2">
                {imageUrls.map((url, idx) => (
                  <div key={idx} className="relative aspect-square">
                    <img src={url} className="w-full h-full object-cover rounded-md border border-border" />
                    <Button
                      type="button"
                      size="icon"
                      variant="destructive"
                      className="absolute top-1 right-1 h-5 w-5"
                      onClick={() => setImageUrls(prev => prev.filter((_, i) => i !== idx))}
                    >
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1 border-dashed"
                disabled={uploading || mutation.isPending}
                onClick={() => fileInputRef.current?.click()}
                data-testid="button-upload-gallery"
              >
                {uploading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Upload className="w-4 h-4 mr-2" />}
                Gallery
              </Button>
              <Button
                type="button"
                variant="outline"
                className="flex-1 border-dashed"
                disabled={uploading || mutation.isPending}
                onClick={() => cameraInputRef.current?.click()}
                data-testid="button-upload-camera"
              >
                {uploading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Camera className="w-4 h-4 mr-2" />}
                Camera
              </Button>
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex gap-4">
          <Button 
            variant="outline"
            className="flex-1 border-destructive/20 text-destructive hover:bg-destructive/10"
            onClick={() => mutation.mutate("Rejected")}
            disabled={mutation.isPending || uploading || selectedAssets.length === 0}
            data-testid="button-reject"
          >
            {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <XCircle className="w-4 h-4 mr-2" />}
            Reject
          </Button>
          <Button 
            className="flex-1 bg-green-600 hover:bg-green-700 text-white"
            onClick={() => mutation.mutate("Approved")}
            disabled={mutation.isPending || uploading || selectedAssets.length === 0}
            data-testid="button-approve"
          >
            {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
            Approve
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}

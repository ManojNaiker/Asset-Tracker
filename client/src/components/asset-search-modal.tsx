import { useState } from "react";
import { useAssets } from "@/hooks/use-assets";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, Search, History, Eye, QrCode, Type, Camera, Upload } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import jsQR from "jsqr";
import { useRef, useEffect, useCallback } from "react";

interface AssetSearchModalProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children?: React.ReactNode;
}

export function AssetSearchModal({ open: controlledOpen, onOpenChange, children }: AssetSearchModalProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const handleOpenChange = onOpenChange || setInternalOpen;

  const [searchText, setSearchText] = useState("");
  const [selectedAsset, setSelectedAsset] = useState<any | null>(null);
  const [manualInput, setManualInput] = useState("");
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isScanning, setIsScanning] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanningActiveRef = useRef(false);
  const animationFrameRef = useRef<number | null>(null);

  const { data: assets } = useAssets({});
  const { data: allocations, isLoading: allocationsLoading } = useQuery<any[]>({
    queryKey: ["/api/allocations"],
  });

  const searchResults = assets?.filter(a => 
    a.serialNumber.toLowerCase().includes(searchText.toLowerCase())
  ) || [];

  const assetAllocations = selectedAsset ? allocations?.filter(a => a.assetId === selectedAsset.id) : [];

  const handleDetection = useCallback((value: string) => {
    const asset = assets?.find(a => a.serialNumber.toUpperCase() === value.toUpperCase());
    if (asset) {
      setSelectedAsset(asset);
      setSearchText(value);
      setManualInput("");
    }
    stopCamera();
  }, [assets]);

  const doScanFrame = useCallback(async () => {
    if (!scanningActiveRef.current || !videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (video.readyState < video.HAVE_ENOUGH_DATA || video.videoWidth === 0 || video.videoHeight === 0) {
      animationFrameRef.current = requestAnimationFrame(doScanFrame);
      return;
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    try {
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height);
        if (code) {
          handleDetection(code.data);
          return;
        }
      }
    } catch (err) {
      console.error("Error processing frame:", err);
    }

    if (scanningActiveRef.current) {
      animationFrameRef.current = requestAnimationFrame(doScanFrame);
    }
  }, [handleDetection]);

  const startCamera = async () => {
    try {
      setIsScanning(true);

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setIsScanning(false);
        alert("Camera is not available in your browser. Please use a modern browser with camera support.");
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "environment",
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      });
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;

        videoRef.current.onloadedmetadata = () => {
          if (videoRef.current) {
            videoRef.current.play().then(() => {
              setIsCameraActive(true);
              setIsScanning(false);
              scanningActiveRef.current = true;
              doScanFrame();
            }).catch((err) => {
              console.error("Video play failed:", err);
              setIsScanning(false);
            });
          }
        };
      }
    } catch (err: any) {
      console.error("Camera access error:", err);
      const errorMessage = err.name === 'NotAllowedError'
        ? "Camera access was denied. Please allow camera access in your browser settings."
        : err.name === 'NotFoundError'
        ? "No camera device found."
        : "Failed to access camera. Please try again.";
      alert(errorMessage);
      setIsScanning(false);
    }
  };

  const stopCamera = () => {
    scanningActiveRef.current = false;
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
    setIsScanning(false);
  };

  const handleManualSubmit = () => {
    if (manualInput.trim()) {
      handleDetection(manualInput.trim().toUpperCase());
    }
  };

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  const handleModalClose = () => {
    stopCamera();
    setSelectedAsset(null);
    setSearchText("");
    setManualInput("");
    handleOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(newOpen) => {
      if (!newOpen) handleModalClose();
      else handleOpenChange(true);
    }}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Asset Search</DialogTitle>
        </DialogHeader>

        {!selectedAsset ? (
          <Tabs defaultValue="text" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="text" className="text-xs">
                <Type className="w-3 h-3 mr-1" />
                Text Search
              </TabsTrigger>
              <TabsTrigger value="qr" className="text-xs">
                <QrCode className="w-3 h-3 mr-1" />
                QR/Barcode
              </TabsTrigger>
            </TabsList>

            <TabsContent value="text" className="space-y-4">
              <div className="space-y-2">
                <Input
                  placeholder="Enter serial number..."
                  value={searchText}
                  onChange={(e) => {
                    setSearchText(e.target.value);
                    setSelectedAsset(null);
                  }}
                  className="bg-muted/20 border-border focus:bg-background"
                  data-testid="input-asset-search"
                />
              </div>

              {searchResults.length > 0 ? (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {searchResults.map(asset => (
                    <Card 
                      key={asset.id} 
                      className="cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => setSelectedAsset(asset)}
                    >
                      <CardContent className="p-4 flex justify-between items-center">
                        <div>
                          <p className="font-semibold text-sm">{asset.serialNumber}</p>
                          <p className="text-xs text-muted-foreground">{asset.type?.name}</p>
                        </div>
                        <Badge variant="outline" className="text-xs">{asset.status}</Badge>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : searchText ? (
                <Card className="shadow-sm">
                  <CardContent className="p-6 text-center text-muted-foreground text-sm">
                    No assets found matching "{searchText}"
                  </CardContent>
                </Card>
              ) : (
                <Card className="shadow-sm">
                  <CardContent className="p-6 text-center text-muted-foreground text-sm">
                    Enter a serial number to search
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="qr" className="space-y-4">
              <div className={`bg-black rounded-lg overflow-hidden ${!(isScanning || isCameraActive) ? 'hidden' : ''}`}>
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full aspect-video"
                  data-testid="camera-video-feed-search"
                />
              </div>
              {isScanning && (
                <p className="text-xs text-center text-muted-foreground">
                  <Loader2 className="w-4 h-4 mr-1 animate-spin inline" />
                  Starting Camera...
                </p>
              )}
              {isCameraActive && (
                <p className="text-xs text-center text-muted-foreground">
                  Point camera at QR code or barcode
                </p>
              )}
              {!isScanning && !isCameraActive && (
                <Button
                  onClick={startCamera}
                  className="w-full"
                  data-testid="button-start-camera-search"
                >
                  <Camera className="w-4 h-4 mr-2" />
                  Start Camera
                </Button>
              )}
              {(isScanning || isCameraActive) && (
                <Button
                  onClick={stopCamera}
                  variant="destructive"
                  className="w-full"
                  data-testid="button-stop-camera-search"
                >
                  Stop Camera
                </Button>
              )}

              <div className="relative py-4">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-border"></div>
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="px-2 bg-background text-muted-foreground">Or enter manually</span>
                </div>
              </div>

              <div className="space-y-2">
                <Input
                  placeholder="Enter serial number..."
                  value={manualInput}
                  onChange={(e) => setManualInput(e.target.value.toUpperCase())}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleManualSubmit();
                  }}
                  data-testid="input-manual-serial-search"
                />
                <Button onClick={handleManualSubmit} className="w-full" data-testid="button-confirm-manual-search">
                  Search
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        ) : (
          <div className="space-y-6 py-4">
            <div className="grid grid-cols-3 gap-4 bg-muted/50 p-4 rounded-lg border border-border">
              <div>
                <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Serial</p>
                <p className="text-sm font-medium text-foreground">{selectedAsset.serialNumber}</p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Type</p>
                <p className="text-sm font-medium text-foreground">{selectedAsset.type?.name}</p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Status</p>
                <Badge variant="outline" className="text-xs">{selectedAsset.status}</Badge>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                <History className="w-4 h-4" /> Allocation History
              </h3>
              {allocationsLoading ? (
                <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
              ) : !assetAllocations || assetAllocations.length === 0 ? (
                <p className="text-center py-4 text-muted-foreground text-sm">No allocation history found.</p>
              ) : (
                <div className="relative border-l-2 border-border ml-3 pl-6 space-y-6 max-h-64 overflow-y-auto">
                  {assetAllocations.map((a) => (
                    <div key={a.id} className="relative">
                      <div className="absolute -left-[31px] top-1 w-4 h-4 rounded-full bg-background border-2 border-primary" />
                      <div className="space-y-1">
                        <div className="flex justify-between items-start">
                          <p className="text-sm font-semibold text-foreground">
                            Allocated to {a.employee?.name}
                          </p>
                          <Badge variant="outline" className="text-[10px] border-border text-muted-foreground">{a.status}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {new Date(a.allocatedAt).toLocaleString()}
                        </p>
                        {a.returnDate && (
                          <p className="text-xs text-destructive font-medium">
                            Returned: {new Date(a.returnDate).toLocaleString()}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <Button 
              onClick={() => setSelectedAsset(null)}
              variant="outline"
              className="w-full"
              data-testid="button-back-to-search"
            >
              Search Another Asset
            </Button>
          </div>
        )}

        <canvas ref={canvasRef} className="hidden" />
      </DialogContent>
    </Dialog>
  );
}

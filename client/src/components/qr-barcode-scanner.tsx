import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Camera, Type, Upload, QrCode } from "lucide-react";
import jsQR from "jsqr";

interface QRBarcodeScannerProps {
  onDetected: (value: string) => void;
  placeholder?: string;
  inline?: boolean;
}

export function QRBarcodeScanner({ onDetected, placeholder = "Enter or scan serial number", inline = false }: QRBarcodeScannerProps) {
  const [open, setOpen] = useState(false);
  const [manualInput, setManualInput] = useState("");
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const startCamera = async () => {
    try {
      setIsScanning(true);
      
      // Check if camera API is available
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        console.error("Camera API not available in your browser");
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
        videoRef.current.play();
        setIsCameraActive(true);
        scanVideo();
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
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    setIsCameraActive(false);
    setIsScanning(false);
  };

  const scanVideo = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;

    ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const code = jsQR(imageData.data, imageData.width, imageData.height);

    if (code) {
      onDetected(code.data);
      stopCamera();
      setOpen(false);
      setManualInput("");
    } else if (isCameraActive) {
      requestAnimationFrame(scanVideo);
    }
  };

  const handleManualSubmit = () => {
    if (manualInput.trim()) {
      onDetected(manualInput.trim().toUpperCase());
      setManualInput("");
      setOpen(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        if (!canvasRef.current) return;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height);

        if (code) {
          onDetected(code.data);
          setManualInput("");
          setOpen(false);
          if (fileInputRef.current) fileInputRef.current.value = "";
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  if (inline) {
    return (
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <button 
            type="button"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors z-10 p-1"
            title="Scan QR/Barcode"
          >
            <QrCode className="w-4 h-4" />
          </button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Get Serial Number</DialogTitle>
          </DialogHeader>
          
          <Tabs defaultValue="manual" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="manual" className="text-xs">
                <Type className="w-3 h-3 mr-1" />
                Text
              </TabsTrigger>
              <TabsTrigger value="camera" className="text-xs">
                <Camera className="w-3 h-3 mr-1" />
                Camera
              </TabsTrigger>
              <TabsTrigger value="image" className="text-xs">
                <Upload className="w-3 h-3 mr-1" />
                Image
              </TabsTrigger>
            </TabsList>

            <TabsContent value="manual" className="space-y-4">
              <div className="space-y-2">
                <Input
                  placeholder={placeholder}
                  value={manualInput}
                  onChange={(e) => setManualInput(e.target.value.toUpperCase())}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleManualSubmit();
                  }}
                />
              </div>
              <Button onClick={handleManualSubmit} className="w-full">
                Confirm
              </Button>
            </TabsContent>

            <TabsContent value="camera" className="space-y-4">
              {!isCameraActive ? (
                <Button 
                  onClick={startCamera} 
                  disabled={isScanning}
                  className="w-full"
                >
                  {isScanning ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Starting Camera...
                    </>
                  ) : (
                    <>
                      <Camera className="w-4 h-4 mr-2" />
                      Start Camera
                    </>
                  )}
                </Button>
              ) : (
                <>
                  <div className="bg-black rounded-lg overflow-hidden">
                    <video
                      ref={videoRef}
                      className="w-full aspect-video"
                      style={{ transform: "scaleX(-1)" }}
                    />
                  </div>
                  <p className="text-xs text-center text-muted-foreground">
                    Point camera at QR code or barcode
                  </p>
                  <Button 
                    onClick={stopCamera}
                    variant="destructive"
                    className="w-full"
                  >
                    Stop Camera
                  </Button>
                </>
              )}
            </TabsContent>

            <TabsContent value="image" className="space-y-4">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
              />
              <Button
                onClick={() => fileInputRef.current?.click()}
                variant="outline"
                className="w-full"
              >
                <Upload className="w-4 h-4 mr-2" />
                Choose Image
              </Button>
              <p className="text-xs text-center text-muted-foreground">
                Upload an image containing QR code or barcode
              </p>
            </TabsContent>
          </Tabs>

          <canvas ref={canvasRef} className="hidden" />
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="w-full" title="Scan QR Code or Barcode">
          <QrCode className="w-4 h-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Get Serial Number</DialogTitle>
        </DialogHeader>
        
        <Tabs defaultValue="manual" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="manual" className="text-xs">
              <Type className="w-3 h-3 mr-1" />
              Text
            </TabsTrigger>
            <TabsTrigger value="camera" className="text-xs">
              <Camera className="w-3 h-3 mr-1" />
              Camera
            </TabsTrigger>
            <TabsTrigger value="image" className="text-xs">
              <Upload className="w-3 h-3 mr-1" />
              Image
            </TabsTrigger>
          </TabsList>

          <TabsContent value="manual" className="space-y-4">
            <div className="space-y-2">
              <Input
                placeholder={placeholder}
                value={manualInput}
                onChange={(e) => setManualInput(e.target.value.toUpperCase())}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleManualSubmit();
                }}
              />
            </div>
            <Button onClick={handleManualSubmit} className="w-full">
              Confirm
            </Button>
          </TabsContent>

          <TabsContent value="camera" className="space-y-4">
            {!isCameraActive ? (
              <Button 
                onClick={startCamera} 
                disabled={isScanning}
                className="w-full"
              >
                {isScanning ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Starting Camera...
                  </>
                ) : (
                  <>
                    <Camera className="w-4 h-4 mr-2" />
                    Start Camera
                  </>
                )}
              </Button>
            ) : (
              <>
                <div className="bg-black rounded-lg overflow-hidden">
                  <video
                    ref={videoRef}
                    className="w-full aspect-video"
                    style={{ transform: "scaleX(-1)" }}
                  />
                </div>
                <p className="text-xs text-center text-muted-foreground">
                  Point camera at QR code or barcode
                </p>
                <Button 
                  onClick={stopCamera}
                  variant="destructive"
                  className="w-full"
                >
                  Stop Camera
                </Button>
              </>
            )}
          </TabsContent>

          <TabsContent value="image" className="space-y-4">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              className="hidden"
            />
            <Button
              onClick={() => fileInputRef.current?.click()}
              variant="outline"
              className="w-full"
            >
              <Upload className="w-4 h-4 mr-2" />
              Choose Image
            </Button>
            <p className="text-xs text-center text-muted-foreground">
              Upload an image containing QR code or barcode
            </p>
          </TabsContent>
        </Tabs>

        <canvas ref={canvasRef} className="hidden" />
      </DialogContent>
    </Dialog>
  );
}

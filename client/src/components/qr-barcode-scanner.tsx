import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Camera, Type, Upload, QrCode } from "lucide-react";
import jsQR from "jsqr";

declare global {
  interface Window {
    BarcodeDetector?: new (options?: { formats: string[] }) => {
      detect: (source: ImageBitmapSource) => Promise<Array<{ rawValue: string; format: string }>>;
    };
  }
}

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
  const scanningActiveRef = useRef(false);
  const animationFrameRef = useRef<number | null>(null);
  const onDetectedRef = useRef(onDetected);
  const barcodeDetectorRef = useRef<InstanceType<NonNullable<typeof window.BarcodeDetector>> | null>(null);

  useEffect(() => {
    onDetectedRef.current = onDetected;
  }, [onDetected]);

  useEffect(() => {
    if (window.BarcodeDetector) {
      try {
        barcodeDetectorRef.current = new window.BarcodeDetector({
          formats: ['qr_code', 'ean_13', 'ean_8', 'code_128', 'code_39', 'code_93', 'codabar', 'itf', 'upc_a', 'upc_e', 'data_matrix', 'aztec', 'pdf417']
        });
      } catch (e) {
        barcodeDetectorRef.current = null;
      }
    }
  }, []);

  useEffect(() => {
    return () => {
      scanningActiveRef.current = false;
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const handleDetection = useCallback((value: string) => {
    onDetectedRef.current(value);
    stopCamera();
    setOpen(false);
    setManualInput("");
  }, []);

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

    let detectorSucceeded = false;

    if (barcodeDetectorRef.current) {
      try {
        const codes = await barcodeDetectorRef.current.detect(video);
        if (!scanningActiveRef.current) return;
        if (codes.length > 0) {
          handleDetection(codes[0].rawValue);
          return;
        }
        detectorSucceeded = true;
      } catch (err) {
        barcodeDetectorRef.current = null;
      }
    }

    if (!detectorSucceeded) {
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
      onDetected(manualInput.trim().toUpperCase());
      setManualInput("");
      setOpen(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = async () => {
      if (!canvasRef.current) { URL.revokeObjectURL(objectUrl); return; }
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");
      if (!ctx) { URL.revokeObjectURL(objectUrl); return; }

      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);

      let detected = false;

      if (barcodeDetectorRef.current) {
        try {
          const codes = await barcodeDetectorRef.current.detect(canvas);
          if (codes.length > 0) {
            onDetected(codes[0].rawValue);
            detected = true;
          }
        } catch (err) {
          console.error("BarcodeDetector error on image:", err);
        }
      }

      if (!detected) {
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height);
        if (code) {
          onDetected(code.data);
          detected = true;
        }
      }

      if (detected) {
        setManualInput("");
        setOpen(false);
      }
      if (fileInputRef.current) fileInputRef.current.value = "";
      URL.revokeObjectURL(objectUrl);
    };
    img.src = objectUrl;
  };

  if (inline) {
    return (
      <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) stopCamera(); setOpen(isOpen); }}>
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
              <div className={`bg-black rounded-lg overflow-hidden ${!(isScanning || isCameraActive) ? 'hidden' : ''}`}>
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full aspect-video"
                  
                  data-testid="camera-video-feed"
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
                  data-testid="button-start-camera"
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
                  data-testid="button-stop-camera"
                >
                  Stop Camera
                </Button>
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
                data-testid="button-choose-image"
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
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) stopCamera(); setOpen(isOpen); }}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="w-full" title="Scan QR Code or Barcode" data-testid="button-scan-qr">
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
                data-testid="input-serial-number"
              />
            </div>
            <Button onClick={handleManualSubmit} className="w-full" data-testid="button-confirm-serial">
              Confirm
            </Button>
          </TabsContent>

          <TabsContent value="camera" className="space-y-4">
            <div className={`bg-black rounded-lg overflow-hidden ${!(isScanning || isCameraActive) ? 'hidden' : ''}`}>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full aspect-video"
                
                data-testid="camera-video-feed"
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
                data-testid="button-start-camera"
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
                data-testid="button-stop-camera"
              >
                Stop Camera
              </Button>
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
              data-testid="button-choose-image"
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

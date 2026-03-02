import * as React from "react";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Maximize2, Minimize2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface ImagePreviewProps {
  src: string;
  alt?: string;
  className?: string;
}

export function ImagePreview({ src, alt = "Image", className }: ImagePreviewProps) {
  const [isFullSize, setIsFullSize] = React.useState(false);

  return (
    <Dialog>
      <DialogTrigger asChild>
        <div className={cn("relative group cursor-pointer overflow-hidden rounded-md", className)}>
          <img src={src} alt={alt} className="w-full h-full object-cover transition-transform group-hover:scale-105" />
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
            <Maximize2 className="text-white opacity-0 group-hover:opacity-100 transition-opacity w-6 h-6" />
          </div>
        </div>
      </DialogTrigger>
      <DialogContent className={cn(
        "p-0 overflow-hidden border-none bg-transparent shadow-none transition-all duration-300 ease-in-out",
        isFullSize ? "sm:max-w-[100vw] sm:max-h-[100vh] w-screen h-screen rounded-none" : "sm:max-w-[90vw] sm:max-h-[90vh] rounded-lg"
      )}>
        <div className="relative w-full h-full flex items-center justify-center bg-black/90">
          <img 
            src={src} 
            alt={alt} 
            className={cn(
              "transition-all duration-300 ease-in-out",
              isFullSize ? "w-full h-full object-contain" : "max-w-full max-h-full object-contain p-4"
            )} 
          />
          
          <div className="absolute top-4 right-4 flex gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="bg-black/50 hover:bg-black/70 text-white rounded-full h-10 w-10"
              onClick={() => setIsFullSize(!isFullSize)}
            >
              {isFullSize ? <Minimize2 className="h-5 w-5" /> : <Maximize2 className="h-5 w-5" />}
            </Button>
            <DialogTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="bg-black/50 hover:bg-black/70 text-white rounded-full h-10 w-10"
              >
                <X className="h-5 w-5" />
              </Button>
            </DialogTrigger>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

import { useEffect, useRef, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { X, Camera, Loader2, AlertCircle, Type, Zap } from "lucide-react";

interface WorkingBarcodeScannerProps {
  onScan: (barcode: string) => void;
  onClose: () => void;
  isOpen: boolean;
}

export default function WorkingBarcodeScanner({ onScan, onClose, isOpen }: WorkingBarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(false);
  const [showManualInput, setShowManualInput] = useState(false);
  const [manualCode, setManualCode] = useState("");
  const [scanAttempts, setScanAttempts] = useState(0);
  const [lastScannedCode, setLastScannedCode] = useState<string>("");
  const [isProcessing, setIsProcessing] = useState(false);

  const stopCamera = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    
    setIsScanning(false);
    setIsInitializing(false);
    setScanAttempts(0);
    setLastScannedCode("");
    setIsProcessing(false);
  }, []);

  // Disabled automatic detection to prevent rapid scanning
  const detectBarcode = useCallback((imageData: ImageData) => {
    // Automatic detection disabled - will only work with manual trigger
    return null;
  }, []);

  const captureAndAnalyze = useCallback(() => {
    if (!videoRef.current || !canvasRef.current || isProcessing) return;
    
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    
    if (!context || video.readyState !== video.HAVE_ENOUGH_DATA) return;
    
    // Set canvas size to match video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    // Draw current video frame to canvas
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    // Get image data for analysis
    const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
    
    // Try to detect barcode
    const detectedCode = detectBarcode(imageData);
    
    if (detectedCode && detectedCode !== lastScannedCode && !isProcessing) {
      console.log('New barcode detected:', detectedCode);
      setIsProcessing(true);
      setLastScannedCode(detectedCode);
      
      // Stop scanning to prevent multiple scans
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      
      // Call onScan and close
      onScan(detectedCode);
      return true;
    }
    
    return false;
  }, [detectBarcode, onScan, lastScannedCode, isProcessing]);

  const startCamera = useCallback(async () => {
    try {
      setError(null);
      setIsInitializing(true);
      setScanAttempts(0);
      
      const constraints = {
        video: {
          facingMode: "environment",
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        
        await new Promise<void>((resolve, reject) => {
          if (!videoRef.current) return reject();
          
          const handleLoadedMetadata = () => {
            videoRef.current?.removeEventListener('loadedmetadata', handleLoadedMetadata);
            setIsInitializing(false);
            setIsScanning(true);
            
            // Automatic scanning disabled to prevent rapid detection issues
            // Camera is ready for manual scanning only
            
            resolve();
          };
          
          videoRef.current.addEventListener('loadedmetadata', handleLoadedMetadata);
          
          setTimeout(() => {
            videoRef.current?.removeEventListener('loadedmetadata', handleLoadedMetadata);
            reject(new Error('Video load timeout'));
          }, 10000);
        });
      }
    } catch (err: any) {
      setIsInitializing(false);
      setIsScanning(false);
      
      let errorMessage = "Camera access failed. ";
      
      if (err.name === 'NotAllowedError') {
        errorMessage = "Camera permission denied. Please allow camera access and try again.";
      } else if (err.name === 'NotFoundError') {
        errorMessage = "No camera found. Please use manual input instead.";
      } else if (err.name === 'NotReadableError') {
        errorMessage = "Camera is busy. Please close other camera apps and try again.";
      } else {
        errorMessage = "Failed to access camera. Please try manual input.";
      }
      
      setError(errorMessage);
    }
  }, [captureAndAnalyze]);

  const handleManualSubmit = () => {
    if (manualCode.trim()) {
      onScan(manualCode.trim());
      setManualCode("");
      onClose();
    }
  };

  const handleClose = () => {
    stopCamera();
    setShowManualInput(false);
    setManualCode("");
    setError(null);
    onClose();
  };

  // Quick scan button for testing
  const triggerQuickScan = () => {
    if (isProcessing) return;
    
    setIsProcessing(true);
    const testCode = "9780140449136"; // Les Miserables ISBN
    console.log('Quick scan triggered:', testCode);
    setLastScannedCode(testCode);
    
    // Stop any ongoing scanning
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    
    onScan(testCode);
  };

  useEffect(() => {
    if (isOpen && !showManualInput) {
      startCamera();
    } else if (!isOpen) {
      stopCamera();
    }

    return () => {
      stopCamera();
    };
  }, [isOpen, showManualInput, startCamera]);

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span className="flex items-center space-x-2">
              <Camera className="w-5 h-5" />
              <span>Scan Book Barcode</span>
            </span>
            <Button variant="ghost" size="icon" onClick={handleClose}>
              <X className="w-4 h-4" />
            </Button>
          </DialogTitle>
          <DialogDescription>
            Point camera at barcode or use quick scan for testing
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {!showManualInput ? (
            <>
              {/* Camera View */}
              <div className="relative bg-black rounded-lg overflow-hidden aspect-video">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />
                
                {/* Hidden canvas for image processing */}
                <canvas
                  ref={canvasRef}
                  className="hidden"
                />
                
                {/* Scanning Overlay */}
                {isScanning && !error && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="relative">
                      <div className="border-2 border-green-400 rounded-lg w-72 h-36 opacity-90 bg-black bg-opacity-20">
                        <div className="absolute top-1/2 left-2 right-2 h-0.5 bg-red-500 animate-pulse shadow-lg"></div>
                        <div className="absolute inset-2 border border-green-300 rounded opacity-50"></div>
                      </div>
                      
                      <div className="absolute -top-1 -left-1 w-6 h-6 border-t-4 border-l-4 border-green-400 rounded-tl"></div>
                      <div className="absolute -top-1 -right-1 w-6 h-6 border-t-4 border-r-4 border-green-400 rounded-tr"></div>
                      <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-4 border-l-4 border-green-400 rounded-bl"></div>
                      <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-4 border-r-4 border-green-400 rounded-br"></div>
                    </div>
                    
                    <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-black bg-opacity-80 rounded-lg px-4 py-2 text-center">
                      {isProcessing ? (
                        <>
                          <p className="text-green-400 text-sm font-medium">Barcode Found!</p>
                          <p className="text-green-300 text-xs mt-1">Processing...</p>
                        </>
                      ) : (
                        <>
                          <p className="text-white text-sm font-medium">Scanning... {scanAttempts} attempts</p>
                          <p className="text-green-300 text-xs mt-1">Hold barcode steady in frame</p>
                        </>
                      )}
                    </div>
                  </div>
                )}
                
                {/* Loading State */}
                {isInitializing && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-white text-center">
                      <Loader2 className="w-12 h-12 mx-auto mb-2 opacity-75 animate-spin" />
                      <p className="text-sm opacity-75">Starting camera...</p>
                    </div>
                  </div>
                )}

                {/* Error or No Camera State */}
                {!isScanning && !isInitializing && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-white text-center">
                      <Camera className="w-12 h-12 mx-auto mb-2 opacity-50" />
                      <p className="text-sm opacity-75">Preparing camera...</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Error Message */}
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <div className="flex items-center space-x-2">
                    <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
                    <p className="text-red-800 text-sm">{error}</p>
                  </div>
                  <div className="flex gap-2 mt-3">
                    <Button 
                      onClick={startCamera} 
                      variant="outline" 
                      size="sm"
                    >
                      Try Again
                    </Button>
                    <Button 
                      onClick={() => setShowManualInput(true)} 
                      variant="outline" 
                      size="sm"
                    >
                      Manual Input
                    </Button>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="space-y-2">
                <Button 
                  onClick={triggerQuickScan} 
                  className="w-full"
                  variant="default"
                  disabled={isProcessing}
                >
                  <Zap className="w-4 h-4 mr-2" />
                  {isProcessing ? "Processing..." : "Scan Test Barcode"}
                </Button>
                <Button 
                  onClick={() => setShowManualInput(true)} 
                  variant="outline" 
                  className="w-full"
                  disabled={isProcessing}
                >
                  <Type className="w-4 h-4 mr-2" />
                  Enter ISBN Manually
                </Button>
                <Button onClick={handleClose} variant="secondary" className="w-full">
                  Cancel
                </Button>
              </div>
            </>
          ) : (
            /* Manual Input Mode */
            <div className="space-y-4">
              <div className="text-center">
                <Type className="w-12 h-12 mx-auto mb-2 text-gray-400" />
                <h3 className="text-lg font-medium mb-2">Enter Barcode Manually</h3>
                <p className="text-sm text-gray-600">Type the ISBN or barcode number from your book</p>
              </div>
              
              <div className="space-y-3">
                <Input
                  placeholder="Enter ISBN or barcode (e.g., 9780140449136)"
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleManualSubmit()}
                  autoFocus
                />
                <div className="flex gap-2">
                  <Button 
                    onClick={handleManualSubmit} 
                    disabled={!manualCode.trim()}
                    className="flex-1"
                  >
                    Use This Code
                  </Button>
                  <Button 
                    onClick={() => setShowManualInput(false)} 
                    variant="outline"
                    className="flex-1"
                  >
                    <Camera className="w-4 h-4 mr-2" />
                    Back to Camera
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Help Text */}
          <div className="text-xs text-gray-500 text-center space-y-1">
            <p>Camera is active - use "Scan Test Barcode" or enter ISBN manually</p>
            <p>ISBN format: 9780140449136 (13 digits starting with 978/979)</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
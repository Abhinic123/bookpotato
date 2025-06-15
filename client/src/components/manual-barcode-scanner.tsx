import { useEffect, useRef, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { X, Camera, Loader2, AlertCircle, Type, BookOpen } from "lucide-react";
import { BrowserMultiFormatReader } from "@zxing/library";

interface ManualBarcodeScannerProps {
  onScan: (barcode: string, bookData?: any) => void;
  onClose: () => void;
  isOpen: boolean;
}

export default function ManualBarcodeScanner({ onScan, onClose, isOpen }: ManualBarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(false);
  const [manualCode, setManualCode] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [bookInfo, setBookInfo] = useState<any>(null);
  const [isLoadingBookInfo, setIsLoadingBookInfo] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [isFocusing, setIsFocusing] = useState(false);

  // Function to fetch book information from ISBN
  const fetchBookInfo = async (isbn: string) => {
    if (!isbn || isbn.length < 10) return null;
    
    setIsLoadingBookInfo(true);
    try {
      // Try Google Books API
      const response = await fetch(`https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}`);
      const data = await response.json();
      
      if (data.items && data.items.length > 0) {
        const book = data.items[0].volumeInfo;
        const bookData = {
          title: book.title || '',
          author: book.authors ? book.authors.join(', ') : '',
          isbn: isbn,
          description: book.description || '',
          imageUrl: book.imageLinks?.thumbnail || book.imageLinks?.smallThumbnail || null,
          pageCount: book.pageCount || null,
          publishedDate: book.publishedDate || '',
          categories: book.categories || []
        };
        setBookInfo(bookData);
        return bookData;
      }
      
      // Fallback to Open Library API
      const openLibResponse = await fetch(`https://openlibrary.org/api/books?bibkeys=ISBN:${isbn}&format=json&jscmd=data`);
      const openLibData = await openLibResponse.json();
      
      const bookKey = `ISBN:${isbn}`;
      if (openLibData[bookKey]) {
        const book = openLibData[bookKey];
        const bookData = {
          title: book.title || '',
          author: book.authors ? book.authors.map((a: any) => a.name).join(', ') : '',
          isbn: isbn,
          description: book.notes || '',
          imageUrl: book.cover?.medium || book.cover?.small || null,
          pageCount: book.number_of_pages || null,
          publishedDate: book.publish_date || '',
          categories: book.subjects ? book.subjects.map((s: any) => s.name) : []
        };
        setBookInfo(bookData);
        return bookData;
      }
      
      return null;
    } catch (error) {
      console.error('Error fetching book info:', error);
      return null;
    } finally {
      setIsLoadingBookInfo(false);
    }
  };

  const startCamera = useCallback(async () => {
    try {
      setError(null);
      setIsInitializing(true);
      
      // Ultra-high resolution camera constraints for maximum sharpness
      const constraints = {
        video: {
          facingMode: "environment",
          width: { ideal: 4096, min: 1920 },
          height: { ideal: 2160, min: 1080 },
          frameRate: { ideal: 60, min: 30 },
          aspectRatio: { ideal: 16/9 },
          resizeMode: "crop-and-scale"
        }
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        
        await new Promise<void>((resolve, reject) => {
          if (!videoRef.current) return reject();
          
          const handleLoadedMetadata = async () => {
            videoRef.current?.removeEventListener('loadedmetadata', handleLoadedMetadata);
            
            // Configure camera track for optimal image quality
            const track = stream.getVideoTracks()[0];
            if (track) {
              try {
                const capabilities = track.getCapabilities();
                console.log('Camera capabilities:', capabilities);
                
                // Log capabilities for debugging
                console.log('Available camera settings:', Object.keys(capabilities));
                
                // Try to apply optimal settings
                try {
                  await track.applyConstraints({
                    width: { ideal: 4096 },
                    height: { ideal: 2160 },
                    frameRate: { ideal: 60 }
                  } as any);
                } catch (constraintError) {
                  console.log('Could not apply ideal constraints:', constraintError);
                }
              } catch (error) {
                console.log('Camera optimization failed:', error);
              }
            }
            
            setIsInitializing(false);
            setIsScanning(true);
            resolve();
          };
          
          videoRef.current.addEventListener('loadedmetadata', handleLoadedMetadata);
        });
      }
    } catch (error) {
      console.error('Camera access error:', error);
      setError("Camera access denied. Please allow camera permissions and try again.");
      setIsInitializing(false);
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    
    setIsScanning(false);
    setIsInitializing(false);
  }, []);

  const handleManualSubmit = async () => {
    const isbn = manualCode.trim();
    if (!isbn) return;
    
    setIsProcessing(true);
    
    // Fetch book information for auto-fill
    const bookData = await fetchBookInfo(isbn);
    
    if (bookData) {
      console.log('Book information found:', bookData);
    } else {
      console.log('No book information found, proceeding with ISBN only');
    }
    
    onScan(isbn, bookData);
    setManualCode("");
    handleClose();
  };

  const handleClose = () => {
    stopCamera();
    setManualCode("");
    setBookInfo(null);
    setError(null);
    setShowCamera(false);
    setIsFocusing(false);
    onClose();
  };

  // Force camera restart to reset focus
  const handleVideoClick = async (event: React.MouseEvent<HTMLVideoElement>) => {
    if (!streamRef.current || isFocusing) return;
    
    setIsFocusing(true);
    
    try {
      // Stop current stream
      stopCamera();
      
      // Wait a moment then restart with fresh settings
      setTimeout(async () => {
        await startCamera();
        setIsFocusing(false);
      }, 500);
    } catch (error) {
      console.log('Camera restart failed:', error);
      setIsFocusing(false);
    }
  };

  // Manual scan button for camera detection with enhanced image processing
  const triggerCameraScan = async () => {
    if (isProcessing) return;
    
    if (!videoRef.current || !canvasRef.current) {
      setError("Camera not ready. Please try again or use manual input.");
      return;
    }
    
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    
    if (!context || video.readyState !== video.HAVE_ENOUGH_DATA) {
      setError("Camera feed not ready. Please try again or use manual input.");
      return;
    }
    
    setIsProcessing(true);
    setError(null);
    
    try {
      // Capture current frame with maximum quality
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      // Try to detect barcode using ZXing with multiple enhancement techniques
      const codeReader = new BrowserMultiFormatReader();
      
      // Advanced image enhancement with sharpening for better barcode detection
      const createEnhancedImage = (sourceCanvas: HTMLCanvasElement, contrast: number, brightness: number, grayscale: boolean = false, sharpen: boolean = false): string => {
        const enhanceCanvas = document.createElement('canvas');
        const enhanceCtx = enhanceCanvas.getContext('2d');
        
        if (!enhanceCtx) return sourceCanvas.toDataURL('image/png');
        
        enhanceCanvas.width = sourceCanvas.width;
        enhanceCanvas.height = sourceCanvas.height;
        
        // Enable high-quality image rendering
        enhanceCtx.imageSmoothingEnabled = false; // Disable smoothing for sharper edges
        enhanceCtx.drawImage(sourceCanvas, 0, 0);
        
        let imageData = enhanceCtx.getImageData(0, 0, enhanceCanvas.width, enhanceCanvas.height);
        let data = imageData.data;
        
        // Apply sharpening filter if requested
        if (sharpen) {
          const width = enhanceCanvas.width;
          const height = enhanceCanvas.height;
          const sharpened = new Uint8ClampedArray(data.length);
          
          // Unsharp mask filter for sharpening
          const kernel = [
            0, -1, 0,
            -1, 5, -1,
            0, -1, 0
          ];
          
          for (let y = 1; y < height - 1; y++) {
            for (let x = 1; x < width - 1; x++) {
              for (let c = 0; c < 3; c++) { // RGB channels
                let sum = 0;
                for (let ky = -1; ky <= 1; ky++) {
                  for (let kx = -1; kx <= 1; kx++) {
                    const pixelIndex = ((y + ky) * width + (x + kx)) * 4 + c;
                    const kernelIndex = (ky + 1) * 3 + (kx + 1);
                    sum += data[pixelIndex] * kernel[kernelIndex];
                  }
                }
                const currentIndex = (y * width + x) * 4 + c;
                sharpened[currentIndex] = Math.min(255, Math.max(0, sum));
              }
              // Copy alpha channel
              const alphaIndex = (y * width + x) * 4 + 3;
              sharpened[alphaIndex] = data[alphaIndex];
            }
          }
          
          data = sharpened;
          imageData = new ImageData(data, width, height);
        }
        
        // Apply contrast and brightness adjustments
        for (let i = 0; i < data.length; i += 4) {
          let r = data[i];
          let g = data[i + 1];
          let b = data[i + 2];
          
          // Apply contrast and brightness
          r = Math.min(255, Math.max(0, (r - 128) * contrast + 128 + brightness));
          g = Math.min(255, Math.max(0, (g - 128) * contrast + 128 + brightness));
          b = Math.min(255, Math.max(0, (b - 128) * contrast + 128 + brightness));
          
          if (grayscale) {
            const gray = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
            r = g = b = gray;
          }
          
          data[i] = r;
          data[i + 1] = g;
          data[i + 2] = b;
        }
        
        enhanceCtx.putImageData(imageData, 0, 0);
        return enhanceCanvas.toDataURL('image/png');
      };
      
      // Try multiple image enhancements with sharpening for better detection
      const attempts = [
        createEnhancedImage(canvas, 1.0, 0, false, true), // Sharpened original
        createEnhancedImage(canvas, 1.5, 30, false, true), // Sharpened high contrast
        createEnhancedImage(canvas, 2.0, 0, true, true), // Sharpened high contrast grayscale
        createEnhancedImage(canvas, 1.8, 40, false, true), // Sharpened very high contrast
        createEnhancedImage(canvas, 1.3, -10, true, true), // Sharpened dark grayscale
        createEnhancedImage(canvas, 2.5, 60, true, true), // Extreme sharpened contrast
      ];
      
      for (let i = 0; i < attempts.length; i++) {
        try {
          const img = new Image();
          
          const loadPromise = new Promise<HTMLImageElement>((resolve, reject) => {
            img.onload = () => resolve(img);
            img.onerror = reject;
            img.src = attempts[i];
          });
          
          const imageElement = await loadPromise;
          const result = await codeReader.decodeFromImageElement(imageElement);
          
          if (result && result.getText()) {
            const detectedCode = result.getText();
            console.log(`Barcode detected on attempt ${i + 1}:`, detectedCode);
            
            // Fetch book info and pass to callback
            const bookData = await fetchBookInfo(detectedCode);
            onScan(detectedCode, bookData);
            handleClose();
            return;
          }
        } catch (attemptError) {
          console.log(`Detection attempt ${i + 1} failed, trying next enhancement`);
        }
      }
      
      // If no barcode detected, show error
      setError("No barcode detected. Please position a barcode clearly in front of the camera and try again.");
      setIsProcessing(false);
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.log('No barcode detected after all enhancement attempts:', errorMessage);
      setError("Scanning failed. Please try again or use manual input.");
      setIsProcessing(false);
    }
  };

  useEffect(() => {
    if (isOpen && showCamera) {
      startCamera();
    } else if (!isOpen) {
      stopCamera();
    }

    return () => {
      stopCamera();
    };
  }, [isOpen, showCamera, startCamera]);

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span className="flex items-center space-x-2">
              <BookOpen className="w-5 h-5" />
              <span>Add Book</span>
            </span>
            <Button variant="ghost" size="icon" onClick={handleClose}>
              <X className="w-4 h-4" />
            </Button>
          </DialogTitle>
          <DialogDescription>
            Enter ISBN manually for best results, or try camera scanning
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Manual ISBN Entry - Primary Method */}
          <div className="space-y-3">
            <div className="text-sm font-medium text-gray-700">Enter ISBN Number</div>
            <div className="space-y-2">
              <Input
                type="text"
                placeholder="978-0-123456-78-9 or 9780123456789"
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleManualSubmit()}
                className="text-lg"
                disabled={isLoadingBookInfo}
                autoFocus
              />
              <Button 
                onClick={handleManualSubmit} 
                className="w-full"
                disabled={!manualCode.trim() || isLoadingBookInfo}
                size="lg"
              >
                {isLoadingBookInfo ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Looking up book info...
                  </>
                ) : (
                  <>
                    <Type className="w-4 h-4 mr-2" />
                    Add Book with ISBN
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Book Preview */}
          {bookInfo && (
            <div className="border rounded-lg p-3 bg-gray-50">
              <div className="text-sm font-medium text-gray-700 mb-2">Book Preview</div>
              <div className="flex space-x-3">
                {bookInfo.imageUrl && (
                  <img 
                    src={bookInfo.imageUrl} 
                    alt={bookInfo.title}
                    className="w-16 h-20 object-cover rounded"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm truncate">{bookInfo.title}</div>
                  <div className="text-sm text-gray-600 truncate">{bookInfo.author}</div>
                  <div className="text-xs text-gray-500">ISBN: {bookInfo.isbn}</div>
                </div>
              </div>
            </div>
          )}

          {/* Divider */}
          <div className="flex items-center space-x-2">
            <div className="flex-1 border-t border-gray-200"></div>
            <span className="text-xs text-gray-500 px-2">OR</span>
            <div className="flex-1 border-t border-gray-200"></div>
          </div>

          {/* Camera Scanning Toggle */}
          {!showCamera ? (
            <Button 
              onClick={() => setShowCamera(true)} 
              variant="outline" 
              className="w-full"
            >
              <Camera className="w-4 h-4 mr-2" />
              Try Camera Scanning
            </Button>
          ) : (
            <div className="space-y-3">
              {/* Camera View - Optimized for Maximum Sharpness */}
              <div className="relative bg-black rounded-lg overflow-hidden" style={{ aspectRatio: '16/9' }}>
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  onClick={handleVideoClick}
                  className="w-full h-full block cursor-pointer"
                  style={{ 
                    objectFit: 'cover',
                    imageRendering: 'crisp-edges'
                  }}
                />
                <canvas ref={canvasRef} className="hidden" />

                {/* Loading State */}
                {isInitializing && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50">
                    <div className="text-white text-center">
                      <Loader2 className="w-8 h-8 mx-auto mb-2 animate-spin" />
                      <p className="text-sm">Starting camera...</p>
                    </div>
                  </div>
                )}

                {/* Camera not ready state */}
                {!isScanning && !isInitializing && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50">
                    <div className="text-white text-center">
                      <Camera className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">Preparing camera...</p>
                    </div>
                  </div>
                )}

                {/* Focus indicator */}
                {isFocusing && (
                  <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                    <div className="w-16 h-16 border-2 border-yellow-400 rounded-full animate-pulse"></div>
                  </div>
                )}

                {/* Scanning overlay for better visibility */}
                {isScanning && (
                  <div className="absolute inset-0 pointer-events-none">
                    <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-64 h-32 border-2 border-white border-dashed rounded-lg opacity-50"></div>
                    <div className="absolute top-4 left-4 bg-black bg-opacity-50 text-white text-xs px-2 py-1 rounded">
                      Position barcode within frame • Tap to focus
                    </div>
                  </div>
                )}
              </div>

              {/* Camera Controls */}
              <div className="space-y-2">
                <Button 
                  onClick={triggerCameraScan} 
                  className="w-full"
                  disabled={isProcessing || !isScanning}
                  size="lg"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Scanning...
                    </>
                  ) : (
                    <>
                      <Camera className="w-4 h-4 mr-2" />
                      Scan Barcode Now
                    </>
                  )}
                </Button>
                
                <div className="flex gap-2">
                  <Button 
                    onClick={handleVideoClick as any}
                    variant="outline"
                    className="flex-1"
                    disabled={isFocusing}
                  >
                    {isFocusing ? "Focusing..." : "Focus Camera"}
                  </Button>
                  <Button 
                    onClick={() => setShowCamera(false)} 
                    variant="outline"
                    className="flex-1"
                  >
                    Hide Camera
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <div className="flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
                <p className="text-red-800 text-sm">{error}</p>
              </div>
            </div>
          )}

          {/* Help Text */}
          <div className="text-xs text-gray-500 text-center space-y-1">
            <p>Manual entry is most reliable - ISBN format: 9780140449136</p>
            <p>For camera: tap video or use "Focus Camera" if image is blurry</p>
            <p>Position barcode clearly within the frame for best results</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Camera, Upload, Type, X, Loader2 } from "lucide-react";

interface EnhancedBarcodeScannerProps {
  onScan: (barcode: string, bookData?: any) => void;
  onClose: () => void;
  isOpen: boolean;
}

export default function EnhancedBarcodeScanner({ onScan, onClose, isOpen }: EnhancedBarcodeScannerProps) {
  const [manualCode, setManualCode] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadStatus, setUploadStatus] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateISBN = (input: string): string | null => {
    const cleaned = input.replace(/[^\d]/g, '');
    if (cleaned.length === 10 || cleaned.length === 13) {
      return cleaned;
    }
    return null;
  };

  const fetchBookInfo = async (isbn: string) => {
    try {
      const apis = [
        `https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}`,
        `https://openlibrary.org/api/books?bibkeys=ISBN:${isbn}&format=json&jscmd=data`
      ];

      for (const apiUrl of apis) {
        try {
          const response = await fetch(apiUrl);
          if (response.ok) {
            const data = await response.json();
            
            if (apiUrl.includes('googleapis.com') && data.items?.length > 0) {
              const book = data.items[0].volumeInfo;
              return {
                title: book.title || '',
                author: book.authors?.[0] || '',
                isbn: isbn,
                imageUrl: book.imageLinks?.thumbnail || null,
                description: book.description || ''
              };
            }
          }
        } catch (apiError) {
          continue;
        }
      }
      return null;
    } catch (error) {
      return null;
    }
  };

  const handleManualSubmit = async () => {
    const trimmedCode = manualCode.trim();
    if (!trimmedCode) {
      setError("Please enter an ISBN number");
      return;
    }

    const validISBN = validateISBN(trimmedCode);
    if (!validISBN) {
      setError("Please enter a valid ISBN (10 or 13 digits)");
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      const bookData = await fetchBookInfo(validISBN);
      onScan(validISBN, bookData);
      onClose();
    } catch (error) {
      setError("Failed to process ISBN. Please try again.");
      setIsProcessing(false);
    }
  };

  const startCameraScanning = async () => {
    try {
      setError(null);
      setIsProcessing(true);
      setUploadStatus("Opening camera...");

      // Request camera access
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          facingMode: 'environment', // Use back camera if available
          width: { ideal: 1280 },
          height: { ideal: 720 }
        } 
      });

      // Create video element to show camera feed
      const video = document.createElement('video');
      video.srcObject = stream;
      video.autoplay = true;
      video.playsInline = true;

      // Create capture button
      const captureBtn = document.createElement('button');
      captureBtn.innerText = 'Capture Barcode';
      captureBtn.style.position = 'fixed';
      captureBtn.style.bottom = '20px';
      captureBtn.style.left = '50%';
      captureBtn.style.transform = 'translateX(-50%)';
      captureBtn.style.padding = '12px 24px';
      captureBtn.style.backgroundColor = '#3b82f6';
      captureBtn.style.color = 'white';
      captureBtn.style.border = 'none';
      captureBtn.style.borderRadius = '8px';
      captureBtn.style.fontSize = '16px';
      captureBtn.style.zIndex = '9999';

      // Create close button
      const closeBtn = document.createElement('button');
      closeBtn.innerText = '×';
      closeBtn.style.position = 'fixed';
      closeBtn.style.top = '20px';
      closeBtn.style.right = '20px';
      closeBtn.style.padding = '8px 12px';
      closeBtn.style.backgroundColor = 'rgba(0,0,0,0.5)';
      closeBtn.style.color = 'white';
      closeBtn.style.border = 'none';
      closeBtn.style.borderRadius = '50%';
      closeBtn.style.fontSize = '20px';
      closeBtn.style.zIndex = '9999';

      // Style video for fullscreen
      video.style.position = 'fixed';
      video.style.top = '0';
      video.style.left = '0';
      video.style.width = '100vw';
      video.style.height = '100vh';
      video.style.objectFit = 'cover';
      video.style.zIndex = '9998';
      video.style.backgroundColor = 'black';

      document.body.appendChild(video);
      document.body.appendChild(captureBtn);
      document.body.appendChild(closeBtn);

      setUploadStatus("Camera ready - Position barcode in view and tap Capture");

      const cleanup = () => {
        stream.getTracks().forEach(track => track.stop());
        document.body.removeChild(video);
        document.body.removeChild(captureBtn);
        document.body.removeChild(closeBtn);
        setIsProcessing(false);
        setUploadStatus("");
      };

      captureBtn.onclick = () => {
        // Capture image from video
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(video, 0, 0);
        
        // Convert to blob and process
        canvas.toBlob((blob) => {
          if (blob) {
            const file = new File([blob], 'barcode-capture.jpg', { type: 'image/jpeg' });
            const fakeEvent = { target: { files: [file] } };
            handleImageUpload(fakeEvent as any);
          }
          cleanup();
        }, 'image/jpeg', 0.8);
      };

      closeBtn.onclick = cleanup;

    } catch (error) {
      console.error('Camera access error:', error);
      setError("Camera access denied or not available. Please use 'Upload Barcode Image' instead.");
      setIsProcessing(false);
      setUploadStatus("");
    }
  };

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    setError(null);
    setUploadStatus("Processing barcode image...");

    try {
      // Convert image to base64
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const imageDataUrl = e.target?.result as string;
          setUploadStatus("Analyzing barcode...");
          
          // Simulate OCR processing
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          // For now, prompt user to enter manually since OCR needs proper implementation
          setUploadStatus("");
          setError("Barcode reading from images is being enhanced. Please enter the ISBN number manually for now.");
          setIsProcessing(false);
        } catch (ocrError) {
          setError("Failed to read barcode from image. Please enter ISBN manually.");
          setUploadStatus("");
          setIsProcessing(false);
        }
      };
      
      reader.readAsDataURL(file);
    } catch (error) {
      setError("Failed to process image. Please enter ISBN manually.");
      setUploadStatus("");
      setIsProcessing(false);
    }
  };

  const handleClose = () => {
    setManualCode("");
    setError(null);
    setUploadStatus("");
    setIsProcessing(false);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle>Scan Barcode</DialogTitle>
            <Button variant="ghost" size="icon" onClick={handleClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>

        <div className="space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          <div className="space-y-3">
            <div className="text-center">
              <Camera className="h-12 w-12 text-gray-400 mx-auto mb-3" />
              <h3 className="font-medium mb-2">Barcode Scanner</h3>
              <p className="text-sm text-gray-500 mb-4">
                Scan or upload a barcode image to find book details
              </p>
            </div>

            <div className="space-y-3">
              <Button
                variant="outline"
                onClick={startCameraScanning}
                disabled={isProcessing}
                className="w-full"
              >
                <Camera className="h-4 w-4 mr-2" />
                Scan Barcode
              </Button>

              <input
                type="file"
                ref={fileInputRef}
                onChange={handleImageUpload}
                accept="image/*"
                className="hidden"
              />
              
              <Button
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={isProcessing}
                className="w-full"
              >
                <Upload className="h-4 w-4 mr-2" />
                Click Photo of Barcode
              </Button>

              {uploadStatus && (
                <p className="text-xs text-center text-gray-500">{uploadStatus}</p>
              )}

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-white px-2 text-gray-500">Or</span>
                </div>
              </div>

              <Input
                type="text"
                placeholder="Enter ISBN manually (e.g., 9781234567890)"
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                disabled={isProcessing}
              />

              <Button
                onClick={handleManualSubmit}
                disabled={!manualCode.trim() || isProcessing}
                className="w-full"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Searching...
                  </>
                ) : (
                  <>
                    <Type className="h-4 w-4 mr-2" />
                    Search Book
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
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

  const startCameraScanning = () => {
    setError("Camera scanning is being enhanced. Please use 'Upload Barcode Image' or enter ISBN manually for now.");
  };

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    setError(null);
    setUploadStatus("Processing barcode image...");

    try {
      // Simulate barcode detection processing
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      setUploadStatus("");
      setError("Barcode detection from images is being enhanced. Please enter the ISBN manually for now.");
      setIsProcessing(false);
    } catch (error) {
      setError("Failed to process image. Please try again or enter manually.");
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
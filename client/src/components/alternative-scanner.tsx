import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Camera, Upload, Type, X, Loader2 } from "lucide-react";

interface AlternativeScannerProps {
  onScan: (barcode: string, bookData?: any) => void;
  onClose: () => void;
  isOpen: boolean;
}

export default function AlternativeScanner({ onScan, onClose, isOpen }: AlternativeScannerProps) {
  const [manualCode, setManualCode] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Function to fetch book information from ISBN
  const fetchBookInfo = async (isbn: string) => {
    if (!isbn || isbn.length < 10) return null;
    
    try {
      // Try Google Books API first
      const response = await fetch(`https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}`);
      const data = await response.json();
      
      if (data.items && data.items.length > 0) {
        const book = data.items[0].volumeInfo;
        return {
          title: book.title || 'Unknown Title',
          author: book.authors ? book.authors.join(', ') : 'Unknown Author',
          isbn: isbn,
          description: book.description || '',
          imageUrl: book.imageLinks?.thumbnail || null,
          pageCount: book.pageCount || 0,
          publishedDate: book.publishedDate || '',
          categories: book.categories || []
        };
      }
      
      return null;
    } catch (error) {
      console.log('Book info fetch failed:', error);
      return null;
    }
  };

  // Handle manual ISBN input
  const handleManualSubmit = async () => {
    if (!manualCode.trim()) {
      setError("Please enter an ISBN number");
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      const cleanIsbn = manualCode.replace(/[^\d]/g, '');
      
      if (cleanIsbn.length !== 10 && cleanIsbn.length !== 13) {
        setError("Please enter a valid 10 or 13 digit ISBN");
        setIsProcessing(false);
        return;
      }

      const bookData = await fetchBookInfo(cleanIsbn);
      console.log('Book information found:', bookData);
      console.log('Manual ISBN entered:', cleanIsbn);
      
      onScan(cleanIsbn, bookData);
      handleClose();
    } catch (error) {
      setError("Failed to process ISBN. Please try again.");
      setIsProcessing(false);
    }
  };

  // Handle photo upload from device camera or gallery
  const handlePhotoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    setError(null);

    try {
      // Convert file to base64 for processing
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const imageDataUrl = e.target?.result as string;
          
          // Import Tesseract dynamically to avoid build issues
          const Tesseract = await import('tesseract.js');
          
          console.log('Starting OCR on uploaded image...');
          
          // Use OCR to extract text from uploaded image
          const { data: { text } } = await Tesseract.recognize(imageDataUrl, 'eng', {
            logger: m => {
              if (m.status === 'recognizing text') {
                console.log(`OCR Progress: ${Math.round(m.progress * 100)}%`);
              }
            }
          });
          
          console.log('OCR detected text from upload:', text);
          
          // Extract ISBN patterns
          const isbnPatterns = [
            /ISBN[-\s]*:?\s*(\d{13})/gi,
            /ISBN[-\s]*:?\s*(\d{10})/gi,
            /(\d{13})/g,
            /(\d{10})/g
          ];
          
          let detectedIsbn = null;
          
          for (const pattern of isbnPatterns) {
            const matches = text.match(pattern);
            if (matches) {
              for (const match of matches) {
                const cleanIsbn = match.replace(/[^\d]/g, '');
                if (cleanIsbn.length === 10 || cleanIsbn.length === 13) {
                  detectedIsbn = cleanIsbn;
                  break;
                }
              }
              if (detectedIsbn) break;
            }
          }
          
          if (detectedIsbn) {
            console.log('Found ISBN in uploaded image:', detectedIsbn);
            const bookData = await fetchBookInfo(detectedIsbn);
            onScan(detectedIsbn, bookData);
            handleClose();
          } else {
            setError("No ISBN found in the uploaded image. Please try a clearer photo or enter manually.");
            setIsProcessing(false);
          }
          
        } catch (ocrError) {
          console.error('OCR processing failed:', ocrError);
          setError("Failed to read text from image. Please try manual entry.");
          setIsProcessing(false);
        }
      };
      
      reader.readAsDataURL(file);
      
    } catch (error) {
      console.error('Photo upload failed:', error);
      setError("Failed to process photo. Please try again.");
      setIsProcessing(false);
    }
  };

  const triggerPhotoUpload = () => {
    fileInputRef.current?.click();
  };

  const handleClose = () => {
    setManualCode("");
    setError(null);
    setIsProcessing(false);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Camera className="w-5 h-5" />
              Add Book by ISBN
            </span>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleClose}
              className="h-8 w-8"
            >
              <X className="h-4 w-4" />
            </Button>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Manual ISBN Entry */}
          <div className="space-y-2">
            <label className="text-sm font-medium flex items-center gap-2">
              <Type className="w-4 h-4" />
              Manual ISBN Entry (Most Reliable)
            </label>
            <div className="flex gap-2">
              <Input
                placeholder="Enter ISBN (e.g., 9780140449136)"
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleManualSubmit()}
                disabled={isProcessing}
              />
              <Button 
                onClick={handleManualSubmit}
                disabled={isProcessing || !manualCode.trim()}
              >
                {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : "Add"}
              </Button>
            </div>
          </div>

          {/* Photo Upload */}
          <div className="space-y-2">
            <label className="text-sm font-medium flex items-center gap-2">
              <Upload className="w-4 h-4" />
              Take Photo or Upload Image
            </label>
            <Button 
              onClick={triggerPhotoUpload}
              variant="outline"
              className="w-full"
              disabled={isProcessing}
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Camera className="w-4 h-4 mr-2" />
                  Take Photo / Upload Image
                </>
              )}
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handlePhotoUpload}
              className="hidden"
            />
          </div>

          {/* Error Message */}
          {error && (
            <div className="text-sm text-red-600 bg-red-50 p-3 rounded-md">
              {error}
            </div>
          )}

          {/* Help Text */}
          <div className="text-xs text-gray-500 text-center space-y-1">
            <p><strong>Manual entry</strong> is most reliable - ISBN format: 9780140449136</p>
            <p><strong>Photo method</strong> uses your device camera to capture a sharp image</p>
            <p>Point camera at ISBN barcode or printed ISBN number for best results</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { formatCurrency, getBookStatusColor, getBookStatusText } from "@/lib/utils";
import { Book, User, Calendar, MapPin, Clock, Star, Expand, X } from "lucide-react";
import type { BookWithOwner } from "@shared/schema";

interface BookDetailsModalProps {
  book: BookWithOwner | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onBorrow?: (book: BookWithOwner) => void;
  onEdit?: (book: BookWithOwner) => void;
}

export default function BookDetailsModal({ 
  book, 
  open, 
  onOpenChange, 
  onBorrow, 
  onEdit 
}: BookDetailsModalProps) {
  const [imageExpanded, setImageExpanded] = useState(false);
  
  if (!book) return null;

  const statusColor = getBookStatusColor(book.isAvailable);
  const statusText = getBookStatusText(book.isAvailable);
  const coverImage = book.coverImageUrl || book.imageUrl;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md mx-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Book className="h-5 w-5 text-primary" />
            <span>Book Details</span>
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Book Cover */}
          <div className="w-full h-48 bg-gradient-to-br from-blue-100 to-blue-200 rounded-lg flex items-center justify-center mb-4 relative overflow-hidden group cursor-pointer"
               onClick={() => coverImage && setImageExpanded(true)}>
            {coverImage ? (
              <>
                <img 
                  src={coverImage} 
                  alt={book.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = 'none';
                    (e.target as HTMLElement).nextElementSibling?.classList.remove('hidden');
                  }}
                />
                <div className="hidden w-full h-full flex flex-col items-center justify-center p-4">
                  <span className="text-lg font-bold text-blue-800 text-center">
                    {book.title}
                  </span>
                </div>
                {/* Expand icon overlay */}
                <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-all duration-200 flex items-center justify-center">
                  <Expand className="w-8 h-8 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
                </div>
              </>
            ) : (
              <span className="text-lg font-bold text-blue-800 text-center px-4">
                {book.title}
              </span>
            )}
          </div>
          
          {/* Title and Author */}
          <div className="text-center">
            <h2 className="text-xl font-bold text-gray-900 mb-1">{book.title}</h2>
            <p className="text-lg text-gray-600">{book.author}</p>
          </div>
          
          <Separator />
          
          {/* Book Details */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700">Genre:</span>
              <Badge variant="secondary">{book.genre}</Badge>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700">Condition:</span>
              <span className="text-sm text-gray-600">{book.condition}</span>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700">Daily Fee:</span>
              <span className="text-lg font-bold text-primary">{formatCurrency(book.dailyFee)}/day</span>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700">Status:</span>
              <Badge className={statusColor}>{statusText}</Badge>
            </div>
            
            {book.owner && (
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700 flex items-center">
                  <User className="h-4 w-4 mr-1" />
                  Owner:
                </span>
                <span className="text-sm text-gray-600">{book.owner.name}</span>
              </div>
            )}
            
            {book.isbn && (
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">ISBN:</span>
                <span className="text-sm text-gray-600 font-mono">{book.isbn}</span>
              </div>
            )}
          </div>
          
          {book.description && (
            <>
              <Separator />
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-2">Description:</h4>
                <p className="text-sm text-gray-600 leading-relaxed">{book.description}</p>
              </div>
            </>
          )}
          
          <Separator />
          
          {/* Action Buttons */}
          <div className="flex space-x-3">
            {book.isAvailable && onBorrow ? (
              <Button 
                onClick={() => {
                  onBorrow(book);
                }}
                className="flex-1"
              >
                Borrow Book
              </Button>
            ) : onEdit ? (
              <Button 
                onClick={() => {
                  onEdit(book);
                  onOpenChange(false);
                }}
                variant="outline"
                className="flex-1"
              >
                Edit Book
              </Button>
            ) : (
              <Button disabled className="flex-1">
                Currently Unavailable
              </Button>
            )}
            
            <Button 
              variant="outline" 
              onClick={() => onOpenChange(false)}
              className="px-6"
            >
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
      
      {/* Expanded Image Modal */}
      {imageExpanded && coverImage && (
        <Dialog open={imageExpanded} onOpenChange={setImageExpanded}>
          <DialogContent className="max-w-2xl mx-auto p-2">
            <DialogHeader className="pb-2">
              <div className="flex items-center justify-between">
                <DialogTitle className="text-sm">{book.title} - Cover Image</DialogTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setImageExpanded(false)}
                  className="h-6 w-6 p-0"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </DialogHeader>
            <div className="flex items-center justify-center">
              <img 
                src={coverImage} 
                alt={`${book.title} cover`}
                className="max-w-full max-h-[70vh] object-contain rounded-lg"
                onError={(e) => {
                  console.error('Expanded image failed to load');
                  setImageExpanded(false);
                }}
              />
            </div>
          </DialogContent>
        </Dialog>
      )}
    </Dialog>
  );
}
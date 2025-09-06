import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency, getBookStatusColor, getBookStatusText } from "@/lib/utils";
import type { BookWithOwner } from "@shared/schema";
import ShareButton from "@/components/social/share-button";
import WishlistButton from "@/components/social/wishlist-button";
import AvailabilityAlertButton from "@/components/availability-alert-button";

interface BookCardProps {
  book: BookWithOwner;
  onBorrow?: (book: BookWithOwner) => void;
  onEdit?: (book: BookWithOwner) => void;
  showOwner?: boolean;
  variant?: "grid" | "list";
}

export default function BookCard({ 
  book, 
  onBorrow, 
  onEdit, 
  showOwner = true, 
  variant = "list" 
}: BookCardProps) {
  const statusColor = getBookStatusColor(book.isAvailable);
  const statusText = getBookStatusText(book.isAvailable);

  if (variant === "grid") {
    return (
      <Card className="book-card h-full flex flex-col cursor-pointer hover:shadow-lg transition-all duration-200 hover:scale-105">
        <CardContent className="p-0 flex flex-col h-full">
          {/* Book cover image area */}
          <div className="w-full h-48 relative overflow-hidden rounded-t-lg">
            {/* Always show the fallback with book title as primary display */}
            <div className="w-full h-full bg-gradient-to-br from-blue-100 to-blue-200 flex flex-col items-center justify-center p-4">
              <h3 className="text-lg font-bold text-blue-800 text-center mb-2 line-clamp-3">
                {book.title}
              </h3>
            </div>
            
            {/* Price */}
            <div className="absolute bottom-3 right-3 bg-white rounded-full px-3 py-1 shadow-md">
              <span className="text-sm font-semibold text-primary">
                {formatCurrency(book.dailyFee)}/day
              </span>
            </div>
            
            {/* Status badge */}
            <div className="absolute top-3 left-3">
              <Badge className={`text-xs ${statusColor}`}>
                {statusText}
              </Badge>
            </div>
          </div>
          
          {/* Book details below cover */}
          <div className="p-3 flex-1 flex flex-col">
            <h3 className="font-semibold text-sm mb-1 line-clamp-2">
              {book.title}
            </h3>
            <p className="text-xs text-text-secondary mb-1">
              by {book.author}
            </p>
            {showOwner && (
              <p className="text-xs text-text-secondary mb-2">
                Owner: {book.owner.name}
              </p>
            )}
            
            {/* Action Button for Grid View */}
            <div className="mt-auto">
              {book.isAvailable && onBorrow ? (
                <Button 
                  onClick={(e) => {
                    e.stopPropagation();
                    onBorrow(book);
                  }}
                  size="sm"
                  className="w-full"
                >
                  Borrow
                </Button>
              ) : onEdit ? (
                <Button 
                  onClick={(e) => {
                    e.stopPropagation();
                    onEdit(book);
                  }}
                  variant="outline"
                  size="sm"
                  className="w-full"
                >
                  Edit
                </Button>
              ) : (
                <AvailabilityAlertButton
                  bookId={book.id}
                  bookTitle={book.title}
                  isAvailable={book.isAvailable}
                  className="w-full"
                />
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="book-card">
      <CardContent className="p-4">
        <div className="flex items-start space-x-3">
          {/* Book cover image */}
          <div className="w-12 h-16 bg-gradient-to-br from-blue-100 to-blue-200 rounded flex items-center justify-center flex-shrink-0 overflow-hidden">
            {/* Always show book title abbreviation */}
            <span className="text-xs text-blue-600 font-medium text-center px-1">
              {book.title.substring(0, 3)}
            </span>
          </div>
          
          <div className="flex-1 min-w-0">
            <h4 className="font-medium text-text-primary mb-1">{book.title}</h4>
            <p className="text-sm text-text-secondary mb-1">{book.author}</p>
            {showOwner && (
              <p className="text-sm text-text-secondary mb-2">
                Owner: {book.owner.name}
              </p>
            )}
            
            <div className="flex items-center justify-between mb-2">
              <Badge className={`text-xs ${statusColor}`}>
                {statusText}
              </Badge>
              <span className="text-sm text-primary font-medium">
                {formatCurrency(book.dailyFee)}/day
              </span>
            </div>
            
            {/* Social Actions */}
            <div className="flex items-center space-x-2">
              <WishlistButton 
                bookId={book.id} 
                size="sm"
                showText={false}
                className="h-6 w-6 p-0"
              />
              <ShareButton
                bookId={book.id}
                bookTitle={book.title}
                bookAuthor={book.author}
                dailyFee={book.dailyFee}
                size="sm"
                showText={false}
                className="h-6 w-6 p-0"
              />
            </div>
          </div>
          
          <div className="flex-shrink-0 ml-2">
            {book.isAvailable && onBorrow ? (
              <Button 
                onClick={() => onBorrow(book)}
                size="sm"
              >
                Borrow
              </Button>
            ) : onEdit ? (
              <Button 
                onClick={() => onEdit(book)}
                variant="outline"
                size="sm"
              >
                Edit
              </Button>
            ) : (
              <AvailabilityAlertButton
                bookId={book.id}
                bookTitle={book.title}
                isAvailable={book.isAvailable}
              />
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

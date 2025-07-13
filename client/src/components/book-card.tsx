import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency, getBookStatusColor, getBookStatusText } from "@/lib/utils";
import type { BookWithOwner } from "@shared/schema";

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
      <Card className="book-card h-full flex flex-col">
        <CardContent className="p-4 flex flex-col h-full">
          {/* Placeholder for book cover */}
          <div className="w-full h-40 bg-gradient-to-br from-blue-100 to-blue-200 rounded-lg mb-4 flex items-center justify-center">
            <span className="text-sm text-blue-600 font-medium text-center px-3 leading-tight">
              {book.title}
            </span>
          </div>
          
          <div className="flex-1 flex flex-col">
            <h4 className="font-semibold text-text-primary text-base mb-2 line-clamp-2 min-h-[3rem]">
              {book.title}
            </h4>
            <p className="text-sm text-text-secondary mb-3">{book.author}</p>
            
            {showOwner && book.owner && (
              <p className="text-xs text-text-secondary mb-3">
                Owner: {book.owner.name}
              </p>
            )}
            
            <div className="flex items-center justify-between mb-4 mt-auto">
              <Badge className={`text-xs ${statusColor}`}>
                {statusText}
              </Badge>
              <span className="text-sm text-primary font-semibold">
                {formatCurrency(book.dailyFee)}/day
              </span>
            </div>
            
            {book.isAvailable && onBorrow ? (
              <Button 
                onClick={() => onBorrow(book)}
                className="w-full py-2"
                size="sm"
              >
                Borrow
              </Button>
            ) : onEdit ? (
              <Button 
                onClick={() => onEdit(book)}
                variant="outline"
                className="w-full py-2"
                size="sm"
              >
                Edit
              </Button>
            ) : (
              <Button 
                disabled
                className="w-full py-2"
                size="sm"
              >
                Unavailable
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="book-card">
      <CardContent className="p-4">
        <div className="flex items-start space-x-3">
          {/* Placeholder for book cover */}
          <div className="w-12 h-16 bg-gradient-to-br from-blue-100 to-blue-200 rounded flex items-center justify-center flex-shrink-0">
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
            
            <div className="flex items-center justify-between">
              <Badge className={`text-xs ${statusColor}`}>
                {statusText}
              </Badge>
              <span className="text-sm text-primary font-medium">
                {formatCurrency(book.dailyFee)}/day
              </span>
            </div>
          </div>
          
          <div className="flex-shrink-0">
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
              <Button disabled size="sm">
                Unavailable
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

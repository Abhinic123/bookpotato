import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Calendar, User, MapPin, IndianRupee, BookOpen, Edit } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import PaymentModal from "./payment-modal";

interface BookDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  book: any;
  user: any;
  onEdit?: (book: any) => void;
}

export default function BookDetailsModal({ isOpen, onClose, book, user, onEdit }: BookDetailsModalProps) {
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const { toast } = useToast();

  if (!book) return null;

  const isOwner = book.ownerId === user?.id;
  const canBorrow = !isOwner && book.isAvailable;

  const handleBorrow = () => {
    setShowPaymentModal(true);
  };

  const handleEdit = () => {
    onEdit?.(book);
    onClose();
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Book Details</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Book Cover and Title */}
            <Card>
              <CardContent className="p-4">
                <div className="flex items-start space-x-4">
                  <div className="w-16 h-20 bg-gradient-to-br from-primary/20 to-secondary/20 rounded flex items-center justify-center flex-shrink-0">
                    {book.imageUrl ? (
                      <img 
                        src={book.imageUrl} 
                        alt={book.title}
                        className="w-full h-full object-cover rounded"
                      />
                    ) : (
                      <BookOpen className="h-8 w-8 text-primary" />
                    )}
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg">{book.title}</h3>
                    <p className="text-text-secondary">by {book.author}</p>
                    <div className="flex items-center space-x-2 mt-2">
                      <Badge variant={book.isAvailable ? "default" : "secondary"}>
                        {book.isAvailable ? "Available" : "Borrowed"}
                      </Badge>
                      <Badge variant="outline">{book.condition}</Badge>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Book Information */}
            <Card>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center space-x-3">
                  <User className="h-4 w-4 text-text-secondary" />
                  <span className="text-sm">Owner: {book.owner?.name}</span>
                </div>
                
                <div className="flex items-center space-x-3">
                  <IndianRupee className="h-4 w-4 text-text-secondary" />
                  <span className="text-sm">₹{book.dailyFee}/day</span>
                </div>

                {book.genre && (
                  <div className="flex items-center space-x-3">
                    <BookOpen className="h-4 w-4 text-text-secondary" />
                    <span className="text-sm">Genre: {book.genre}</span>
                  </div>
                )}

                {book.isbn && (
                  <div className="flex items-center space-x-3">
                    <span className="text-xs font-mono bg-gray-100 px-2 py-1 rounded">
                      ISBN: {book.isbn}
                    </span>
                  </div>
                )}

                {book.description && (
                  <div className="pt-2">
                    <p className="text-sm text-text-secondary">{book.description}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Actions */}
            <div className="flex space-x-3">
              <Button 
                variant="outline" 
                onClick={onClose}
                className="flex-1"
              >
                Close
              </Button>
              
              {isOwner && (
                <Button 
                  variant="outline" 
                  onClick={handleEdit}
                  className="flex-1"
                >
                  <Edit className="h-4 w-4 mr-2" />
                  Edit
                </Button>
              )}
              
              {canBorrow && (
                <Button 
                  onClick={handleBorrow}
                  className="flex-1"
                >
                  Borrow Book
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Payment Modal */}
      <PaymentModal
        isOpen={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        book={book}
        onSuccess={() => {
          setShowPaymentModal(false);
          onClose();
        }}
      />
    </>
  );
}
import { useQuery } from "@tanstack/react-query";
import { Search, BookOpen } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export default function BrowseWorking() {
  const [searchQuery, setSearchQuery] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: books, isLoading } = useQuery({
    queryKey: ['/api/books/all'],
  });

  const { data: userResponse } = useQuery({
    queryKey: ['/api/auth/me'],
  });
  
  const user = (userResponse as any)?.user;

  const borrowMutation = useMutation({
    mutationFn: async (bookId: number) => {
      const response = await fetch("/api/rentals", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ bookId })
      });
      if (!response.ok) {
        throw new Error("Failed to borrow book");
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Borrow Request Sent",
        description: "The book owner will be notified of your request."
      });
      queryClient.invalidateQueries({ queryKey: ['/api/books/all'] });
    },
    onError: (error: any) => {
      toast({
        title: "Borrow Failed",
        description: error.message || "Failed to borrow book",
        variant: "destructive"
      });
    }
  });

  const handleBorrow = (book: any) => {
    borrowMutation.mutate(book.id);
  };

  if (isLoading) {
    return (
      <div className="p-4">
        <div className="text-center py-8">
          <p>Loading books...</p>
        </div>
      </div>
    );
  }

  // Handle different possible response structures
  const booksArray = Array.isArray(books) ? books : 
                     Array.isArray((books as any)?.books) ? (books as any).books :
                     Array.isArray((books as any)?.data) ? (books as any).data : [];
  
  // Filter books based on search
  const filteredBooks = booksArray.filter((book: any) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      book.title?.toLowerCase().includes(query) ||
      book.author?.toLowerCase().includes(query) ||
      book.genre?.toLowerCase().includes(query)
    );
  });

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="p-4 bg-gradient-to-r from-primary to-secondary text-white">
        <h1 className="text-xl font-bold mb-2">Browse Books</h1>
        <p className="text-sm opacity-90">
          {Array.isArray(books) ? books.length : 0} books available for borrowing
        </p>
      </div>

      {/* Search */}
      <div className="p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-text-secondary" />
          <Input
            className="pl-10"
            placeholder="Search books, authors..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Debug Info */}
      <div className="p-2 bg-yellow-100 text-xs border">
        Debug: Raw Response: {typeof books} | Books Array: {booksArray.length} | Filtered: {filteredBooks.length} | Loading: {isLoading ? 'Yes' : 'No'}
      </div>

      {/* Books Grid */}
      <div className="p-4">
        {filteredBooks.length === 0 ? (
          <Card>
            <CardContent className="pt-6 text-center">
              <BookOpen className="h-12 w-12 text-text-secondary mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">
                {searchQuery ? "No books found" : "No books available"}
              </h3>
              <p className="text-text-secondary">
                {searchQuery 
                  ? "Try adjusting your search terms" 
                  : "Ask your society members to add some books!"}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            {filteredBooks.map((book: any) => (
              <Card key={book.id} className="overflow-hidden">
                <div className="aspect-[3/4] bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center">
                  {book.coverImage ? (
                    <img 
                      src={book.coverImage} 
                      alt={book.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <BookOpen className="h-12 w-12 text-primary" />
                  )}
                </div>
                <CardContent className="p-3">
                  <h3 className="font-semibold text-sm mb-1 line-clamp-2">
                    {book.title || 'Untitled'}
                  </h3>
                  <p className="text-xs text-text-secondary mb-2">
                    by {book.author || 'Unknown Author'}
                  </p>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-text-secondary">
                      Owner: {book.owner?.name || 'Unknown'}
                    </span>
                    <span className="text-sm font-semibold text-primary">
                      ₹{book.dailyFee || 0}/day
                    </span>
                  </div>
                  {book.ownerId !== user?.id && (
                    <Button 
                      size="sm" 
                      className="w-full"
                      disabled={!book.isAvailable}
                      onClick={() => handleBorrow(book)}
                    >
                      {book.isAvailable ? "Borrow" : "Not Available"}
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
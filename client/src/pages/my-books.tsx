import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { formatCurrency, formatDateRelative, getBookStatusColor, getBookStatusText } from "@/lib/utils";
import type { RentalWithDetails, Book } from "@shared/schema";
import { BookOpen, Plus, Edit } from "lucide-react";
import AddBookModal from "@/components/modals/add-book-modal";
import BookDetailsModal from "@/components/modals/book-details-modal";

export default function MyBooks() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedBook, setSelectedBook] = useState<any>(null);
  const [showBookDetails, setShowBookDetails] = useState(false);
  const [editingBook, setEditingBook] = useState<any>(null);

  const { data: borrowedBooks, isLoading: loadingBorrowed } = useQuery({
    queryKey: ["/api/rentals/borrowed"],
  });

  const { data: lentBooks, isLoading: loadingLent } = useQuery({
    queryKey: ["/api/rentals/lent"],
  });

  const { data: myBooks, isLoading: loadingOwned } = useQuery({
    queryKey: ["/api/books/my"],
  });

  const { data: userResponse } = useQuery({
    queryKey: ['/api/auth/me'],
  });

  const user = (userResponse as any)?.user;

  const handleBookClick = (book: any) => {
    setSelectedBook(book);
    setShowBookDetails(true);
  };

  const handleEditBook = (book: any) => {
    setEditingBook(book);
    setShowAddModal(true);
  };

  const returnBookMutation = useMutation({
    mutationFn: async (rentalId: number) => {
      const response = await apiRequest("PATCH", `/api/rentals/${rentalId}/return`);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Book Returned",
        description: "Book has been successfully returned.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/rentals"] });
      queryClient.invalidateQueries({ queryKey: ["/api/books"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to return book",
        variant: "destructive",
      });
    },
  });

  const handleReturnBook = (rentalId: number) => {
    returnBookMutation.mutate(rentalId);
  };

  const BorrowedBooksTab = () => (
    <div className="space-y-4">
      {loadingBorrowed ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-4">
                <div className="flex items-start space-x-3">
                  <div className="w-12 h-16 bg-gray-200 rounded"></div>
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-gray-200 rounded"></div>
                    <div className="h-3 bg-gray-200 rounded w-2/3"></div>
                    <div className="h-6 bg-gray-200 rounded w-1/2"></div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : borrowedBooks && borrowedBooks.length > 0 ? (
        borrowedBooks.map((rental: RentalWithDetails) => (
          <Card key={rental.id}>
            <CardContent className="p-4">
              <div className="flex items-start space-x-3">
                <div className="w-12 h-16 bg-gradient-to-br from-blue-100 to-blue-200 rounded flex items-center justify-center flex-shrink-0">
                  <span className="text-xs text-blue-600 font-medium text-center px-1">
                    {rental.book.title.substring(0, 3)}
                  </span>
                </div>
                
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium text-text-primary mb-1">
                    {rental.book.title}
                  </h4>
                  <p className="text-sm text-text-secondary mb-1">
                    {rental.book.author}
                  </p>
                  <p className="text-sm text-text-secondary mb-2">
                    Lender: {rental.lender.name}
                  </p>
                  
                  <div className="flex items-center justify-between mb-3">
                    <Badge className={getBookStatusColor(false, rental.endDate)}>
                      {formatDateRelative(rental.endDate)}
                    </Badge>
                    <span className="text-sm text-text-secondary">
                      {formatCurrency(rental.book.dailyFee)}/day
                    </span>
                  </div>
                </div>
              </div>
              
              <div className="flex space-x-2 mt-3">
                <Button 
                  onClick={() => handleReturnBook(rental.id)}
                  disabled={returnBookMutation.isPending}
                  className="flex-1"
                >
                  {returnBookMutation.isPending ? "Returning..." : "Return"}
                </Button>
                <Button variant="outline" className="flex-1">
                  Extend
                </Button>
              </div>
            </CardContent>
          </Card>
        ))
      ) : (
        <Card>
          <CardContent className="pt-6 text-center">
            <BookOpen className="h-12 w-12 text-text-secondary mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-text-primary mb-2">
              No Borrowed Books
            </h3>
            <p className="text-text-secondary">
              You haven't borrowed any books yet. Browse available books to get started!
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );

  const LentBooksTab = () => (
    <div className="space-y-4">
      {loadingLent ? (
        <div className="space-y-4">
          {[1, 2].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-4">
                <div className="flex items-start space-x-3">
                  <div className="w-12 h-16 bg-gray-200 rounded"></div>
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-gray-200 rounded"></div>
                    <div className="h-3 bg-gray-200 rounded w-2/3"></div>
                    <div className="h-6 bg-gray-200 rounded w-1/2"></div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : lentBooks && lentBooks.length > 0 ? (
        lentBooks.map((rental: RentalWithDetails) => (
          <Card key={rental.id}>
            <CardContent className="p-4">
              <div className="flex items-start space-x-3">
                <div className="w-12 h-16 bg-gradient-to-br from-green-100 to-green-200 rounded flex items-center justify-center flex-shrink-0">
                  <span className="text-xs text-green-600 font-medium text-center px-1">
                    {rental.book.title.substring(0, 3)}
                  </span>
                </div>
                
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium text-text-primary mb-1">
                    {rental.book.title}
                  </h4>
                  <p className="text-sm text-text-secondary mb-1">
                    {rental.book.author}
                  </p>
                  <p className="text-sm text-text-secondary mb-2">
                    Borrower: {rental.borrower.name}
                  </p>
                  
                  <div className="flex items-center justify-between mb-3">
                    <Badge className={getBookStatusColor(false, rental.endDate)}>
                      {formatDateRelative(rental.endDate)}
                    </Badge>
                    <span className="text-sm text-primary font-medium">
                      Earning: {formatCurrency(rental.lenderAmount)}
                    </span>
                  </div>
                </div>
              </div>
              
              <div className="flex space-x-2 mt-3">
                <Button variant="outline" className="flex-1">
                  Send Reminder
                </Button>
                <Button variant="outline" className="flex-1">
                  Details
                </Button>
              </div>
            </CardContent>
          </Card>
        ))
      ) : (
        <Card>
          <CardContent className="pt-6 text-center">
            <BookOpen className="h-12 w-12 text-text-secondary mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-text-primary mb-2">
              No Lent Books
            </h3>
            <p className="text-text-secondary">
              You haven't lent any books yet. Add books to your library to start earning!
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );

  const MyLibraryTab = () => (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">My Library</h3>
        <Button size="sm" onClick={() => setShowAddModal(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Book
        </Button>
      </div>
      
      {loadingOwned ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-4">
                <div className="flex items-start space-x-3">
                  <div className="w-12 h-16 bg-gray-200 rounded"></div>
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-gray-200 rounded"></div>
                    <div className="h-3 bg-gray-200 rounded w-2/3"></div>
                    <div className="h-6 bg-gray-200 rounded w-1/2"></div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : myBooks && myBooks.length > 0 ? (
        myBooks.map((book: Book) => (
          <Card key={book.id}>
            <CardContent className="p-4">
              <div className="flex items-start space-x-3">
                <div className="w-12 h-16 bg-gradient-to-br from-purple-100 to-purple-200 rounded flex items-center justify-center flex-shrink-0">
                  <span className="text-xs text-purple-600 font-medium text-center px-1">
                    {book.title.substring(0, 3)}
                  </span>
                </div>
                
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium text-text-primary mb-1">
                    {book.title}
                  </h4>
                  <p className="text-sm text-text-secondary mb-2">
                    {book.author}
                  </p>
                  
                  <div className="flex items-center justify-between">
                    <Badge className={getBookStatusColor(book.isAvailable)}>
                      {getBookStatusText(book.isAvailable)}
                    </Badge>
                    <span className="text-sm text-primary font-medium">
                      {formatCurrency(book.dailyFee)}/day
                    </span>
                  </div>
                </div>
                
                <Button variant="ghost" size="icon">
                  <Edit className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))
      ) : (
        <Card>
          <CardContent className="pt-6 text-center">
            <BookOpen className="h-12 w-12 text-text-secondary mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-text-primary mb-2">
              No Books in Library
            </h3>
            <p className="text-text-secondary mb-4">
              Start building your library by adding books you'd like to lend out.
            </p>
            <Button onClick={() => setShowAddModal(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Your First Book
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );

  return (
    <div className="p-4">
      <Tabs defaultValue="borrowed" className="w-full">
        <TabsList className="grid w-full grid-cols-3 mb-6">
          <TabsTrigger value="borrowed">Borrowed</TabsTrigger>
          <TabsTrigger value="lent">Lent Out</TabsTrigger>
          <TabsTrigger value="owned">My Library</TabsTrigger>
        </TabsList>
        
        <TabsContent value="borrowed">
          <BorrowedBooksTab />
        </TabsContent>
        
        <TabsContent value="lent">
          <LentBooksTab />
        </TabsContent>
        
        <TabsContent value="owned">
          <MyLibraryTab />
        </TabsContent>
      </Tabs>
      
      <AddBookModal 
        open={showAddModal} 
        onOpenChange={setShowAddModal} 
      />
    </div>
  );
}

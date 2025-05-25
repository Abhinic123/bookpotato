import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Building2, ChevronRight, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import BookCard from "@/components/book-card";
import BorrowBookModal from "@/components/modals/borrow-book-modal";
import { formatCurrency, formatDateRelative } from "@/lib/utils";
import type { BookWithOwner, RentalWithDetails } from "@shared/schema";

export default function Home() {
  const [selectedBook, setSelectedBook] = useState<BookWithOwner | null>(null);
  const [showBorrowModal, setShowBorrowModal] = useState(false);

  const { data: societies } = useQuery({
    queryKey: ["/api/societies/my"],
  });

  const { data: userStats } = useQuery({
    queryKey: ["/api/user/stats"],
  });

  const currentSociety = societies?.[0];

  const { data: societyStats } = useQuery({
    queryKey: ["/api/societies", currentSociety?.id, "stats"],
    enabled: !!currentSociety?.id,
  });

  const { data: recentBooks } = useQuery({
    queryKey: ["/api/books/all"],
  });

  const { data: activeRentals } = useQuery({
    queryKey: ["/api/rentals/active"],
  });

  // Filter recent books (limit to 3 most recent)
  const recentBooksLimited = recentBooks?.slice(0, 3) || [];

  // Find due soon rentals
  const dueSoonRentals = activeRentals?.filter((rental: RentalWithDetails) => {
    const dueDate = new Date(rental.endDate);
    const now = new Date();
    const diffInDays = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return diffInDays <= 1 && rental.borrowerId;
  }) || [];

  const handleBorrowBook = (book: BookWithOwner) => {
    setSelectedBook(book);
    setShowBorrowModal(true);
  };

  if (!currentSociety) {
    return (
      <div className="p-4 text-center">
        <div className="mb-8">
          <Building2 className="h-16 w-16 text-text-secondary mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-text-primary mb-2">
            Join a Society
          </h2>
          <p className="text-text-secondary mb-6">
            You need to join a society to start borrowing and lending books.
          </p>
          <Button>
            Explore Societies
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Society Header */}
      <div className="gradient-primary p-4 text-white">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold">Current Society</h2>
          <Button variant="ghost" size="sm" className="text-white opacity-90">
            Change
          </Button>
        </div>
        <div className="flex items-center space-x-3">
          <div className="w-12 h-12 bg-white bg-opacity-20 rounded-xl flex items-center justify-center">
            <Building2 className="h-6 w-6" />
          </div>
          <div>
            <h3 className="font-semibold">{currentSociety.name}</h3>
            <p className="text-sm opacity-90">
              {currentSociety?.memberCount || 0} members
            </p>
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="p-4 grid grid-cols-2 gap-4">
        <Card>
          <CardContent className="pt-6 text-center">
            <div className="text-2xl font-bold text-primary">
              {societyStats?.bookCount || 0}
            </div>
            <div className="text-sm text-text-secondary">Available Books</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <div className="text-2xl font-bold text-secondary">
              {userStats?.borrowedBooks || 0}
            </div>
            <div className="text-sm text-text-secondary">Your Borrows</div>
          </CardContent>
        </Card>
      </div>

      {/* Due Soon Section */}
      {dueSoonRentals.length > 0 && (
        <div className="p-4">
          <h3 className="text-lg font-semibold mb-4">Due Soon</h3>
          <div className="space-y-3">
            {dueSoonRentals.map((rental: RentalWithDetails) => (
              <Card key={rental.id} className="border-amber-200 bg-amber-50">
                <CardContent className="p-4">
                  <div className="flex items-center space-x-3">
                    <Clock className="h-5 w-5 text-amber-600" />
                    <div className="flex-1">
                      <h4 className="font-medium text-text-primary">
                        {rental.book.title}
                      </h4>
                      <p className="text-sm text-amber-700">
                        {formatDateRelative(rental.endDate)}
                      </p>
                    </div>
                    <Button size="sm" className="bg-amber-600 hover:bg-amber-700">
                      Return
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Recently Added Books */}
      <div className="p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Recently Added</h3>
          <Button variant="ghost" size="sm" className="text-primary">
            View All
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>

        {recentBooksLimited.length > 0 ? (
          <div className="space-y-3">
            {recentBooksLimited.map((book: BookWithOwner) => (
              <BookCard
                key={book.id}
                book={book}
                onBorrow={handleBorrowBook}
                variant="list"
              />
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="pt-6 text-center">
              <p className="text-text-secondary">
                No books available yet. Be the first to add one!
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Earnings Summary */}
      {userStats?.totalEarnings && userStats.totalEarnings > 0 && (
        <div className="p-4">
          <Card className="gradient-secondary text-white">
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="text-2xl font-bold mb-1">
                  {formatCurrency(userStats.totalEarnings)}
                </div>
                <div className="text-sm opacity-90">Total Earnings</div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <BorrowBookModal
        book={selectedBook}
        open={showBorrowModal}
        onOpenChange={setShowBorrowModal}
      />
    </div>
  );
}

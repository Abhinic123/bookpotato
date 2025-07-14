import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Building2, ChevronRight, Clock, Coins, Gift, Award } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import BookCard from "@/components/book-card";
import BorrowBookModal from "@/components/modals/borrow-book-modal";
import BookDetailsModal from "@/components/modals/book-details-modal";
import { formatCurrency, formatDateRelative } from "@/lib/utils";
import type { BookWithOwner, RentalWithDetails } from "@shared/schema";

export default function Home() {
  const [location, navigate] = useLocation();
  const [selectedBook, setSelectedBook] = useState<BookWithOwner | null>(null);
  const [showBorrowModal, setShowBorrowModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);

  const { data: societies } = useQuery({
    queryKey: ["/api/societies/my"],
  });

  const { data: userStats } = useQuery({
    queryKey: ["/api/user/stats"],
  });

  const currentSociety = (societies as any[])?.[0];

  const { data: societyStats } = useQuery({
    queryKey: ["/api/societies", currentSociety?.id, "stats"],
    enabled: !!currentSociety?.id,
  });

  const { data: recentBooks } = useQuery({
    queryKey: ["/api/books/all"],
  });

  const { data: brocksLeaderboard } = useQuery({
    queryKey: ["/api/brocks/leaderboard"],
  });

  const { data: activeRentals } = useQuery({
    queryKey: ["/api/rentals/active"],
  });

  const { data: userCredits } = useQuery({
    queryKey: ["/api/user/credits"],
  });

  const { data: recentRewards } = useQuery({
    queryKey: ["/api/user/recent-rewards"],
  });

  const { data: userBadges } = useQuery({
    queryKey: ["/api/user/badges"],
  });

  // Filter recent books (sort by most recent and limit to 3)
  const recentBooksLimited = (recentBooks as any[])
    ?.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    ?.slice(0, 3) || [];

  // Find due soon rentals
  const dueSoonRentals = (activeRentals as any[])?.filter((rental: RentalWithDetails) => {
    const dueDate = new Date(rental.endDate);
    const now = new Date();
    const diffInDays = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return diffInDays <= 1 && rental.borrowerId;
  }) || [];

  const handleBorrowBook = (book: BookWithOwner) => {
    setSelectedBook(book);
    setShowBorrowModal(true);
  };

  const handleViewBookDetails = (book: BookWithOwner) => {
    setSelectedBook(book);
    setShowDetailsModal(true);
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
          <Button onClick={() => navigate("/societies")}>
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
          <Button 
            variant="ghost" 
            size="sm" 
            className="text-white opacity-90"
            onClick={() => navigate("/societies")}
          >
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
      <div className="p-4 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => navigate('/browse')}>
            <CardContent className="pt-6 text-center">
              <div className="text-2xl font-bold text-primary">
                {Array.isArray(recentBooks) ? recentBooks.filter((book: any) => book.isAvailable).length : 0}
              </div>
              <div className="text-sm text-text-secondary">Available Books</div>
            </CardContent>
          </Card>
          <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => navigate('/earnings')}>
            <CardContent className="pt-6 text-center">
              <div className="flex items-center justify-center space-x-1 mb-1">
                <Coins className="h-5 w-5 text-amber-600" />
                <div className="text-2xl font-bold text-amber-600">
                  {userCredits?.credits?.balance || userCredits?.balance || 0}
                </div>
              </div>
              <div className="text-sm text-text-secondary">Brocks Credits</div>
              {(userBadges as any[])?.length > 0 && (
                <div className="mt-2 flex justify-center space-x-1">
                  {(userBadges as any[]).slice(0, 3).map((badge: any, index: number) => (
                    <Badge key={index} variant="secondary" className="text-xs px-2 py-1">
                      {badge.badgeType}
                    </Badge>
                  ))}
                  {(userBadges as any[]).length > 3 && (
                    <Badge variant="outline" className="text-xs px-2 py-1">
                      +{(userBadges as any[]).length - 3}
                    </Badge>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
        
        {/* Rewards Centre Button */}
        <Card className="cursor-pointer hover:shadow-lg transition-shadow bg-gradient-to-r from-amber-50 to-orange-50 border-amber-200" onClick={() => navigate('/buy-brocks')}>
          <CardContent className="pt-6 text-center">
            <div className="flex items-center justify-center space-x-2 mb-2">
              <Award className="h-6 w-6 text-amber-600" />
              <div className="text-lg font-semibold text-amber-700">Rewards Centre</div>
            </div>
            <div className="text-sm text-amber-600">Buy Brocks, Convert Credits & More</div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Rewards */}
      {recentRewards && recentRewards.length > 0 && (
        <div className="p-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-text-primary">Recent Rewards</h3>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => navigate('/earnings')}
                  className="text-primary"
                >
                  View All <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
              <div className="space-y-3">
                {recentRewards.slice(0, 3).map((reward: any, index: number) => (
                  <div key={index} className="flex items-center space-x-3 p-2 bg-amber-50 rounded-lg">
                    <Gift className="h-4 w-4 text-amber-600" />
                    <div className="flex-1">
                      <div className="text-sm font-medium text-text-primary">{reward.type}</div>
                      <div className="text-xs text-text-secondary">{reward.description}</div>
                    </div>
                    <div className="flex items-center space-x-1">
                      <Coins className="h-3 w-3 text-amber-600" />
                      <span className="text-sm font-semibold text-amber-600">+{reward.credits}</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

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
          <Button 
            variant="ghost" 
            size="sm" 
            className="text-primary"
            onClick={() => navigate("/browse")}
          >
            View All
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>

        {Array.isArray(recentBooks) && recentBooks.length > 0 ? (
          <div className="space-y-3">
            {recentBooks.slice(0, 3).map((book: any) => (
              <Card 
                key={book.id} 
                className="p-3 cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => handleViewBookDetails(book)}
              >
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-16 bg-gradient-to-br from-primary/20 to-secondary/20 rounded flex items-center justify-center">
                    {book.coverImageUrl || book.imageUrl ? (
                      <img 
                        src={book.coverImageUrl || book.imageUrl} 
                        alt={book.title}
                        className="w-full h-full object-cover rounded"
                      />
                    ) : (
                      <div className="text-2xl">📚</div>
                    )}
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold text-sm">{book.title}</h4>
                    <p className="text-xs text-text-secondary">by {book.author}</p>
                    <p className="text-xs text-text-secondary">Owner: {book.owner?.name}</p>
                    <span className="text-xs font-semibold text-primary">₹{book.dailyFee}/day</span>
                    {book.isAvailable ? (
                      <Badge variant="default" className="text-xs ml-2">Available</Badge>
                    ) : (
                      <Badge variant="secondary" className="text-xs ml-2">Borrowed</Badge>
                    )}
                  </div>
                </div>
              </Card>
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
      {(userStats as any)?.totalEarnings && (userStats as any).totalEarnings > 0 && (
        <div className="p-4">
          <Card className="gradient-secondary text-white">
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="text-2xl font-bold mb-1">
                  {formatCurrency((userStats as any).totalEarnings)}
                </div>
                <div className="text-sm opacity-90">Total Earnings</div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Brocks Credits Leaderboard */}
      {brocksLeaderboard && (brocksLeaderboard as any[]).length > 0 && (
        <div className="p-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-text-primary flex items-center space-x-2">
                  <Coins className="h-5 w-5 text-amber-600" />
                  <span>Brocks Leaderboard</span>
                </h3>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => navigate('/profile')}
                  className="text-primary"
                >
                  View Full <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
              <div className="space-y-2">
                {(brocksLeaderboard as any[]).slice(0, 5).map((entry: any, index: number) => (
                  <div
                    key={entry.userId}
                    className={`flex items-center justify-between p-3 rounded-lg ${
                      index < 3 
                        ? 'bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200' 
                        : 'bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <div className={`flex items-center justify-center w-8 h-8 rounded-full text-white font-bold text-sm ${
                        index === 0 ? 'bg-gradient-to-br from-yellow-400 to-yellow-600' :
                        index === 1 ? 'bg-gradient-to-br from-gray-400 to-gray-600' :
                        index === 2 ? 'bg-gradient-to-br from-orange-400 to-orange-600' :
                        'bg-gray-400'
                      }`}>
                        {entry.rank <= 3 ? (
                          index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉'
                        ) : (
                          entry.rank
                        )}
                      </div>
                      <div>
                        <div className="font-medium text-sm text-text-primary">{entry.name}</div>
                        <div className="text-xs text-text-secondary">Rank #{entry.rank}</div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-1">
                      <Coins className="h-4 w-4 text-amber-600" />
                      <span className="text-sm font-semibold text-amber-600">{entry.credits}</span>
                    </div>
                  </div>
                ))}
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

      <BookDetailsModal
        isOpen={showDetailsModal}
        onClose={() => {
          setShowDetailsModal(false);
          setSelectedBook(null);
        }}
        book={selectedBook}
        user={{ id: 1 }} // TODO: Get actual user data
        onEdit={() => {
          // TODO: Handle edit functionality
        }}
      />
    </div>
  );
}

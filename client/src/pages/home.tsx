import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation, Link } from "wouter";
import { Building2, ChevronRight, Clock, Coins, Gift, Award, Plus, HelpCircle, BookPlus, MessageCircle, Camera, X, AlertCircle, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import BookCard from "@/components/book-card";
import BorrowBookModal from "@/components/modals/borrow-book-modal";
import BookDetailsModal from "@/components/book-details-modal";
import AddBookModal from "@/components/modals/add-book-modal";
import { BulkBookUpload } from "@/components/bulk-book-upload";
import EnhancedLeaderboard from "@/components/brocks/enhanced-leaderboard";
import FeedbackButton from "@/components/feedback-button";
import RecommendedBooks from "@/components/social/recommended-books";
import QuickShareWidget from "@/components/social/quick-share-widget";
import { formatCurrency, formatDateRelative } from "@/lib/utils";
import type { BookWithOwner, RentalWithDetails } from "@shared/schema";

const profileCompletionSchema = z.object({
  flatWing: z.string().min(1, "Flat and Wing Number is required"),
  buildingName: z.string().min(1, "Building Name is required"),
  detailedAddress: z.string().min(5, "Detailed Address must be at least 5 characters"),
  city: z.string().min(1, "City is required"),
});

type ProfileCompletionData = z.infer<typeof profileCompletionSchema>;

export default function Home() {
  const [location, navigate] = useLocation();
  const [selectedBook, setSelectedBook] = useState<BookWithOwner | null>(null);
  const [showBorrowModal, setShowBorrowModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showAddBookModal, setShowAddBookModal] = useState(false);
  const [showBulkUploadModal, setShowBulkUploadModal] = useState(false);
  const [showProfileCompletion, setShowProfileCompletion] = useState(true);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  


  const { data: societies } = useQuery({
    queryKey: ["/api/societies/my"],
  });

  // Get current user to check if profile completion is needed
  const { data: currentUser } = useQuery({
    queryKey: ["/api/auth/me"],
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

  // Profile completion form
  const profileForm = useForm<ProfileCompletionData>({
    resolver: zodResolver(profileCompletionSchema),
    defaultValues: {
      flatWing: "",
      buildingName: "",
      detailedAddress: "",
      city: "",
    },
  });

  // Check if user needs profile completion (Google OAuth user missing address)
  const needsProfileCompletion = currentUser && 
    (!(currentUser as any).flatWing || !(currentUser as any).buildingName || !(currentUser as any).detailedAddress || !(currentUser as any).city) &&
    showProfileCompletion;

  // Profile completion mutation
  const profileCompletionMutation = useMutation({
    mutationFn: async (data: ProfileCompletionData) => {
      const response = await apiRequest("PATCH", "/api/auth/profile", data);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Profile Updated",
        description: "Your address information has been updated successfully!",
      });
      setShowProfileCompletion(false);
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update profile",
        variant: "destructive",
      });
    },
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
            <p 
              className="text-sm opacity-90 cursor-pointer hover:opacity-100 transition-opacity" 
              onClick={() => navigate(`/societies/${(currentSociety as any)?.id}/chat`)}
              data-testid="current-society-members-count"
            >
              {(currentSociety as any)?.memberCount || 0} members
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
          <Card className="cursor-pointer hover:shadow-lg transition-shadow bg-gradient-to-r from-green-50 to-emerald-50 border-green-200" onClick={() => navigate('/how-it-works')}>
            <CardContent className="pt-4 pb-4 text-center">
              <div className="flex flex-col items-center space-y-1">
                <HelpCircle className="h-6 w-6 text-green-600" />
                <div className="text-sm font-semibold text-green-700">How It Works</div>
                <div className="text-xs text-green-600">Learn Platform</div>
              </div>
            </CardContent>
          </Card>
        </div>
        
        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <Card className="cursor-pointer hover:shadow-lg transition-shadow bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200" onClick={() => setShowAddBookModal(true)}>
            <CardContent className="pt-4 pb-4 text-center">
              <div className="flex flex-col items-center space-y-1">
                <BookPlus className="h-6 w-6 text-blue-600" />
                <div className="text-sm font-semibold text-blue-700">Add Book</div>
                <div className="text-xs text-blue-600">Manual Entry</div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="cursor-pointer hover:shadow-lg transition-shadow bg-gradient-to-r from-purple-50 to-violet-50 border-purple-200" onClick={() => setShowBulkUploadModal(true)}>
            <CardContent className="pt-4 pb-4 text-center">
              <div className="flex flex-col items-center space-y-1">
                <Camera className="h-6 w-6 text-purple-600" />
                <div className="flex items-center space-x-1">
                  <div className="text-sm font-semibold text-purple-700">Bulk Upload (Experimental)</div>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-4 w-4 p-0 text-purple-600 hover:text-purple-800"
                          onClick={(e) => {
                            e.stopPropagation();
                          }}
                          data-testid="bulk-upload-info"
                        >
                          <Info className="h-3 w-3" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="bottom" className="max-w-xs">
                        <div className="space-y-2 text-sm">
                          <p className="font-semibold">How to take the perfect bookshelf photo:</p>
                          <ul className="list-disc list-inside space-y-1 text-xs">
                            <li>Position camera straight on to bookshelf</li>
                            <li>Ensure book spines are clearly visible</li>
                            <li>Use good lighting (avoid shadows)</li>
                            <li>Keep camera steady to avoid blur</li>
                            <li>Fill frame with books, avoid empty space</li>
                            <li>Take photo from 2-3 feet away</li>
                          </ul>
                          <p className="text-xs text-muted-foreground mt-2">
                            💡 Tip: Portrait mode works better than landscape
                          </p>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <div className="text-xs text-purple-600">Photo Recognition</div>
              </div>
            </CardContent>
          </Card>
        </div>
        
        <div className="grid grid-cols-2 gap-3">
          <Card className="cursor-pointer hover:shadow-lg transition-shadow bg-gradient-to-r from-amber-50 to-orange-50 border-amber-200" onClick={() => navigate('/buy-brocks')}>
            <CardContent className="pt-4 pb-4 text-center">
              <div className="flex flex-col items-center space-y-1">
                <Award className="h-6 w-6 text-amber-600" />
                <div className="text-sm font-semibold text-amber-700">Buy Brocks</div>
                <div className="text-xs text-amber-600">Purchase Credits</div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="cursor-pointer hover:shadow-lg transition-shadow bg-gradient-to-r from-emerald-50 to-teal-50 border-emerald-200" onClick={() => navigate(`/societies/${(currentSociety as any)?.id}/chat`)}>
            <CardContent className="pt-4 pb-4 text-center">
              <div className="flex flex-col items-center space-y-1">
                <MessageCircle className="h-6 w-6 text-emerald-600" />
                <div className="text-sm font-semibold text-emerald-700">Society Chat</div>
                <div className="text-xs text-emerald-600">Connect & Message</div>
              </div>
            </CardContent>
          </Card>
        </div>
        
        {/* Profile Completion Notification */}
        {needsProfileCompletion && (
          <Card className="mt-4 border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50">
            <CardContent className="pt-4">
              <div className="flex items-start space-x-3">
                <AlertCircle className="h-5 w-5 text-amber-600 mt-1 flex-shrink-0" />
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-amber-800">Complete Your Profile</h3>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowProfileCompletion(false)}
                      className="text-amber-600 hover:text-amber-800 p-1"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="text-sm text-amber-700 mb-4">
                    Please update your personal information here to make sure that you can borrow books seamlessly!
                  </p>
                  
                  <form onSubmit={profileForm.handleSubmit((data) => profileCompletionMutation.mutate(data))} className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label htmlFor="flatWing" className="text-xs font-medium text-amber-800">Flat and Wing Number</Label>
                        <Input
                          id="flatWing"
                          placeholder="e.g., A-301"
                          {...profileForm.register("flatWing")}
                          className="mt-1 border-amber-200 focus:border-amber-400"
                        />
                        {profileForm.formState.errors.flatWing && (
                          <p className="text-xs text-red-600 mt-1">
                            {profileForm.formState.errors.flatWing.message}
                          </p>
                        )}
                      </div>
                      
                      <div>
                        <Label htmlFor="buildingName" className="text-xs font-medium text-amber-800">Building Name</Label>
                        <Input
                          id="buildingName"
                          placeholder="e.g., Crystal Tower"
                          {...profileForm.register("buildingName")}
                          className="mt-1 border-amber-200 focus:border-amber-400"
                        />
                        {profileForm.formState.errors.buildingName && (
                          <p className="text-xs text-red-600 mt-1">
                            {profileForm.formState.errors.buildingName.message}
                          </p>
                        )}
                      </div>
                    </div>
                    
                    <div>
                      <Label htmlFor="detailedAddress" className="text-xs font-medium text-amber-800">Detailed Address</Label>
                      <Input
                        id="detailedAddress"
                        placeholder="e.g., Behind Metro Station, Near Park"
                        {...profileForm.register("detailedAddress")}
                        className="mt-1 border-amber-200 focus:border-amber-400"
                      />
                      {profileForm.formState.errors.detailedAddress && (
                        <p className="text-xs text-red-600 mt-1">
                          {profileForm.formState.errors.detailedAddress.message}
                        </p>
                      )}
                    </div>
                    
                    <div>
                      <Label htmlFor="city" className="text-xs font-medium text-amber-800">City</Label>
                      <Input
                        id="city"
                        placeholder="e.g., Mumbai"
                        {...profileForm.register("city")}
                        className="mt-1 border-amber-200 focus:border-amber-400"
                      />
                      {profileForm.formState.errors.city && (
                        <p className="text-xs text-red-600 mt-1">
                          {profileForm.formState.errors.city.message}
                        </p>
                      )}
                    </div>
                    
                    <Button 
                      type="submit" 
                      className="w-full bg-amber-600 hover:bg-amber-700 text-white"
                      disabled={profileCompletionMutation.isPending}
                    >
                      {profileCompletionMutation.isPending ? "Updating..." : "Update Profile"}
                    </Button>
                  </form>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
        
        {/* Brocks Credits Button */}
        <Card className="cursor-pointer hover:shadow-lg transition-shadow mt-4" onClick={() => navigate('/earnings')}>
          <CardContent className="pt-6 text-center">
            <div className="flex items-center justify-center space-x-1 mb-1">
              <Coins className="h-5 w-5 text-amber-600" />
              <div className="text-2xl font-bold text-amber-600">
                {(userCredits as any)?.balance || 0}
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

      {/* Recent Rewards */}
      {recentRewards && (recentRewards as any[])?.length > 0 && (
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
                {(recentRewards as any[])?.slice(0, 3).map((reward: any, index: number) => (
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

      {/* Climb the Leaderboard Section */}
      {brocksLeaderboard && (brocksLeaderboard as any[])?.length > 0 && (
        <div className="p-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-text-primary flex items-center space-x-2">
                  <Award className="w-5 h-5 text-amber-500" />
                  <span>Climb the Leaderboard</span>
                </h3>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => navigate('/leaderboard')}
                  className="text-primary"
                  data-testid="leaderboard-view-all"
                >
                  View Full <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
              <EnhancedLeaderboard leaderboard={(brocksLeaderboard as any[])?.slice(0, 5) || []} />
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

      {/* What You May Like - Recommended Books */}
      <div className="p-4">
        <RecommendedBooks />
      </div>

      {/* Quick Share Widget */}
      <div className="p-4">
        <QuickShareWidget />
      </div>

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


      <BorrowBookModal
        book={selectedBook}
        open={showBorrowModal}
        onOpenChange={setShowBorrowModal}
      />

      <BookDetailsModal
        open={showDetailsModal}
        onOpenChange={(open) => {
          setShowDetailsModal(open);
          if (!open) setSelectedBook(null);
        }}
        book={selectedBook}
        user={{ id: 1 }} // TODO: Get actual user data
        onEdit={() => {
          // TODO: Handle edit functionality
        }}
      />

      <AddBookModal
        open={showAddBookModal}
        onOpenChange={setShowAddBookModal}
      />

      {/* Chat Section */}
      <div className="p-4">
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-4 mb-4">
          <div className="text-center mb-4">
            <MessageCircle className="h-12 w-12 mx-auto text-blue-600 mb-3" />
            <h3 className="text-lg font-semibold text-text-primary mb-2">Connect with Your Community</h3>
            <p className="text-sm text-text-secondary">Chat with fellow book lovers in your society</p>
          </div>
          <Link href="/chat" className="block">
            <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white">
              <MessageCircle className="w-4 h-4 mr-2" />
              Start Chatting
            </Button>
          </Link>
        </div>
      </div>

      {/* Feedback Section */}
      <div className="p-4">
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="text-center mb-4">
            <h3 className="text-lg font-semibold text-text-primary mb-2">Help Us Improve</h3>
            <p className="text-sm text-text-secondary">Your feedback helps make BorrowBooks better for everyone</p>
          </div>
          <FeedbackButton variant="inline" />
        </div>
      </div>

      {/* Bulk Upload Modal */}
      {showBulkUploadModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 overflow-auto">
          <div className="w-full max-w-4xl max-h-[90vh] overflow-auto bg-white rounded-lg shadow-xl">
            <BulkBookUpload
              onClose={() => setShowBulkUploadModal(false)}
              onBooksAdded={() => {
                setShowBulkUploadModal(false);
                // Refresh data after bulk upload
                window.location.reload();
              }}
            />
          </div>
        </div>
      )}


    </div>
  );
}

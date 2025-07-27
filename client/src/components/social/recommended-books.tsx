import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BookOpen, Star, Heart, Settings } from "lucide-react";
import { motion } from "framer-motion";
import { useState } from "react";
import BookCard from "@/components/book-card";
import GenrePreferencesModal from "./genre-preferences-modal";
import WishlistButton from "./wishlist-button";

interface Book {
  id: number;
  title: string;
  author: string;
  genre: string;
  dailyFee: string;
  isAvailable: boolean;
  coverUrl?: string;
}

export default function RecommendedBooks() {
  const [showPreferences, setShowPreferences] = useState(false);

  // Check if user has genre preferences
  const { data: preferences = [] } = useQuery({
    queryKey: ["/api/user/genre-preferences"],
    queryFn: async () => {
      const response = await fetch("/api/user/genre-preferences");
      if (!response.ok) return [];
      return response.json();
    },
  });

  // Get recommended books
  const { data: recommendedBooks = [], isLoading } = useQuery({
    queryKey: ["/api/books/recommended"],
    queryFn: async () => {
      const response = await fetch("/api/books/recommended");
      if (!response.ok) return [];
      return response.json();
    },
    enabled: preferences.length > 0, // Only fetch if user has preferences
  });

  // Show preference setup for new users
  if (preferences.length === 0) {
    return (
      <>
        <Card className="bg-gradient-to-br from-purple-50 to-blue-50 border-purple-200">
          <CardHeader className="text-center pb-4">
            <motion.div
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", bounce: 0.5 }}
            >
              <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-blue-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <BookOpen className="w-8 h-8 text-white" />
              </div>
            </motion.div>
            <CardTitle className="text-xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
              🎯 Discover Books You'll Love
            </CardTitle>
            <p className="text-gray-600 text-sm mt-2">
              Tell us your reading preferences to get personalized book recommendations
            </p>
          </CardHeader>
          <CardContent className="text-center">
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Button
                onClick={() => setShowPreferences(true)}
                className="bg-gradient-to-r from-purple-500 to-blue-600 hover:from-purple-600 hover:to-blue-700 text-white"
                size="lg"
              >
                <Star className="w-4 h-4 mr-2" />
                Set Your Preferences
              </Button>
            </motion.div>
          </CardContent>
        </Card>

        <GenrePreferencesModal
          isOpen={showPreferences}
          onClose={() => setShowPreferences(false)}
          isFirstTime={true}
        />
      </>
    );
  }

  return (
    <>
      <Card className="bg-gradient-to-br from-blue-50 to-purple-50 border-blue-200">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-xl font-bold text-blue-900 flex items-center">
              <Heart className="w-5 h-5 mr-2 text-red-500" />
              What You May Like
            </CardTitle>
            <p className="text-gray-600 text-sm mt-1">
              Based on your reading preferences
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowPreferences(true)}
            className="border-blue-300 text-blue-700 hover:bg-blue-50"
          >
            <Settings className="w-4 h-4 mr-1" />
            Update
          </Button>
        </CardHeader>

        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full"
              />
            </div>
          ) : recommendedBooks.length === 0 ? (
            <div className="text-center py-8">
              <BookOpen className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">
                No books match your preferences yet. Check back later for new additions!
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Show user's preferred genres */}
              <div className="flex flex-wrap gap-2 mb-4">
                {preferences
                  .filter((p: any) => p.preferenceLevel >= 3)
                  .map((preference: any) => (
                    <Badge
                      key={preference.genre}
                      variant="secondary"
                      className={`${
                        preference.preferenceLevel === 5
                          ? "bg-red-100 text-red-700 border-red-300"
                          : "bg-blue-100 text-blue-700 border-blue-300"
                      }`}
                    >
                      {preference.preferenceLevel === 5 ? "❤️" : "👍"} {preference.genre}
                    </Badge>
                  ))}
              </div>

              {/* Recommended books grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {recommendedBooks.slice(0, 6).map((book: Book, index: number) => (
                  <motion.div
                    key={book.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                  >
                    <Card className="hover:shadow-lg transition-shadow duration-200">
                      <CardContent className="p-4">
                        <div className="flex items-start space-x-3">
                          <div className="w-12 h-16 bg-gradient-to-br from-blue-400 to-purple-500 rounded flex items-center justify-center flex-shrink-0">
                            <BookOpen className="w-6 h-6 text-white" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-medium text-sm truncate">{book.title}</h3>
                            <p className="text-xs text-gray-600 truncate">{book.author}</p>
                            <Badge variant="outline" className="text-xs mt-1">
                              {book.genre}
                            </Badge>
                            <div className="flex items-center justify-between mt-2">
                              <span className="text-sm font-semibold text-green-600">
                                ₹{book.dailyFee}/day
                              </span>
                              <WishlistButton
                                bookId={book.id}
                                size="sm"
                                showText={false}
                                className="h-6 w-6 p-0"
                              />
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </div>

              {/* Show more button */}
              {recommendedBooks.length > 6 && (
                <div className="text-center pt-4">
                  <Button variant="outline" className="border-blue-300 text-blue-700 hover:bg-blue-50">
                    View More Recommendations
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <GenrePreferencesModal
        isOpen={showPreferences}
        onClose={() => setShowPreferences(false)}
        isFirstTime={false}
      />
    </>
  );
}
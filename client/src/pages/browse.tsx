import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, Filter } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import BookCard from "@/components/book-card";
import BorrowBookModal from "@/components/modals/borrow-book-modal";
import { debounce } from "@/lib/utils";
import type { BookWithOwner } from "@shared/schema";

const genres = ["All", "Fiction", "Non-Fiction", "Academic", "Biography", "Self-Help", "Mystery", "Romance", "Science Fiction"];

export default function Browse() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedGenre, setSelectedGenre] = useState("All");
  const [selectedBook, setSelectedBook] = useState<BookWithOwner | null>(null);
  const [showBorrowModal, setShowBorrowModal] = useState(false);
  const [selectedSociety, setSelectedSociety] = useState<any>(null);

  const { data: societies } = useQuery({
    queryKey: ["/api/societies/my"],
  });

  const currentSociety = selectedSociety || (societies as any[])?.[0];
  
  // Set default society to "All" when societies load
  useEffect(() => {
    if ((societies as any[]) && (societies as any[]).length > 0 && !selectedSociety) {
      setSelectedSociety({ id: 0, name: "All Societies" });
    }
  }, [societies, selectedSociety]);

  const { data: books = [], isLoading } = useQuery({
    queryKey: ["/api/books", currentSociety?.id || "all"],
    queryFn: async () => {
      if (currentSociety?.id === 0) {
        // Fetch all books from all societies
        return await fetch('/api/books/all').then(res => res.json());
      } else if (currentSociety?.id) {
        // Fetch books from specific society
        return await fetch(`/api/books/society/${currentSociety.id}`).then(res => res.json());
      }
      return [];
    },
    enabled: !!currentSociety,
  });

  const debouncedSearch = debounce((value: string) => {
    setSearchQuery(value);
  }, 300);

  const handleBorrowBook = (book: BookWithOwner) => {
    setSelectedBook(book);
    setShowBorrowModal(true);
  };

  if (!currentSociety) {
    return (
      <div className="p-4 text-center">
        <h2 className="text-xl font-semibold text-text-primary mb-2">
          No Society Selected
        </h2>
        <p className="text-text-secondary">
          Please join a society to browse books.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search Header */}
      <div className="p-4 bg-surface">
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-text-secondary" />
          <Input
            className="pl-10"
            placeholder="Search books, authors, genres..."
            onChange={(e) => debouncedSearch(e.target.value)}
          />
        </div>

        {/* Genre Filter */}
        <div className="flex space-x-2 overflow-x-auto pb-2">
          {genres.map((genre) => (
            <Button
              key={genre}
              variant={selectedGenre === genre ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedGenre(genre)}
              className="flex-shrink-0"
            >
              {genre}
            </Button>
          ))}
        </div>
      </div>

      {/* Books Grid */}
      <div className="p-4">
        {isLoading ? (
          <div className="grid grid-cols-2 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <Card key={i} className="animate-pulse">
                <CardContent className="p-3">
                  <div className="w-full h-32 bg-gray-200 rounded-lg mb-3"></div>
                  <div className="h-4 bg-gray-200 rounded mb-2"></div>
                  <div className="h-3 bg-gray-200 rounded mb-2"></div>
                  <div className="h-8 bg-gray-200 rounded"></div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : books && books.length > 0 ? (
          <div className="grid grid-cols-2 gap-4">
            {books.map((book: BookWithOwner) => (
              <BookCard
                key={book.id}
                book={book}
                onBorrow={handleBorrowBook}
                variant="grid"
                showOwner={true}
              />
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="pt-6 text-center">
              <Search className="h-12 w-12 text-text-secondary mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-text-primary mb-2">
                No Books Found
              </h3>
              <p className="text-text-secondary">
                {searchQuery || selectedGenre !== "All"
                  ? "Try adjusting your search or filters"
                  : "No books have been added to this society yet"}
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      <BorrowBookModal
        book={selectedBook}
        open={showBorrowModal}
        onOpenChange={setShowBorrowModal}
      />
    </div>
  );
}

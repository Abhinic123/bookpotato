import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { Search, Filter, BookOpen, User, Calendar, DollarSign } from "lucide-react";
import BookCard from "@/components/book-card";
import { formatCurrency } from "@/lib/utils";

export default function EnhancedBrowse() {
  const [searchTerm, setSearchTerm] = useState("");
  const [authorSearch, setAuthorSearch] = useState("");
  const [selectedGenre, setSelectedGenre] = useState<string>("");
  const [selectedSociety, setSelectedSociety] = useState<string>("0");
  const [sortBy, setSortBy] = useState<string>("newest");

  // Get user's societies
  const { data: userSocieties = [] } = useQuery({
    queryKey: ["/api/societies/my"],
  });

  // Get all available books
  const { data: allBooks = [], isLoading } = useQuery({
    queryKey: ["/api/books/all"],
  });

  // Filter and sort books
  const filteredBooks = allBooks.filter((book: any) => {
    const matchesTitle = book.title.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesAuthor = book.author.toLowerCase().includes(authorSearch.toLowerCase());
    const matchesGenre = !selectedGenre || selectedGenre === "all" || book.genre === selectedGenre;
    const matchesSociety = selectedSociety === "0" || book.societyId.toString() === selectedSociety;

    return matchesTitle && matchesAuthor && matchesGenre && matchesSociety;
  }).sort((a: any, b: any) => {
    switch (sortBy) {
      case "newest":
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      case "oldest":
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      case "price-low":
        return parseFloat(a.dailyFee) - parseFloat(b.dailyFee);
      case "price-high":
        return parseFloat(b.dailyFee) - parseFloat(a.dailyFee);
      case "title":
        return a.title.localeCompare(b.title);
      case "author":
        return a.author.localeCompare(b.author);
      default:
        return 0;
    }
  });

  // Get unique genres for filter
  const genres = [...new Set(allBooks.map((book: any) => book.genre))];

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center space-x-3 mb-6">
        <BookOpen className="w-8 h-8 text-blue-600" />
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Browse Books</h1>
          <p className="text-gray-600">Discover amazing books in your community</p>
        </div>
      </div>

      {/* Advanced Search and Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Filter className="w-5 h-5" />
            <span>Search & Filters</span>
          </CardTitle>
          <CardDescription>
            Find books by title, author, genre, or society
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Title Search */}
            <div>
              <label className="text-sm font-medium mb-2 block">Search by Title</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  placeholder="Enter book title..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {/* Author Search */}
            <div>
              <label className="text-sm font-medium mb-2 block">Search by Author</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  placeholder="Enter author name..."
                  value={authorSearch}
                  onChange={(e) => setAuthorSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {/* Genre Filter */}
            <div>
              <label className="text-sm font-medium mb-2 block">Genre</label>
              <Select value={selectedGenre} onValueChange={setSelectedGenre}>
                <SelectTrigger>
                  <SelectValue placeholder="All genres" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Genres</SelectItem>
                  {genres.map((genre: string) => (
                    <SelectItem key={genre} value={genre}>
                      {genre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Society Filter */}
            <div>
              <label className="text-sm font-medium mb-2 block">Society</label>
              <Select value={selectedSociety} onValueChange={setSelectedSociety}>
                <SelectTrigger>
                  <SelectValue placeholder="All societies" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">All Societies</SelectItem>
                  {userSocieties.map((society: any) => (
                    <SelectItem key={society.id} value={society.id.toString()}>
                      {society.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Sort Options */}
            <div>
              <label className="text-sm font-medium mb-2 block">Sort By</label>
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger>
                  <SelectValue placeholder="Sort by..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="newest">Newest First</SelectItem>
                  <SelectItem value="oldest">Oldest First</SelectItem>
                  <SelectItem value="price-low">Price: Low to High</SelectItem>
                  <SelectItem value="price-high">Price: High to Low</SelectItem>
                  <SelectItem value="title">Title A-Z</SelectItem>
                  <SelectItem value="author">Author A-Z</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Clear Filters */}
            <div className="flex items-end">
              <Button
                variant="outline"
                onClick={() => {
                  setSearchTerm("");
                  setAuthorSearch("");
                  setSelectedGenre("all");
                  setSelectedSociety("0");
                  setSortBy("newest");
                }}
                className="w-full"
              >
                Clear All Filters
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Results Summary */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <h2 className="text-xl font-semibold">
            {filteredBooks.length} books found
          </h2>
          {(searchTerm || authorSearch || selectedGenre || selectedSociety !== "0") && (
            <Badge variant="secondary">
              Filtered
            </Badge>
          )}
        </div>
      </div>

      {/* Books Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="animate-pulse">
              <div className="bg-gray-200 h-64 rounded-lg"></div>
              <div className="mt-4 space-y-2">
                <div className="bg-gray-200 h-4 rounded"></div>
                <div className="bg-gray-200 h-4 rounded w-3/4"></div>
              </div>
            </div>
          ))}
        </div>
      ) : filteredBooks.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredBooks.map((book: any) => (
            <BookCard
              key={book.id}
              book={book}
              showOwner={true}
              variant="grid"
            />
          ))}
        </div>
      ) : (
        <Card className="text-center py-16">
          <CardContent>
            <BookOpen className="w-16 h-16 mx-auto mb-4 text-gray-300" />
            <h3 className="text-xl font-semibold text-gray-600 mb-2">
              No books found
            </h3>
            <p className="text-gray-500 mb-6">
              Try adjusting your search criteria or clear all filters
            </p>
            <Button
              variant="outline"
              onClick={() => {
                setSearchTerm("");
                setAuthorSearch("");
                setSelectedGenre("all");
                setSelectedSociety("0");
              }}
            >
              Clear Filters
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
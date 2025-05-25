import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Camera, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

const genres = [
  "Fiction",
  "Non-Fiction",
  "Academic",
  "Biography",
  "Self-Help",
  "Mystery",
  "Romance",
  "Science Fiction",
  "Fantasy",
  "History",
  "Business",
  "Health",
];

const conditions = [
  "Excellent",
  "Very Good", 
  "Good",
  "Fair",
  "Poor",
];

const bookSchema = z.object({
  title: z.string().min(1, "Title is required"),
  author: z.string().min(1, "Author is required"),
  isbn: z.string().optional(),
  genre: z.string().min(1, "Genre is required"),
  description: z.string().optional(),
  condition: z.string().min(1, "Condition is required"),
  dailyFee: z.string().min(1, "Daily fee is required").refine(
    (val) => !isNaN(Number(val)) && Number(val) > 0,
    "Daily fee must be a positive number"
  ),
  societyId: z.number().min(1, "Society is required"),
});

type BookFormData = z.infer<typeof bookSchema>;

interface AddBookModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function AddBookModal({ open, onOpenChange }: AddBookModalProps) {
  const [scanMode, setScanMode] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: societies } = useQuery({
    queryKey: ["/api/societies/my"],
  });

  const form = useForm<BookFormData>({
    resolver: zodResolver(bookSchema),
    defaultValues: {
      title: "",
      author: "",
      isbn: "",
      genre: "",
      description: "",
      condition: "",
      dailyFee: "",
      societyId: societies?.[0]?.id || 0,
    },
  });

  const addBookMutation = useMutation({
    mutationFn: async (data: BookFormData) => {
      const response = await apiRequest("POST", "/api/books", {
        ...data,
        dailyFee: Number(data.dailyFee),
      });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Book added to your library successfully!",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/books"] });
      queryClient.invalidateQueries({ queryKey: ["/api/societies"] });
      form.reset();
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to add book",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: BookFormData) => {
    addBookMutation.mutate(data);
  };

  const handleBarcodeScanned = async (barcode: string) => {
    setIsScannerOpen(false);
    
    try {
      // Try to fetch book details from Open Library API using ISBN
      const response = await fetch(`https://openlibrary.org/api/books?bibkeys=ISBN:${barcode}&format=json&jscmd=data`);
      const data = await response.json();
      
      const bookData = data[`ISBN:${barcode}`];
      if (bookData) {
        form.setValue("isbn", barcode);
        form.setValue("title", bookData.title || "");
        form.setValue("author", bookData.authors?.[0]?.name || "");
        form.setValue("genre", bookData.subjects?.[0]?.name || "");
        
        toast({
          title: "Book Details Found!",
          description: "Book information has been automatically filled",
        });
      } else {
        // Just set the ISBN if no data found
        form.setValue("isbn", barcode);
        toast({
          title: "Barcode Scanned",
          description: "Please fill in the book details manually",
        });
      }
    } catch (error) {
      form.setValue("isbn", barcode);
      toast({
        title: "Barcode Scanned",
        description: "Please fill in the book details manually",
      });
    }
  };

  const handleBarcodeScan = () => {
    // Simulate barcode scanning - in a real app this would integrate with camera
    toast({
      title: "Barcode Scanning",
      description: "This feature would integrate with the device camera to scan book barcodes and auto-fill information.",
    });
    setScanMode(false);
  };

  if (!societies?.length) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Add Book</DialogTitle>
          </DialogHeader>
          <div className="text-center py-8">
            <p className="text-text-secondary mb-4">
              You need to join a society before adding books.
            </p>
            <Button onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle>Add Book to Library</DialogTitle>
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => onOpenChange(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>

        {scanMode ? (
          <div className="space-y-6">
            <div className="bg-surface rounded-xl p-6 text-center">
              <Camera className="h-12 w-12 text-primary mx-auto mb-4" />
              <h3 className="font-semibold text-text-primary mb-2">
                Scan Book Barcode
              </h3>
              <p className="text-sm text-text-secondary mb-4">
                Position the barcode within the frame
              </p>
              <Button onClick={handleBarcodeScan} className="mb-2">
                Start Scanning
              </Button>
              <br />
              <Button 
                variant="outline" 
                onClick={() => setScanMode(false)}
                size="sm"
              >
                Manual Entry Instead
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="text-center">
              <Button 
                variant="outline" 
                onClick={() => setScanMode(true)}
                className="mb-4"
              >
                <Camera className="h-4 w-4 mr-2" />
                Scan Barcode
              </Button>
              <p className="text-sm text-text-secondary">or fill manually</p>
            </div>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="societyId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Society</FormLabel>
                      <Select 
                        onValueChange={(value) => field.onChange(Number(value))}
                        defaultValue={field.value?.toString()}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select society" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {societies?.map((society: any) => (
                            <SelectItem key={society.id} value={society.id.toString()}>
                              {society.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Book Title</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter book title" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="author"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Author</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter author name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="genre"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Genre</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select genre" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {genres.map((genre) => (
                            <SelectItem key={genre} value={genre}>
                              {genre}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="condition"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Condition</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select condition" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {conditions.map((condition) => (
                            <SelectItem key={condition} value={condition}>
                              {condition}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="dailyFee"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Daily Rental Fee (₹)</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          placeholder="0" 
                          min="1"
                          step="0.01"
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="isbn"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>ISBN (Optional)</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter ISBN" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description (Optional)</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Brief description of the book"
                          className="resize-none"
                          rows={3}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button 
                  type="submit" 
                  className="w-full"
                  disabled={addBookMutation.isPending}
                >
                  {addBookMutation.isPending ? "Adding..." : "Add to Library"}
                </Button>
              </form>
            </Form>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

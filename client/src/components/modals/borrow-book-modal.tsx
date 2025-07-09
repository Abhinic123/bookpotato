import { useState } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { X, CreditCard, Smartphone, Gift } from "lucide-react";
import { BrocksOffersModal } from "@/components/brocks/brocks-offers-modal";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { formatCurrency, calculateRentalCost } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import type { BookWithOwner } from "@shared/schema";

const borrowSchema = z.object({
  duration: z.string().min(1, "Please select rental duration"),
  paymentMethod: z.string().min(1, "Please select payment method"),
});

type BorrowFormData = z.infer<typeof borrowSchema>;

interface BorrowBookModalProps {
  book: BookWithOwner | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const durationOptions = [
  { value: "3", label: "3 days", days: 3 },
  { value: "7", label: "1 week", days: 7 },
  { value: "14", label: "2 weeks", days: 14 },
  { value: "30", label: "1 month", days: 30 },
];

export default function BorrowBookModal({ book, open, onOpenChange }: BorrowBookModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showBrocksModal, setShowBrocksModal] = useState(false);
  const [appliedBrocks, setAppliedBrocks] = useState<{
    offerType: 'rupees' | 'commission-free';
    brocksUsed: number;
    discountAmount: number;
  } | null>(null);

  // Fetch user credits
  const { data: userCredits } = useQuery({
    queryKey: ["/api/user/credits"],
  });

  // Fetch platform settings
  const { data: platformSettings } = useQuery({
    queryKey: ["/api/platform/settings"],
    staleTime: 30 * 1000, // Cache for 30 seconds only
    refetchOnWindowFocus: true,
  });

  const form = useForm<BorrowFormData>({
    resolver: zodResolver(borrowSchema),
    defaultValues: {
      duration: "",
      paymentMethod: "card",
    },
  });

  const watchedDuration = form.watch("duration");
  
  const rentalCost = book && watchedDuration 
    ? calculateRentalCost(
        book.dailyFee, 
        parseInt(watchedDuration), 
        platformSettings as { commissionRate: number; securityDeposit: number } | undefined
      )
    : null;

  // Apply Brocks discount if available
  const finalRentalCost = rentalCost && appliedBrocks ? {
    ...rentalCost,
    totalAmount: rentalCost.totalAmount - appliedBrocks.discountAmount
  } : rentalCost;

  const borrowMutation = useMutation({
    mutationFn: async (data: BorrowFormData) => {
      if (!book) throw new Error("No book selected");
      
      const response = await apiRequest("POST", "/api/rentals/borrow", {
        bookId: book.id,
        duration: parseInt(data.duration),
        paymentMethod: data.paymentMethod,
        appliedBrocks: appliedBrocks,
      });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Book borrowed successfully! Payment processed.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/books"] });
      queryClient.invalidateQueries({ queryKey: ["/api/rentals"] });
      form.reset();
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to borrow book",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: BorrowFormData) => {
    borrowMutation.mutate(data);
  };

  if (!book) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle>Borrow Book</DialogTitle>
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => onOpenChange(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>

        <div className="space-y-6">
          {/* Book Details */}
          <div className="flex items-start space-x-4">
            <div className="w-16 h-20 bg-gradient-to-br from-blue-100 to-blue-200 rounded-lg flex items-center justify-center flex-shrink-0">
              <span className="text-xs text-blue-600 font-medium text-center px-1">
                {book.title.substring(0, 4)}
              </span>
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-text-primary">
                {book.title}
              </h3>
              <p className="text-text-secondary">{book.author}</p>
              <p className="text-sm text-text-secondary mt-1">
                Lender: {book.owner.name}
              </p>
              <div className="flex items-center mt-2">
                <span className="text-lg font-semibold text-primary">
                  {formatCurrency(book.dailyFee)}
                </span>
                <span className="text-text-secondary">/day</span>
              </div>
            </div>
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="duration"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Rental Period</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select rental period" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {durationOptions.map((option) => {
                          const cost = calculateRentalCost(
                            book.dailyFee, 
                            option.days,
                            platformSettings as { commissionRate: number; securityDeposit: number } | undefined
                          );
                          return (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label} - {formatCurrency(cost.rentalFee)}
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Cost Breakdown */}
              {rentalCost && (
                <div className="bg-surface rounded-xl p-4">
                  <h4 className="font-medium text-text-primary mb-3">Cost Breakdown</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-text-secondary">
                        Rental fee ({watchedDuration} days)
                      </span>
                      <span>{formatCurrency(rentalCost.rentalFee)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-text-secondary">Platform fee (5%)</span>
                      <span>{formatCurrency(rentalCost.platformFee)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-text-secondary">Security deposit</span>
                      <span>{formatCurrency(rentalCost.securityDeposit)}</span>
                    </div>
                    {appliedBrocks && (
                      <div className="flex justify-between text-green-600">
                        <span>Brocks Discount</span>
                        <span>-{formatCurrency(appliedBrocks.discountAmount)}</span>
                      </div>
                    )}
                    <hr className="my-2" />
                    <div className="flex justify-between font-semibold">
                      <span>Total</span>
                      <span>{formatCurrency(finalRentalCost ? finalRentalCost.totalAmount : rentalCost.totalAmount)}</span>
                    </div>
                    <p className="text-xs text-text-secondary mt-2">
                      *Security deposit will be refunded upon return
                    </p>
                  </div>
                </div>
              )}

              {/* Brocks Offers - Always show this section */}
              {!appliedBrocks && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <Gift className="h-5 w-5 text-amber-600" />
                      <div>
                        <p className="font-medium text-sm">Use Brocks Credits</p>
                        <p className="text-xs text-amber-700">
                          {userCredits?.balance > 0 
                            ? `You have ${userCredits.balance} Brocks • Convert to rupees or get commission-free days`
                            : 'Earn Brocks through book uploads, referrals, and transactions'
                          }
                        </p>
                      </div>
                    </div>
                    <Button 
                      type="button"
                      variant="outline" 
                      size="sm"
                      onClick={() => setShowBrocksModal(true)}
                      className="border-amber-300 text-amber-700 hover:bg-amber-100"
                    >
                      {userCredits?.balance > 0 ? 'View Offers' : 'Learn More'}
                    </Button>
                  </div>
                </div>
              )}

              {/* Applied Brocks Info */}
              {appliedBrocks && (
                <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <Gift className="h-5 w-5 text-green-600" />
                      <div>
                        <p className="font-medium text-sm">Brocks Applied</p>
                        <p className="text-xs text-green-700">
                          {appliedBrocks.offerType === 'rupees' 
                            ? `${appliedBrocks.brocksUsed} Brocks → ${formatCurrency(appliedBrocks.discountAmount)} discount`
                            : `${appliedBrocks.brocksUsed} Brocks → Commission-free days`
                          }
                        </p>
                      </div>
                    </div>
                    <Button 
                      type="button"
                      variant="outline" 
                      size="sm"
                      onClick={() => setAppliedBrocks(null)}
                      className="text-green-700 hover:bg-green-100"
                    >
                      Remove
                    </Button>
                  </div>
                </div>
              )}

              <FormField
                control={form.control}
                name="paymentMethod"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Payment Method</FormLabel>
                    <FormControl>
                      <RadioGroup
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                        className="space-y-2"
                      >
                        <div className="flex items-center space-x-3 p-3 border border-gray-300 rounded-xl">
                          <RadioGroupItem value="card" id="card" />
                          <CreditCard className="h-5 w-5 text-primary" />
                          <Label htmlFor="card" className="flex-1">
                            Credit/Debit Card
                          </Label>
                        </div>
                        <div className="flex items-center space-x-3 p-3 border border-gray-300 rounded-xl">
                          <RadioGroupItem value="upi" id="upi" />
                          <Smartphone className="h-5 w-5 text-primary" />
                          <Label htmlFor="upi" className="flex-1">
                            UPI
                          </Label>
                        </div>
                      </RadioGroup>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button 
                type="submit" 
                className="w-full"
                disabled={borrowMutation.isPending || !rentalCost}
              >
                {borrowMutation.isPending 
                  ? "Processing..." 
                  : `Proceed to Payment ${finalRentalCost ? `- ${formatCurrency(finalRentalCost.totalAmount)}` : ""}`
                }
              </Button>
            </form>
          </Form>
        </div>
      </DialogContent>

      {/* Brocks Offers Modal */}
      <BrocksOffersModal
        isOpen={showBrocksModal}
        onClose={() => setShowBrocksModal(false)}
        currentAmount={rentalCost ? rentalCost.totalAmount : 0}
        onApplyOffer={(offerType, brocksUsed, discountAmount) => {
          setAppliedBrocks({
            offerType,
            brocksUsed,
            discountAmount
          });
          setShowBrocksModal(false);
          toast({
            title: "Brocks Applied!",
            description: `${brocksUsed} Brocks ${offerType === 'rupees' ? `converted to ${formatCurrency(discountAmount)} discount` : 'converted to commission-free days'}`,
          });
        }}
      />
    </Dialog>
  );
}

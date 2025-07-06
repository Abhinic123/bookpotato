import { useState, useEffect } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Calendar, Clock, User, Book, CreditCard, IndianRupee } from "lucide-react";

const extensionRequestSchema = z.object({
  extensionDays: z.number().min(1, "Extension must be at least 1 day").max(30, "Extension cannot exceed 30 days"),
});

type ExtensionRequestForm = z.infer<typeof extensionRequestSchema>;

interface ExtensionRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  rental: any;
}

export default function ExtensionRequestModal({ isOpen, onClose, rental }: ExtensionRequestModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [step, setStep] = useState<'calculate' | 'payment' | 'processing'>('calculate');
  const [costData, setCostData] = useState<any>(null);
  const [paymentData, setPaymentData] = useState<any>(null);

  const form = useForm<ExtensionRequestForm>({
    resolver: zodResolver(extensionRequestSchema),
    defaultValues: {
      extensionDays: 7,
    },
  });

  const extensionDays = form.watch("extensionDays") || 7;

  // Calculate extension cost
  const { data: calculationData, isLoading: isCalculating } = useQuery({
    queryKey: ["/api/rentals/extensions/calculate", rental?.id, extensionDays],
    enabled: isOpen && !!rental && extensionDays > 0,
    queryFn: async () => {
      const response = await apiRequest("POST", "/api/rentals/extensions/calculate", {
        rentalId: rental.id,
        extensionDays,
      });
      return response.json();
    },
  });

  // Create payment intent
  const createPaymentMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/rentals/extensions/create-payment", {
        rentalId: rental.id,
        extensionDays,
        totalAmount: calculationData.totalExtensionFee,
      });
      return response.json();
    },
    onSuccess: (data) => {
      setPaymentData(data);
      setStep('payment');
    },
    onError: (error: any) => {
      toast({
        title: "Payment Setup Failed",
        description: error.message || "Failed to setup payment.",
        variant: "destructive",
      });
    },
  });

  // Process extension after payment
  const processExtensionMutation = useMutation({
    mutationFn: async () => {
      setStep('processing');
      
      // Simulate payment processing delay
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const response = await apiRequest("POST", "/api/rentals/extensions/process", {
        rentalId: rental.id,
        extensionDays,
        paymentId: paymentData.paymentId,
        paymentStatus: 'completed',
      });
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Extension Successful",
        description: `Your book has been extended for ${extensionDays} days. New due date: ${new Date(data.newDueDate).toLocaleDateString()}`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/rentals/borrowed"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      handleClose();
    },
    onError: (error: any) => {
      toast({
        title: "Extension Failed",
        description: error.message || "There was an error processing your extension.",
        variant: "destructive",
      });
      setStep('payment');
    },
  });

  const handleClose = () => {
    onClose();
    form.reset();
    setStep('calculate');
    setCostData(null);
    setPaymentData(null);
  };

  const handlePayment = () => {
    createPaymentMutation.mutate();
  };

  const confirmPayment = () => {
    processExtensionMutation.mutate();
  };

  if (!rental) return null;

  const currentDueDate = new Date(rental.dueDate);
  const proposedDueDate = new Date(currentDueDate);
  proposedDueDate.setDate(currentDueDate.getDate() + extensionDays);

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {step === 'calculate' && <Calendar className="h-5 w-5" />}
            {step === 'payment' && <CreditCard className="h-5 w-5" />}
            {step === 'processing' && <Clock className="h-5 w-5 animate-spin" />}
            {step === 'calculate' && 'Extend Book Rental'}
            {step === 'payment' && 'Payment Confirmation'}
            {step === 'processing' && 'Processing Extension...'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Book Information */}
          <div className="bg-gray-50 p-3 rounded-lg space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Book className="h-4 w-4" />
              Book Details
            </div>
            <p className="text-sm">
              <span className="font-medium">Title:</span> {rental.book?.title}
            </p>
            <p className="text-sm">
              <span className="font-medium">Author:</span> {rental.book?.author}
            </p>
            <p className="text-sm">
              <span className="font-medium">Owner:</span> {rental.lender?.name}
            </p>
            <p className="text-sm">
              <span className="font-medium">Current Due Date:</span>{" "}
              {currentDueDate.toLocaleDateString()}
            </p>
          </div>

          {step === 'calculate' && (
            <>
              <Form {...form}>
                <form className="space-y-4">
                  <FormField
                    control={form.control}
                    name="extensionDays"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Extension Days</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min="1"
                            max="30"
                            placeholder="Number of days"
                            {...field}
                            onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
                          />
                        </FormControl>
                        <FormMessage />
                        {extensionDays > 0 && (
                          <p className="text-xs text-gray-600">
                            New due date: {proposedDueDate.toLocaleDateString()}
                          </p>
                        )}
                      </FormItem>
                    )}
                  />
                </form>
              </Form>

              {/* Cost Breakdown */}
              {calculationData && (
                <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                  <h4 className="flex items-center gap-2 font-medium text-blue-900 mb-3">
                    <IndianRupee className="h-4 w-4" />
                    Extension Cost Breakdown
                  </h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>Extension Fee (₹{calculationData?.extensionFeePerDay || 0}/day × {extensionDays} days):</span>
                      <span className="font-medium">₹{calculationData?.totalExtensionFee?.toFixed(2) || '0.00'}</span>
                    </div>
                    <div className="flex justify-between text-gray-600">
                      <span>Platform Commission ({calculationData?.commissionRate || 0}%):</span>
                      <span>-₹{calculationData?.platformCommission?.toFixed(2) || '0.00'}</span>
                    </div>
                    <div className="flex justify-between text-gray-600">
                      <span>Lender Earnings:</span>
                      <span>₹{calculationData?.lenderEarnings?.toFixed(2) || '0.00'}</span>
                    </div>
                    <hr className="border-blue-200" />
                    <div className="flex justify-between font-semibold text-blue-900">
                      <span>Total Amount:</span>
                      <span>₹{calculationData?.totalExtensionFee?.toFixed(2) || '0.00'}</span>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleClose}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handlePayment}
                  disabled={isCalculating || !calculationData || createPaymentMutation.isPending}
                  className="flex-1"
                >
                  {createPaymentMutation.isPending ? (
                    <>
                      <Clock className="h-4 w-4 mr-2 animate-spin" />
                      Setting up...
                    </>
                  ) : (
                    <>
                      <CreditCard className="h-4 w-4 mr-2" />
                      Pay ₹{calculationData?.totalExtensionFee.toFixed(2) || '0.00'}
                    </>
                  )}
                </Button>
              </div>
            </>
          )}

          {step === 'payment' && (
            <>
              <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                <h4 className="font-medium text-green-900 mb-2">Payment Summary</h4>
                <div className="space-y-1 text-sm text-green-800">
                  <div className="flex justify-between">
                    <span>Extension Days:</span>
                    <span>{extensionDays} days</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Total Amount:</span>
                    <span className="font-semibold">₹{calculationData?.totalExtensionFee?.toFixed(2) || '0.00'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Payment ID:</span>
                    <span className="text-xs font-mono">{paymentData?.paymentId}</span>
                  </div>
                </div>
              </div>

              <div className="bg-yellow-50 p-3 rounded-lg border border-yellow-200">
                <p className="text-sm text-yellow-800">
                  📱 In a real app, this would show the payment gateway (Stripe/Razorpay) interface.
                  For demo purposes, click "Confirm Payment" to simulate a successful payment.
                </p>
              </div>

              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setStep('calculate')}
                  className="flex-1"
                >
                  Back
                </Button>
                <Button
                  onClick={confirmPayment}
                  disabled={processExtensionMutation.isPending}
                  className="flex-1"
                >
                  Confirm Payment
                </Button>
              </div>
            </>
          )}

          {step === 'processing' && (
            <div className="text-center py-8">
              <Clock className="h-12 w-12 animate-spin mx-auto mb-4 text-blue-500" />
              <h3 className="text-lg font-medium mb-2">Processing Your Extension</h3>
              <p className="text-gray-600">Please wait while we process your payment and extend your rental...</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
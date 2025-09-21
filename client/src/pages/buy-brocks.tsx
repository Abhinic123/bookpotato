import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { CreditCard, Coins, ArrowRight, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { formatCurrency } from "@/lib/utils";

const buyBrocksSchema = z.object({
  package: z.string().min(1, "Please select a package"),
  paymentMethod: z.string().min(1, "Please select payment method"),
});

type BuyBrocksFormData = z.infer<typeof buyBrocksSchema>;

// Dynamic Brocks packages from API - we'll fetch these

export default function BuyBrocks() {
  const { toast } = useToast();
  
  // Fetch dynamic packages from API
  const { data: brocksPackages, isLoading: packagesLoading } = useQuery({
    queryKey: ["/api/brocks-packages"],
  });
  const queryClient = useQueryClient();
  const [selectedPackage, setSelectedPackage] = useState<string>("");

  // Fetch user credits
  const { data: userCredits } = useQuery({
    queryKey: ["/api/user/credits"],
  });

  // Fetch conversion rates
  const { data: conversionRates } = useQuery({
    queryKey: ["/api/admin/brocks-conversion-rates"],
  });

  // Fetch page content
  const { data: pageContent } = useQuery({
    queryKey: ["/api/page-content/buy-brocks"],
  });

  const form = useForm<BuyBrocksFormData>({
    resolver: zodResolver(buyBrocksSchema),
    defaultValues: {
      package: "",
      paymentMethod: "card",
    },
  });

  const purchaseMutation = useMutation({
    mutationFn: async (data: BuyBrocksFormData) => {
      const response = await apiRequest("POST", "/api/brocks/purchase", {
        packageId: data.package,
        paymentMethod: data.paymentMethod,
      });
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Purchase Successful!",
        description: `${data.brocksAwarded} Brocks credits have been added to your account.`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/user/credits"] });
      form.reset();
      setSelectedPackage("");
    },
    onError: (error: any) => {
      toast({
        title: "Purchase Failed",
        description: error.message || "Failed to process payment",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: BuyBrocksFormData) => {
    purchaseMutation.mutate(data);
  };
  
  // Default packages in case API fails or no packages exist
  const defaultPackages = [
    {
      id: "starter",
      name: "Starter Pack",
      brocks: 100,
      bonus: 20,
      price: "99",
      popular: false
    },
    {
      id: "value",
      name: "Value Pack",
      brocks: 250,
      bonus: 75,
      price: "199",
      popular: true
    },
    {
      id: "premium",
      name: "Premium Pack",
      brocks: 500,
      bonus: 200,
      price: "349",
      popular: false
    },
    {
      id: "ultimate",
      name: "Ultimate Pack",
      brocks: 1000,
      bonus: 500,
      price: "599",
      popular: false
    }
  ];
  
  // Use API packages if available, otherwise fall back to defaults
  const packages = (brocksPackages as any[])?.length > 0 ? brocksPackages : defaultPackages;
  
  // Get selected package details  
  const selectedPkg = packages?.find((pkg: any) => pkg.id === selectedPackage);

  return (
    <div className="container mx-auto px-4 py-6 max-w-4xl">
      <div className="flex flex-col space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center space-x-2 mb-4">
            <Coins className="h-8 w-8 text-amber-600" />
            <h1 className="text-3xl font-bold text-text-primary">
              {pageContent?.title || "Buy Brocks Credits"}
            </h1>
          </div>
          <p className="text-text-secondary max-w-2xl mx-auto">
            {pageContent?.description || "Purchase Brocks credits to unlock premium benefits, get discounts on rentals, and enjoy commission-free transactions."}
          </p>
          {pageContent?.subtitle && (
            <p className="text-lg text-gray-700 font-medium mt-2">
              {pageContent.subtitle}
            </p>
          )}
        </div>

        {/* Current Balance */}
        <Card className="bg-gradient-to-r from-amber-50 to-orange-50 border-amber-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-text-primary">Current Balance</h3>
                <div className="flex items-center space-x-2">
                  <Coins className="h-5 w-5 text-amber-600" />
                  <span className="text-2xl font-bold text-amber-600">
                    {userCredits?.balance || 0} Brocks
                  </span>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm text-text-secondary">Total Earned</p>
                <p className="text-lg font-semibold text-text-primary">
                  {userCredits?.totalEarned || 0} Brocks
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Package Selection */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-text-primary">Choose Your Package</h2>
          {packagesLoading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {packages?.map((pkg) => (
              <Card
                key={pkg.id}
                className={`relative cursor-pointer transition-all ${
                  selectedPackage === pkg.id
                    ? "ring-2 ring-primary border-primary"
                    : "hover:shadow-md"
                } ${pkg.popular ? "border-amber-400" : ""}`}
                onClick={() => {
                  setSelectedPackage(pkg.id);
                  form.setValue("package", pkg.id);
                }}
              >
                {pkg.popular && (
                  <Badge className="absolute -top-2 left-1/2 transform -translate-x-1/2 bg-amber-500">
                    Most Popular
                  </Badge>
                )}
                <CardHeader className="pb-2">
                  <CardTitle className="text-center">
                    <div className="text-lg font-semibold">{pkg.name}</div>
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-center space-y-3">
                  <div>
                    <div className="text-3xl font-bold text-amber-600">
                      {pkg.brocks + pkg.bonus}
                    </div>
                    <div className="text-sm text-text-secondary">
                      {pkg.brocks} + {pkg.bonus} bonus
                    </div>
                  </div>
                  <div className="text-2xl font-bold text-text-primary">
                    ₹{parseFloat(pkg.price)}
                  </div>
                  <div className="text-sm text-text-secondary">
                    ≈ ₹{(parseFloat(pkg.price) / (pkg.brocks + pkg.bonus)).toFixed(2)} per Brock
                  </div>
                  {selectedPackage === pkg.id && (
                    <div className="flex justify-center">
                      <Check className="h-6 w-6 text-primary" />
                    </div>
                  )}
                </CardContent>
              </Card>
              ))}
            </div>
          )}
        </div>

        {/* Payment Form */}
        {selectedPackage && (
          <Card>
            <CardHeader>
              <CardTitle>Payment Details</CardTitle>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  <FormField
                    control={form.control}
                    name="paymentMethod"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Payment Method</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select payment method" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="card">Credit/Debit Card</SelectItem>
                            <SelectItem value="upi">UPI</SelectItem>
                            <SelectItem value="netbanking">Net Banking</SelectItem>
                            <SelectItem value="wallet">Digital Wallet</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Order Summary */}
                  {selectedPkg && (
                    <div className="bg-surface rounded-lg p-4 space-y-3">
                      <h4 className="font-semibold text-text-primary">Order Summary</h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span>Package</span>
                          <span>{selectedPkg.name}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Base Brocks</span>
                          <span>{selectedPkg.brocks} Brocks</span>
                        </div>
                        <div className="flex justify-between text-green-600">
                          <span>Bonus Brocks</span>
                          <span>+{selectedPkg.bonus} Brocks</span>
                        </div>
                        <Separator />
                        <div className="flex justify-between font-semibold">
                          <span>Total Brocks</span>
                          <span>{selectedPkg.brocks + selectedPkg.bonus} Brocks</span>
                        </div>
                        <div className="flex justify-between font-semibold text-lg">
                          <span>Total Amount</span>
                          <span>{formatCurrency(selectedPkg.price)}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  <Button
                    type="submit"
                    className="w-full"
                    disabled={purchaseMutation.isPending}
                  >
                    {purchaseMutation.isPending ? (
                      "Processing Payment..."
                    ) : (
                      <>
                        <CreditCard className="h-4 w-4 mr-2" />
                        Complete Purchase {selectedPkg && `- ${formatCurrency(selectedPkg.price)}`}
                      </>
                    )}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        )}

        {/* Benefits Information */}
        <Card>
          <CardHeader>
            <CardTitle>Why Buy Brocks Credits?</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <h4 className="font-semibold text-text-primary">Commission-Free Rentals</h4>
                <p className="text-sm text-text-secondary">
                  Use {conversionRates?.creditsToCommissionFreeRate || 20} Brocks to get 1 day of commission-free
                  rentals on all your transactions.
                </p>
              </div>
              <div className="space-y-3">
                <h4 className="font-semibold text-text-primary">Instant Discounts</h4>
                <p className="text-sm text-text-secondary">
                  Convert {conversionRates?.creditsToRupeesRate || 20} Brocks to ₹1 and get instant
                  discounts on your rental payments.
                </p>
              </div>
              <div className="space-y-3">
                <h4 className="font-semibold text-text-primary">No Expiry</h4>
                <p className="text-sm text-text-secondary">
                  Your Brocks credits never expire. Use them whenever you want for maximum flexibility.
                </p>
              </div>
              <div className="space-y-3">
                <h4 className="font-semibold text-text-primary">Bonus Rewards</h4>
                <p className="text-sm text-text-secondary">
                  Earn additional Brocks through referrals, book uploads, and successful transactions.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
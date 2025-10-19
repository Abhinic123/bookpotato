import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CreditCard, Coins, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { formatCurrency } from "@/lib/utils";

declare global {
  interface Window {
    Razorpay: any;
  }
}

export default function BuyBrocks() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedPackage, setSelectedPackage] = useState<string | number>("");
  const [isProcessing, setIsProcessing] = useState(false);

  // Fetch user credits
  const { data: userCredits } = useQuery<any>({
    queryKey: ["/api/user/credits"],
  });

  // Fetch conversion rates
  const { data: conversionRates } = useQuery<any>({
    queryKey: ["/api/admin/brocks-conversion-rates"],
  });

  // Fetch page content
  const { data: pageContent } = useQuery<any>({
    queryKey: ["/api/page-content/buy-brocks"],
  });

  // Fetch dynamic packages from API
  const { data: brocksPackages, isLoading: packagesLoading } = useQuery<any>({
    queryKey: ["/api/brocks-packages"],
  });

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
  const selectedPkg = packages?.find((pkg: any) => pkg.id == selectedPackage);

  const handlePurchase = async () => {
    console.log('🔥 BUY BROCKS: Purchase button clicked');
    console.log('📦 Selected package ID:', selectedPackage);
    
    if (!selectedPackage) {
      console.error('❌ No package selected');
      toast({
        title: "Package Required",
        description: "Please select a package to continue",
        variant: "destructive",
      });
      return;
    }

    const pkg = packages.find((p: any) => p.id == selectedPackage);
    console.log('📦 Found package:', pkg);
    
    if (!pkg) {
      toast({
        title: "Error",
        description: "Package not found. Please try again.",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);
    console.log('⏳ Processing started...');

    try {
      const amountInPaise = parseFloat(pkg.price) * 100;
      console.log('💰 Creating order for amount:', amountInPaise, 'paise');

      // Create Razorpay order
      const orderResponse = await fetch('/api/payments/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          amount: amountInPaise,
          bookTitle: `${pkg.name} - ${pkg.brocks + (pkg.bonus || 0)} Brocks`,
          lenderName: "BookPotato Platform"
        }),
      });

      if (!orderResponse.ok) {
        throw new Error('Failed to create payment order');
      }

      const orderData = await orderResponse.json();
      console.log('✅ Order created:', orderData.orderId);

      // Initialize Razorpay payment
      const options = {
        key: import.meta.env.VITE_RAZORPAY_KEY_ID,
        amount: orderData.amount,
        currency: 'INR',
        name: 'BookPotato',
        description: `Purchase ${pkg.name}`,
        order_id: orderData.orderId,
        handler: async function (razorpayResponse: any) {
          console.log('💳 Razorpay payment successful!', razorpayResponse);
          
          try {
            // Complete the purchase
            const purchaseResponse = await apiRequest("POST", "/api/brocks/purchase", {
              packageId: selectedPackage.toString(),
              paymentId: razorpayResponse.razorpay_payment_id,
              orderId: razorpayResponse.razorpay_order_id,
              paymentMethod: "razorpay",
            });

            const result = await purchaseResponse.json();
            console.log('✅ Purchase completed:', result);

            toast({
              title: "Purchase Successful!",
              description: `${result.brocksAwarded} Brocks credits have been added to your account.`,
            });

            queryClient.invalidateQueries({ queryKey: ["/api/user/credits"] });
            setSelectedPackage("");
            setIsProcessing(false);
          } catch (error) {
            console.error('❌ Error completing purchase:', error);
            toast({
              title: "Purchase Failed",
              description: error instanceof Error ? error.message : "Failed to complete purchase",
              variant: "destructive",
            });
            setIsProcessing(false);
          }
        },
        prefill: {
          name: 'User',
          email: 'user@example.com',
        },
        theme: {
          color: '#0EA5E9'
        },
        modal: {
          ondismiss: function() {
            console.log('❌ Payment modal dismissed');
            setIsProcessing(false);
            toast({
              title: "Payment Cancelled",
              description: "You closed the payment window",
            });
          }
        }
      };

      console.log('🚀 Opening Razorpay modal...');
      const rzp = new window.Razorpay(options);
      rzp.open();

    } catch (error) {
      console.error('❌ Payment error:', error);
      toast({
        title: "Payment Failed",
        description: error instanceof Error ? error.message : "Something went wrong",
        variant: "destructive",
      });
      setIsProcessing(false);
    }
  };

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
              {packages?.map((pkg: any) => (
              <Card
                key={pkg.id}
                className={`relative cursor-pointer transition-all ${
                  selectedPackage == pkg.id
                    ? "ring-2 ring-primary border-primary"
                    : "hover:shadow-md"
                } ${pkg.popular ? "border-amber-400" : ""}`}
                onClick={() => {
                  console.log('📦 Package selected:', pkg.id, pkg.name);
                  setSelectedPackage(pkg.id);
                }}
                data-testid={`package-${pkg.id}`}
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
                  {selectedPackage == pkg.id && (
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

        {/* Order Summary and Purchase Button */}
        {selectedPackage && selectedPkg && (
          <Card>
            <CardHeader>
              <CardTitle>Order Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div className="bg-surface rounded-lg p-4 space-y-3">
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>Package</span>
                      <span className="font-medium">{selectedPkg.name}</span>
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
                      <span className="text-amber-600">{selectedPkg.brocks + selectedPkg.bonus} Brocks</span>
                    </div>
                    <div className="flex justify-between font-semibold text-lg">
                      <span>Total Amount</span>
                      <span className="text-primary">{formatCurrency(selectedPkg.price)}</span>
                    </div>
                  </div>
                </div>

                <Button
                  className="w-full"
                  size="lg"
                  disabled={isProcessing}
                  onClick={handlePurchase}
                  data-testid="button-complete-purchase"
                >
                  {isProcessing ? (
                    "Processing Payment..."
                  ) : (
                    <>
                      <CreditCard className="h-4 w-4 mr-2" />
                      Complete Purchase - {formatCurrency(selectedPkg.price)}
                    </>
                  )}
                </Button>
              </div>
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

import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Wallet, TrendingUp, TrendingDown, Calendar, Gift, Coins } from "lucide-react";
import { formatCurrency, formatDateRelative } from "@/lib/utils";
import { Link } from "wouter";

interface EarningsData {
  totalEarned: number;
  totalSpent: number;
  lentRentals: Array<{
    id: number;
    bookTitle: string;
    borrowerName: string;
    amount: number;
    status: string;
    startDate: string;
    endDate: string;
    actualReturnDate?: string;
  }>;
  borrowedRentals: Array<{
    id: number;
    bookTitle: string;
    lenderName: string;
    amount: number;
    status: string;
    startDate: string;
    endDate: string;
    actualReturnDate?: string;
  }>;
}

export default function EarningsPage() {
  const { data: earningsData, isLoading } = useQuery<EarningsData>({
    queryKey: ["/api/user/earnings"],
  });

  if (isLoading) {
    return (
      <div className="p-4 space-y-4">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-4">
              <div className="h-4 bg-gray-200 rounded mb-2"></div>
              <div className="h-6 bg-gray-200 rounded"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const RewardsTab = () => (
    <div className="p-4">
      <div className="text-center mb-6">
        <div className="flex justify-center mb-3">
          <div className="bg-gradient-to-r from-amber-500 to-orange-500 p-4 rounded-full">
            <Gift className="h-8 w-8 text-white" />
          </div>
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">Rewards Center</h2>
        <p className="text-gray-600">Brocks credits and rewards management</p>
      </div>
      
      <div className="space-y-4">
        <Card>
          <CardContent className="p-4 text-center">
            <Coins className="h-12 w-12 mx-auto text-amber-600 mb-3" />
            <h3 className="font-semibold mb-2">Buy Brocks Credits</h3>
            <p className="text-sm text-gray-600 mb-4">Purchase credits to unlock premium features</p>
            <Link href="/buy-brocks">
              <Button className="w-full">
                <Coins className="w-4 h-4 mr-2" />
                Buy Brocks
              </Button>
            </Link>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4 text-center">
            <Gift className="h-12 w-12 mx-auto text-green-600 mb-3" />
            <h3 className="font-semibold mb-2">Detailed Rewards</h3>
            <p className="text-sm text-gray-600 mb-4">View your complete rewards history</p>
            <Link href="/rewards">
              <Button variant="outline" className="w-full">
                <Gift className="w-4 h-4 mr-2" />
                View All Rewards
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'returned':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'active':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'overdue':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'return_requested':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'returned':
        return 'Completed';
      case 'active':
        return 'Active';
      case 'overdue':
        return 'Overdue';
      case 'return_requested':
        return 'Return Requested';
      default:
        return status;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-md mx-auto bg-white min-h-screen">
        <Tabs defaultValue="earnings" className="w-full">
          <TabsList className="grid w-full grid-cols-2 m-4">
            <TabsTrigger value="earnings" className="flex items-center gap-2">
              <Wallet className="h-4 w-4" />
              Earnings
            </TabsTrigger>
            <TabsTrigger value="rewards" className="flex items-center gap-2">
              <Gift className="h-4 w-4" />
              Rewards
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="earnings">
            <div className="p-4 space-y-6">
              {/* Header */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    <Wallet className="w-8 h-8 text-blue-600" />
                    <h1 className="text-3xl font-bold text-gray-900">Earnings & Spending</h1>
                  </div>
                </div>
                <p className="text-gray-600">Track your book lending earnings and borrowing expenses</p>
              </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-4">
        <Card className="border-green-200 bg-green-50">
          <CardContent className="pt-6 text-center">
            <TrendingUp className="h-8 w-8 text-green-600 mx-auto mb-2" />
            <div className="text-2xl font-bold text-green-700">
              {formatCurrency(earningsData?.totalEarned || 0)}
            </div>
            <div className="text-sm text-green-600">Total Earned</div>
          </CardContent>
        </Card>
        
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6 text-center">
            <TrendingDown className="h-8 w-8 text-red-600 mx-auto mb-2" />
            <div className="text-2xl font-bold text-red-700">
              {formatCurrency(earningsData?.totalSpent || 0)}
            </div>
            <div className="text-sm text-red-600">Total Spent</div>
          </CardContent>
        </Card>
      </div>

      {/* Net Balance */}
      <Card className="border-blue-200 bg-blue-50">
        <CardContent className="pt-6 text-center">
          <div className="text-lg font-semibold text-blue-900 mb-2">Net Balance</div>
          <div className={`text-3xl font-bold ${
            (earningsData?.totalEarned || 0) - (earningsData?.totalSpent || 0) >= 0 
              ? 'text-green-700' 
              : 'text-red-700'
          }`}>
            {formatCurrency((earningsData?.totalEarned || 0) - (earningsData?.totalSpent || 0))}
          </div>
        </CardContent>
      </Card>

      {/* Earnings Section */}
      <div>
        <h3 className="text-lg font-semibold mb-4 flex items-center">
          <TrendingUp className="h-5 w-5 mr-2 text-green-600" />
          Earnings ({earningsData?.lentRentals?.length || 0})
        </h3>
        <div className="space-y-4">
          {earningsData?.lentRentals?.length === 0 ? (
            <Card>
              <CardContent className="pt-6 text-center">
                <TrendingUp className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Earnings Yet</h3>
                <p className="text-gray-600">Start lending your books to earn money!</p>
              </CardContent>
            </Card>
          ) : (
            earningsData?.lentRentals?.map((rental) => (
              <Card key={rental.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h4 className="font-medium text-gray-900 mb-1">
                        {rental.bookTitle}
                      </h4>
                      <p className="text-sm text-gray-600 mb-2">
                        Borrowed by {rental.borrowerName}
                      </p>
                      <div className="flex items-center space-x-2 text-sm text-gray-500">
                        <Calendar className="h-4 w-4" />
                        <span>
                          {new Date(rental.startDate).toLocaleDateString()} - {" "}
                          {rental.actualReturnDate 
                            ? new Date(rental.actualReturnDate).toLocaleDateString()
                            : new Date(rental.endDate).toLocaleDateString()
                          }
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-semibold text-green-600 mb-1">
                        +{formatCurrency(rental.amount)}
                      </div>
                      <Badge className={getStatusColor(rental.status)}>
                        {getStatusText(rental.status)}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
      
      {/* Spending Section */}
      <div>
        <h3 className="text-lg font-semibold mb-4 flex items-center">
          <TrendingDown className="h-5 w-5 mr-2 text-red-600" />
          Spending ({earningsData?.borrowedRentals?.length || 0})
        </h3>
        <div className="space-y-4">
          {earningsData?.borrowedRentals?.length === 0 ? (
            <Card>
              <CardContent className="pt-6 text-center">
                <TrendingDown className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Spending Yet</h3>
                <p className="text-gray-600">Browse books to start borrowing!</p>
              </CardContent>
            </Card>
          ) : (
            earningsData?.borrowedRentals?.map((rental) => (
              <Card key={rental.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h4 className="font-medium text-gray-900 mb-1">
                        {rental.bookTitle}
                      </h4>
                      <p className="text-sm text-gray-600 mb-2">
                        Lent by {rental.lenderName}
                      </p>
                      <div className="flex items-center space-x-2 text-sm text-gray-500">
                        <Calendar className="h-4 w-4" />
                        <span>
                          {new Date(rental.startDate).toLocaleDateString()} - {" "}
                          {rental.actualReturnDate 
                            ? new Date(rental.actualReturnDate).toLocaleDateString()
                            : new Date(rental.endDate).toLocaleDateString()
                          }
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-semibold text-red-600 mb-1">
                        -{formatCurrency(rental.amount)}
                      </div>
                      <Badge className={getStatusColor(rental.status)}>
                        {getStatusText(rental.status)}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
            </div>
          </TabsContent>
          
          <TabsContent value="rewards">
            <RewardsTab />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
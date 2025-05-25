import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { formatDate } from "@/lib/utils";
import { 
  Settings, 
  Users, 
  BookOpen, 
  Building, 
  Gift, 
  CheckCircle, 
  XCircle,
  Clock,
  Crown
} from "lucide-react";

export default function AdminPanel() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: societyRequests = [] } = useQuery({
    queryKey: ["/api/admin/society-requests"],
  });

  const { data: referralSettings } = useQuery({
    queryKey: ["/api/admin/referral-settings"],
  });

  const { data: platformStats } = useQuery({
    queryKey: ["/api/admin/stats"],
  });

  const approveSocietyMutation = useMutation({
    mutationFn: (data: { requestId: number; approved: boolean; reason?: string }) =>
      apiRequest("/api/admin/society-requests/review", { method: "POST", body: data }),
    onSuccess: () => {
      toast({ title: "Success", description: "Society request reviewed successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/society-requests"] });
    },
  });

  const updateReferralRewardMutation = useMutation({
    mutationFn: (data: any) =>
      apiRequest("/api/admin/referral-rewards", { method: "POST", body: data }),
    onSuccess: () => {
      toast({ title: "Success", description: "Referral reward created successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/referral-settings"] });
    },
  });

  const handleSocietyReview = (requestId: number, approved: boolean, reason?: string) => {
    approveSocietyMutation.mutate({ requestId, approved, reason });
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center space-x-3 mb-6">
        <Crown className="w-8 h-8 text-yellow-600" />
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Admin Panel</h1>
          <p className="text-gray-600">Manage your BookShare platform</p>
        </div>
      </div>

      {/* Platform Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Users className="w-6 h-6 text-blue-600" />
              <div>
                <p className="text-sm text-gray-500">Total Users</p>
                <p className="text-2xl font-bold">{platformStats?.totalUsers || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <BookOpen className="w-6 h-6 text-green-600" />
              <div>
                <p className="text-sm text-gray-500">Total Books</p>
                <p className="text-2xl font-bold">{platformStats?.totalBooks || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Building className="w-6 h-6 text-purple-600" />
              <div>
                <p className="text-sm text-gray-500">Societies</p>
                <p className="text-2xl font-bold">{platformStats?.totalSocieties || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Gift className="w-6 h-6 text-orange-600" />
              <div>
                <p className="text-sm text-gray-500">Active Rentals</p>
                <p className="text-2xl font-bold">{platformStats?.activeRentals || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="society-requests" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="society-requests">Society Requests</TabsTrigger>
          <TabsTrigger value="referral-rewards">Referral Rewards</TabsTrigger>
          <TabsTrigger value="settings">Platform Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="society-requests" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Society Creation Requests</CardTitle>
              <CardDescription>
                Review and approve society creation requests. Societies must have 90+ apartments.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {societyRequests.map((request: any) => (
                  <Card key={request.id} className="border-l-4 border-l-blue-500">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="space-y-2">
                          <div className="flex items-center space-x-2">
                            <h3 className="font-semibold">{request.name}</h3>
                            <Badge variant={
                              request.status === "pending" ? "default" :
                              request.status === "approved" ? "success" : "destructive"
                            }>
                              {request.status}
                            </Badge>
                          </div>
                          <p className="text-sm text-gray-600">{request.description}</p>
                          <div className="text-xs text-gray-500 space-y-1">
                            <p>📍 {request.city} • {request.apartmentCount} apartments</p>
                            <p>🏠 {request.location}</p>
                            <p>👤 Requested by: User #{request.requestedBy}</p>
                            <p>📅 {formatDate(request.createdAt)}</p>
                          </div>
                          {request.apartmentCount < 90 && (
                            <Badge variant="destructive" className="text-xs">
                              ⚠️ Below 90 apartment requirement
                            </Badge>
                          )}
                        </div>

                        {request.status === "pending" && (
                          <div className="flex space-x-2">
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-green-600 border-green-600 hover:bg-green-50"
                              onClick={() => handleSocietyReview(request.id, true)}
                              disabled={approveSocietyMutation.isPending}
                            >
                              <CheckCircle className="w-4 h-4 mr-1" />
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-red-600 border-red-600 hover:bg-red-50"
                              onClick={() => handleSocietyReview(request.id, false, "Requirements not met")}
                              disabled={approveSocietyMutation.isPending}
                            >
                              <XCircle className="w-4 h-4 mr-1" />
                              Reject
                            </Button>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}

                {societyRequests.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    <Building className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>No pending society requests</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="referral-rewards" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Referral Reward System</CardTitle>
              <CardDescription>
                Create and manage referral rewards to incentivize platform growth
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Create New Reward */}
              <Card className="border-dashed">
                <CardHeader>
                  <CardTitle className="text-lg">Create New Reward</CardTitle>
                </CardHeader>
                <CardContent>
                  <form onSubmit={(e) => {
                    e.preventDefault();
                    const formData = new FormData(e.currentTarget);
                    updateReferralRewardMutation.mutate({
                      description: formData.get("description"),
                      rewardType: formData.get("rewardType"),
                      value: formData.get("value"),
                      requiredReferrals: parseInt(formData.get("requiredReferrals") as string),
                      requiredBooksPerReferral: parseInt(formData.get("requiredBooksPerReferral") as string),
                    });
                  }}>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="description">Description</Label>
                        <Input
                          id="description"
                          name="description"
                          placeholder="e.g., 2 months commission-free lending"
                          required
                        />
                      </div>

                      <div>
                        <Label htmlFor="rewardType">Reward Type</Label>
                        <Select name="rewardType" required>
                          <SelectTrigger>
                            <SelectValue placeholder="Select reward type" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="commission_free">Commission Free Period</SelectItem>
                            <SelectItem value="discount">Platform Discount</SelectItem>
                            <SelectItem value="credits">Account Credits</SelectItem>
                            <SelectItem value="badge">Special Badge</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <Label htmlFor="value">Reward Value</Label>
                        <Input
                          id="value"
                          name="value"
                          placeholder="e.g., 60 days, 10%, $50"
                          required
                        />
                      </div>

                      <div>
                        <Label htmlFor="requiredReferrals">Required Referrals</Label>
                        <Input
                          id="requiredReferrals"
                          name="requiredReferrals"
                          type="number"
                          min="1"
                          defaultValue="5"
                          required
                        />
                      </div>

                      <div className="md:col-span-2">
                        <Label htmlFor="requiredBooksPerReferral">Required Books per Referral</Label>
                        <Input
                          id="requiredBooksPerReferral"
                          name="requiredBooksPerReferral"
                          type="number"
                          min="1"
                          defaultValue="10"
                          required
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          Each referred user must upload this many books
                        </p>
                      </div>
                    </div>

                    <Button
                      type="submit"
                      className="mt-4"
                      disabled={updateReferralRewardMutation.isPending}
                    >
                      Create Reward
                    </Button>
                  </form>
                </CardContent>
              </Card>

              {/* Example Rewards */}
              <div className="space-y-3">
                <h3 className="font-semibold">Active Reward Programs</h3>
                
                <Card className="border-l-4 border-l-green-500">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-medium">Commission-Free Champion</h4>
                        <p className="text-sm text-gray-600">
                          Get 5 people to join and upload 10+ books each → 2 months commission-free lending
                        </p>
                        <Badge variant="success" className="mt-2">Active</Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-l-4 border-l-blue-500">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-medium">Community Builder</h4>
                        <p className="text-sm text-gray-600">
                          Get 10 people to join and upload 5+ books each → $100 platform credits
                        </p>
                        <Badge variant="default" className="mt-2">Active</Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-l-4 border-l-purple-500">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-medium">Super Recruiter</h4>
                        <p className="text-sm text-gray-600">
                          Get 20 people to join and upload 8+ books each → Permanent VIP status
                        </p>
                        <Badge variant="default" className="mt-2">Active</Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Platform Settings</CardTitle>
              <CardDescription>Configure global platform settings and policies</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <Label htmlFor="commissionRate">Platform Commission (%)</Label>
                  <Input id="commissionRate" type="number" min="0" max="20" defaultValue="5" />
                  <p className="text-xs text-gray-500 mt-1">Percentage taken from each rental</p>
                </div>

                <div>
                  <Label htmlFor="securityDeposit">Security Deposit (₹)</Label>
                  <Input id="securityDeposit" type="number" min="0" defaultValue="100" />
                  <p className="text-xs text-gray-500 mt-1">Fixed security deposit for all rentals</p>
                </div>

                <div>
                  <Label htmlFor="minApartments">Minimum Apartments for Society</Label>
                  <Input id="minApartments" type="number" min="1" defaultValue="90" />
                  <p className="text-xs text-gray-500 mt-1">Minimum apartments required for society approval</p>
                </div>

                <div>
                  <Label htmlFor="maxRentalDays">Maximum Rental Days</Label>
                  <Input id="maxRentalDays" type="number" min="1" defaultValue="30" />
                  <p className="text-xs text-gray-500 mt-1">Maximum days a book can be rented</p>
                </div>
              </div>

              <div className="pt-4 border-t">
                <Button className="bg-blue-600 hover:bg-blue-700">
                  Save Settings
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
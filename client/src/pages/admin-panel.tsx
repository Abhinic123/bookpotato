import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Settings, Users, BookOpen, TrendingUp, Home, Gift, Award, Plus, Trash2 } from "lucide-react";

const settingsSchema = z.object({
  commissionRate: z.number().min(0).max(100),
  securityDeposit: z.number().min(0),
  minApartments: z.number().min(1),
  maxRentalDays: z.number().min(1).max(365),
});

const rewardSchema = z.object({
  description: z.string().min(1),
  rewardType: z.enum(["commission_free", "bonus_earning", "badge"]),
  value: z.string().min(1),
  requiredReferrals: z.number().min(1),
  requiredBooksPerReferral: z.number().min(0),
});

type SettingsForm = z.infer<typeof settingsSchema>;
type RewardForm = z.infer<typeof rewardSchema>;

export default function AdminPanel() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch platform settings
  const { data: settings, isLoading: settingsLoading } = useQuery({
    queryKey: ["/api/admin/settings"],
  });

  // Fetch admin statistics
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["/api/admin/stats"],
  });

  // Fetch referral rewards
  const { data: rewards = [], isLoading: rewardsLoading } = useQuery({
    queryKey: ["/api/admin/rewards"],
  });

  // Fetch society requests
  const { data: societyRequests = [], isLoading: requestsLoading } = useQuery({
    queryKey: ["/api/admin/society-requests"],
  });

  // Form for settings
  const form = useForm<SettingsForm>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      commissionRate: 5,
      securityDeposit: 100,
      minApartments: 90,
      maxRentalDays: 30,
    },
  });

  // Form for creating rewards
  const rewardForm = useForm<RewardForm>({
    resolver: zodResolver(rewardSchema),
    defaultValues: {
      description: "",
      rewardType: "commission_free",
      value: "",
      requiredReferrals: 1,
      requiredBooksPerReferral: 0,
    },
  });

  // Update form when settings load - use useEffect to prevent infinite re-renders
  useEffect(() => {
    if (settings) {
      form.reset({
        commissionRate: settings.commissionRate,
        securityDeposit: settings.securityDeposit,
        minApartments: settings.minApartments,
        maxRentalDays: settings.maxRentalDays,
      });
    }
  }, [settings]);

  // Mutation to update settings
  const updateSettingsMutation = useMutation({
    mutationFn: async (data: SettingsForm) => {
      const response = await fetch("/api/admin/settings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        throw new Error("Failed to update settings");
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Settings Updated",
        description: "Platform settings have been successfully updated.",
      });
      // Force clear all cached settings
      queryClient.removeQueries({ queryKey: ["/api/admin/settings"] });
      queryClient.removeQueries({ queryKey: ["/api/platform/settings"] });
      // Immediately refetch the updated settings
      queryClient.invalidateQueries({ queryKey: ["/api/admin/settings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/platform/settings"] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update settings. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Mutation to create referral reward
  const createRewardMutation = useMutation({
    mutationFn: async (data: RewardForm) => {
      const response = await fetch("/api/admin/rewards", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        throw new Error("Failed to create reward");
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Reward Created",
        description: "Referral reward has been successfully created.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/rewards"] });
      rewardForm.reset();
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create reward. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Mutation to delete referral reward
  const deleteRewardMutation = useMutation({
    mutationFn: async (rewardId: number) => {
      const response = await fetch(`/api/admin/rewards/${rewardId}`, {
        method: "DELETE",
      });
      
      if (!response.ok) {
        throw new Error("Failed to delete reward");
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Reward Deleted",
        description: "Referral reward has been successfully deleted.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/rewards"] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete reward. Please try again.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: SettingsForm) => {
    updateSettingsMutation.mutate(data);
  };

  const onCreateReward = (data: RewardForm) => {
    createRewardMutation.mutate(data);
  };

  const onDeleteReward = (rewardId: number) => {
    if (confirm("Are you sure you want to delete this reward?")) {
      deleteRewardMutation.mutate(rewardId);
    }
  };

  if (settingsLoading || statsLoading) {
    return (
      <div className="container max-w-6xl mx-auto p-6">
        <div className="flex items-center space-x-2 mb-6">
          <Settings className="h-6 w-6" />
          <h1 className="text-2xl font-bold">Admin Panel</h1>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="animate-pulse">
                  <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                  <div className="h-8 bg-gray-200 rounded w-1/2"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="container max-w-6xl mx-auto p-6">
      <div className="flex items-center space-x-2 mb-6">
        <Settings className="h-6 w-6" />
        <h1 className="text-2xl font-bold">Admin Panel</h1>
        <Badge variant="secondary">Administrator</Badge>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <Users className="h-5 w-5 text-blue-500" />
              <div>
                <p className="text-sm font-medium text-text-secondary">Total Users</p>
                <p className="text-2xl font-bold">{stats?.totalUsers || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <BookOpen className="h-5 w-5 text-green-500" />
              <div>
                <p className="text-sm font-medium text-text-secondary">Total Books</p>
                <p className="text-2xl font-bold">{stats?.totalBooks || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <Home className="h-5 w-5 text-purple-500" />
              <div>
                <p className="text-sm font-medium text-text-secondary">Total Societies</p>
                <p className="text-2xl font-bold">{stats?.totalSocieties || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <TrendingUp className="h-5 w-5 text-orange-500" />
              <div>
                <p className="text-sm font-medium text-text-secondary">Active Rentals</p>
                <p className="text-2xl font-bold">{stats?.activeRentals || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Settings Panel */}
      <Tabs defaultValue="settings" className="space-y-4">
        <TabsList>
          <TabsTrigger value="settings">Platform Settings</TabsTrigger>
          <TabsTrigger value="rewards">Referral Rewards</TabsTrigger>
          <TabsTrigger value="societies">Society Requests</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="settings">
          <Card>
            <CardHeader>
              <CardTitle>Platform Configuration</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="commissionRate">Commission Rate (%)</Label>
                    <Input
                      id="commissionRate"
                      type="number"
                      step="0.1"
                      min="0"
                      max="100"
                      {...form.register("commissionRate", { valueAsNumber: true })}
                    />
                    {form.formState.errors.commissionRate && (
                      <p className="text-sm text-red-500">
                        {form.formState.errors.commissionRate.message}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="securityDeposit">Security Deposit (₹)</Label>
                    <Input
                      id="securityDeposit"
                      type="number"
                      min="0"
                      {...form.register("securityDeposit", { valueAsNumber: true })}
                    />
                    {form.formState.errors.securityDeposit && (
                      <p className="text-sm text-red-500">
                        {form.formState.errors.securityDeposit.message}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="minApartments">Minimum Apartments for Society</Label>
                    <Input
                      id="minApartments"
                      type="number"
                      min="1"
                      {...form.register("minApartments", { valueAsNumber: true })}
                    />
                    {form.formState.errors.minApartments && (
                      <p className="text-sm text-red-500">
                        {form.formState.errors.minApartments.message}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="maxRentalDays">Maximum Rental Days</Label>
                    <Input
                      id="maxRentalDays"
                      type="number"
                      min="1"
                      max="365"
                      {...form.register("maxRentalDays", { valueAsNumber: true })}
                    />
                    {form.formState.errors.maxRentalDays && (
                      <p className="text-sm text-red-500">
                        {form.formState.errors.maxRentalDays.message}
                      </p>
                    )}
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={updateSettingsMutation.isPending}
                  className="w-full md:w-auto"
                >
                  {updateSettingsMutation.isPending ? "Saving..." : "Save Settings"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="rewards">
          <div className="grid md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Plus className="w-5 h-5" />
                  <span>Create Referral Reward</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={rewardForm.handleSubmit(onCreateReward)} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="description">Description</Label>
                    <Input
                      id="description"
                      placeholder="e.g., Commission-free for 1 month"
                      {...rewardForm.register("description")}
                    />
                    {rewardForm.formState.errors.description && (
                      <p className="text-sm text-red-500">
                        {rewardForm.formState.errors.description.message}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="rewardType">Reward Type</Label>
                    <select
                      id="rewardType"
                      className="w-full p-2 border rounded-md"
                      {...rewardForm.register("rewardType")}
                    >
                      <option value="commission_free">Commission Free</option>
                      <option value="bonus_earning">Bonus Earning</option>
                      <option value="badge">Badge</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="value">Value</Label>
                    <Input
                      id="value"
                      placeholder="e.g., 30 (days) or 100 (rupees)"
                      {...rewardForm.register("value")}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="requiredReferrals">Required Referrals</Label>
                    <Input
                      id="requiredReferrals"
                      type="number"
                      min="1"
                      {...rewardForm.register("requiredReferrals", { valueAsNumber: true })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="requiredBooksPerReferral">Books Per Referral</Label>
                    <Input
                      id="requiredBooksPerReferral"
                      type="number"
                      min="0"
                      {...rewardForm.register("requiredBooksPerReferral", { valueAsNumber: true })}
                    />
                  </div>

                  <Button
                    type="submit"
                    disabled={createRewardMutation.isPending}
                    className="w-full"
                  >
                    {createRewardMutation.isPending ? "Creating..." : "Create Reward"}
                  </Button>
                </form>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Gift className="w-5 h-5" />
                  <span>Active Rewards</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {rewards.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <Gift className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No rewards created yet</p>
                    </div>
                  ) : (
                    rewards.map((reward: any) => (
                      <div key={reward.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2">
                            <Badge variant="secondary">
                              {reward.rewardType.replace('_', ' ')}
                            </Badge>
                            <span className="text-sm font-medium">{reward.description}</span>
                          </div>
                          <p className="text-xs text-gray-500 mt-1">
                            {reward.requiredReferrals} referrals • {reward.requiredBooksPerReferral} books each
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onDeleteReward(reward.id)}
                          disabled={deleteRewardMutation.isPending}
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="societies">
          <Card>
            <CardHeader>
              <CardTitle>Society Requests</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {societyRequests.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <Home className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No pending society requests</p>
                  </div>
                ) : (
                  societyRequests.map((request: any) => (
                    <div key={request.id} className="p-4 border rounded-lg">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="font-semibold">{request.name}</h3>
                          <p className="text-sm text-gray-600">{request.city} • {request.apartmentCount} apartments</p>
                          <p className="text-xs text-gray-500 mt-1">{request.description}</p>
                        </div>
                        <div className="flex space-x-2">
                          <Button size="sm" variant="outline">
                            Approve
                          </Button>
                          <Button size="sm" variant="outline">
                            Reject
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics">
          <div className="grid gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Platform Analytics</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-3 gap-4">
                  <div className="text-center p-4 border rounded-lg">
                    <Users className="h-8 w-8 mx-auto mb-2 text-blue-500" />
                    <div className="text-2xl font-bold">{stats?.totalUsers || 0}</div>
                    <div className="text-sm text-gray-600">Total Users</div>
                  </div>
                  <div className="text-center p-4 border rounded-lg">
                    <BookOpen className="h-8 w-8 mx-auto mb-2 text-green-500" />
                    <div className="text-2xl font-bold">{stats?.totalBooks || 0}</div>
                    <div className="text-sm text-gray-600">Total Books</div>
                  </div>
                  <div className="text-center p-4 border rounded-lg">
                    <TrendingUp className="h-8 w-8 mx-auto mb-2 text-orange-500" />
                    <div className="text-2xl font-bold">{stats?.activeRentals || 0}</div>
                    <div className="text-sm text-gray-600">Active Rentals</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>User Engagement</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8 text-gray-500">
                  <TrendingUp className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Advanced analytics coming soon</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
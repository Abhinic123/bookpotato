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
  extensionFeePerDay: z.number().min(0),
});

const brocksSchema = z.object({
  // New comprehensive reward settings
  credits_per_book_upload: z.number().min(0, "Credits per book upload must be non-negative"),
  credits_per_referral: z.number().min(0, "Credits per referral must be non-negative"),
  credits_per_borrow: z.number().min(0, "Credits per borrow transaction must be non-negative"),
  credits_per_lend: z.number().min(0, "Credits per lend transaction must be non-negative"),
  
  // Conversion settings
  credits_for_commission_free_days: z.number().min(1, "Credits for commission free days must be at least 1"),
  commission_free_days_per_conversion: z.number().min(1, "Commission free days per conversion must be at least 1"),
  credits_for_rupees_conversion: z.number().min(1, "Credits for rupees conversion must be at least 1"),
  rupees_per_credit_conversion: z.number().min(0, "Rupees per credit conversion must be non-negative"),
  
  // Legacy settings (keeping for compatibility)
  opening_credits: z.number().min(0),
  silver_referrals: z.number().min(1),
  gold_referrals: z.number().min(1),
  platinum_referrals: z.number().min(1),
  upload_10_reward: z.number().min(0),
  upload_20_reward: z.number().min(0),
  upload_30_reward: z.number().min(0),
  credit_value_rupees: z.number().min(0),
});

const rewardSchema = z.object({
  description: z.string().min(1),
  rewardType: z.enum(["commission_free", "bonus_earning", "badge"]),
  value: z.string().min(1),
  requiredReferrals: z.number().min(1),
  requiredBooksPerReferral: z.number().min(0),
});

type SettingsForm = z.infer<typeof settingsSchema>;
type BrocksForm = z.infer<typeof brocksSchema>;
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

  // Fetch Brocks settings
  const { data: brocksSettings } = useQuery({
    queryKey: ["/api/admin/rewards/settings"],
  });

  // Form for settings
  const form = useForm<SettingsForm>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      commissionRate: 5,
      securityDeposit: 100,
      minApartments: 90,
      maxRentalDays: 30,
      extensionFeePerDay: 10,
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

  // Form for Brocks settings
  const brocksForm = useForm<BrocksForm>({
    resolver: zodResolver(brocksSchema),
    defaultValues: {
      // New reward settings
      credits_per_book_upload: 1,
      credits_per_referral: 5,
      credits_per_borrow: 5,
      credits_per_lend: 5,
      
      // Conversion settings  
      credits_for_commission_free_days: 20,
      commission_free_days_per_conversion: 7,
      credits_for_rupees_conversion: 20,
      rupees_per_credit_conversion: 1,
      
      // Legacy settings
      opening_credits: 100,
      silver_referrals: 5,
      gold_referrals: 10,
      platinum_referrals: 15,
      upload_10_reward: 10,
      upload_20_reward: 20,
      upload_30_reward: 60,
      credit_value_rupees: 1.00,
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
        extensionFeePerDay: settings.extensionFeePerDay || 10,
      });
    }
  }, [settings]);

  // Update Brocks form when settings load
  useEffect(() => {
    if (brocksSettings && Array.isArray(brocksSettings)) {
      // Create a lookup map from the settings array
      const settingsMap = brocksSettings.reduce((acc, setting) => {
        acc[setting.settingKey] = setting.settingValue;
        return acc;
      }, {} as Record<string, string>);

      brocksForm.reset({
        // New reward settings
        credits_per_book_upload: parseInt(settingsMap['credits_per_book_upload'] || '1'),
        credits_per_referral: parseInt(settingsMap['credits_per_referral'] || '5'),
        credits_per_borrow: parseInt(settingsMap['credits_per_borrow'] || '5'),
        credits_per_lend: parseInt(settingsMap['credits_per_lend'] || '5'),
        
        // Conversion settings  
        credits_for_commission_free_days: parseInt(settingsMap['credits_for_commission_free_days'] || '20'),
        commission_free_days_per_conversion: parseInt(settingsMap['commission_free_days_per_conversion'] || '7'),
        credits_for_rupees_conversion: parseInt(settingsMap['credits_for_rupees_conversion'] || '20'),
        rupees_per_credit_conversion: parseFloat(settingsMap['rupees_per_credit_conversion'] || '1'),
        
        // Legacy settings
        opening_credits: parseInt(settingsMap['starting_credits'] || '100'),
        silver_referrals: parseInt(settingsMap['silver_referrals'] || '5'),
        gold_referrals: parseInt(settingsMap['gold_referrals'] || '10'),
        platinum_referrals: parseInt(settingsMap['platinum_referrals'] || '15'),
        upload_10_reward: parseInt(settingsMap['upload_10_reward'] || '10'),
        upload_20_reward: parseInt(settingsMap['upload_20_reward'] || '20'),
        upload_30_reward: parseInt(settingsMap['upload_30_reward'] || '60'),
        credit_value_rupees: parseFloat(settingsMap['credit_value_rupees'] || '1.00'),
      });
    }
  }, [brocksSettings]);

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

  // Society review mutation
  const reviewSocietyMutation = useMutation({
    mutationFn: async ({ requestId, approved, reason }: { requestId: number; approved: boolean; reason?: string }) => {
      const response = await fetch("/api/admin/society-requests/review", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ requestId, approved, reason }),
      });
      
      if (!response.ok) {
        throw new Error("Failed to review society request");
      }
      
      return response.json();
    },
    onSuccess: (data, { approved }) => {
      toast({
        title: approved ? "Society Approved" : "Society Rejected",
        description: approved ? "Society request has been approved successfully" : "Society request has been rejected",
      });
      // Refresh the society requests list
      queryClient.invalidateQueries({ queryKey: ["/api/admin/society-requests"] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to process society request. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Handle society approval
  const handleApproveReject = async (requestId: number, approved: boolean) => {
    await reviewSocietyMutation.mutateAsync({ requestId, approved });
  };

  // Mutation to update Brocks settings
  const updateBrocksMutation = useMutation({
    mutationFn: async (data: BrocksForm) => {
      const response = await fetch("/api/admin/brocks-settings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        throw new Error("Failed to update Brocks settings");
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Brocks Settings Updated",
        description: "Brocks credit and rewards settings have been successfully updated.",
      });
      // Invalidate all relevant queries to ensure settings are updated everywhere
      queryClient.invalidateQueries({ queryKey: ["/api/admin/brocks-settings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/brocks-conversion-rates"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/rewards/settings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/rewards"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user/credits"] });
    },
    onError: () => {
      toast({
        title: "Error", 
        description: "Failed to update Brocks settings. Please try again.",
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

  const onSubmitBrocks = (data: BrocksForm) => {
    updateBrocksMutation.mutate(data);
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
          <TabsTrigger value="brocks">Brocks Rewards</TabsTrigger>
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

                  <div className="space-y-2">
                    <Label htmlFor="extensionFeePerDay">Extension Fee Per Day (₹)</Label>
                    <Input
                      id="extensionFeePerDay"
                      type="number"
                      step="0.01"
                      min="0"
                      {...form.register("extensionFeePerDay", { valueAsNumber: true })}
                    />
                    {form.formState.errors.extensionFeePerDay && (
                      <p className="text-sm text-red-500">
                        {form.formState.errors.extensionFeePerDay.message}
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

        <TabsContent value="brocks">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Gift className="w-5 h-5 text-purple-600" />
                <span>Brocks Credit & Rewards System</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={brocksForm.handleSubmit(onSubmitBrocks)} className="space-y-6">
                {/* Earning Credits Section */}
                <div className="bg-green-50 p-4 rounded-lg">
                  <h3 className="font-semibold text-green-800 mb-4">How Users Earn Brocks Credits</h3>
                  <div className="grid md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="credits_per_book_upload">Credits per Book Upload</Label>
                      <Input
                        id="credits_per_book_upload"
                        type="number"
                        min="0"
                        {...brocksForm.register("credits_per_book_upload", { valueAsNumber: true })}
                      />
                      <p className="text-xs text-gray-600">Credits earned when user uploads a book</p>
                      {brocksForm.formState.errors.credits_per_book_upload && (
                        <p className="text-xs text-red-500">{brocksForm.formState.errors.credits_per_book_upload.message}</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="credits_per_referral">Credits per Referral</Label>
                      <Input
                        id="credits_per_referral"
                        type="number"
                        min="0"
                        {...brocksForm.register("credits_per_referral", { valueAsNumber: true })}
                      />
                      <p className="text-xs text-gray-600">Credits earned when user refers someone</p>
                      {brocksForm.formState.errors.credits_per_referral && (
                        <p className="text-xs text-red-500">{brocksForm.formState.errors.credits_per_referral.message}</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="credits_per_borrow">Credits per Borrow Transaction</Label>
                      <Input
                        id="credits_per_borrow"
                        type="number"
                        min="0"
                        {...brocksForm.register("credits_per_borrow", { valueAsNumber: true })}
                      />
                      <p className="text-xs text-gray-600">Credits earned when user borrows a book</p>
                      {brocksForm.formState.errors.credits_per_borrow && (
                        <p className="text-xs text-red-500">{brocksForm.formState.errors.credits_per_borrow.message}</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="credits_per_lend">Credits per Lend Transaction</Label>
                      <Input
                        id="credits_per_lend"
                        type="number"
                        min="0"
                        {...brocksForm.register("credits_per_lend", { valueAsNumber: true })}
                      />
                      <p className="text-xs text-gray-600">Credits earned when user lends a book</p>
                      {brocksForm.formState.errors.credits_per_lend && (
                        <p className="text-xs text-red-500">{brocksForm.formState.errors.credits_per_lend.message}</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Conversion Options Section */}
                <div className="bg-blue-50 p-4 rounded-lg">
                  <h3 className="font-semibold text-blue-800 mb-4">How Users Convert Brocks Credits</h3>
                  <div className="grid md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="credits_for_commission_free_days">Credits Required for Commission-Free Days</Label>
                      <Input
                        id="credits_for_commission_free_days"
                        type="number"
                        min="1"
                        {...brocksForm.register("credits_for_commission_free_days", { valueAsNumber: true })}
                      />
                      <p className="text-xs text-gray-600">How many credits needed for commission-free conversion</p>
                      {brocksForm.formState.errors.credits_for_commission_free_days && (
                        <p className="text-xs text-red-500">{brocksForm.formState.errors.credits_for_commission_free_days.message}</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="commission_free_days_per_conversion">Commission-Free Days per Conversion</Label>
                      <Input
                        id="commission_free_days_per_conversion"
                        type="number"
                        min="1"
                        {...brocksForm.register("commission_free_days_per_conversion", { valueAsNumber: true })}
                      />
                      <p className="text-xs text-gray-600">How many commission-free days user gets</p>
                      {brocksForm.formState.errors.commission_free_days_per_conversion && (
                        <p className="text-xs text-red-500">{brocksForm.formState.errors.commission_free_days_per_conversion.message}</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="credits_for_rupees_conversion">Credits Required for Rupees Conversion</Label>
                      <Input
                        id="credits_for_rupees_conversion"
                        type="number"
                        min="1"
                        {...brocksForm.register("credits_for_rupees_conversion", { valueAsNumber: true })}
                      />
                      <p className="text-xs text-gray-600">How many credits needed for rupees conversion</p>
                      {brocksForm.formState.errors.credits_for_rupees_conversion && (
                        <p className="text-xs text-red-500">{brocksForm.formState.errors.credits_for_rupees_conversion.message}</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="rupees_per_credit_conversion">Rupees per Credit Conversion</Label>
                      <Input
                        id="rupees_per_credit_conversion"
                        type="number"
                        step="0.01"
                        min="0"
                        {...brocksForm.register("rupees_per_credit_conversion", { valueAsNumber: true })}
                      />
                      <p className="text-xs text-gray-600">How many rupees user gets per credit</p>
                      {brocksForm.formState.errors.rupees_per_credit_conversion && (
                        <p className="text-xs text-red-500">{brocksForm.formState.errors.rupees_per_credit_conversion.message}</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Legacy Settings */}
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h3 className="font-semibold text-gray-800 mb-4">Legacy Settings</h3>
                  <div className="grid md:grid-cols-3 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="opening_credits">Opening Credits (Brocks)</Label>
                      <Input
                        id="opening_credits"
                        type="number"
                        min="0"
                        {...brocksForm.register("opening_credits", { valueAsNumber: true })}
                      />
                      <p className="text-xs text-gray-500">Credits given to new users</p>
                      {brocksForm.formState.errors.opening_credits && (
                        <p className="text-xs text-red-500">{brocksForm.formState.errors.opening_credits.message}</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="silver_referrals">Silver Badge (Referrals)</Label>
                      <Input
                        id="silver_referrals"
                        type="number"
                        min="1"
                        {...brocksForm.register("silver_referrals", { valueAsNumber: true })}
                      />
                      <p className="text-xs text-gray-500">Referrals for silver badge</p>
                      {brocksForm.formState.errors.silver_referrals && (
                        <p className="text-xs text-red-500">{brocksForm.formState.errors.silver_referrals.message}</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="gold_referrals">Gold Badge (Referrals)</Label>
                      <Input
                        id="gold_referrals"
                        type="number"
                        min="1"
                        {...brocksForm.register("gold_referrals", { valueAsNumber: true })}
                      />
                      <p className="text-xs text-gray-500">Referrals for gold badge</p>
                      {brocksForm.formState.errors.gold_referrals && (
                        <p className="text-xs text-red-500">{brocksForm.formState.errors.gold_referrals.message}</p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="grid md:grid-cols-3 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="platinum_referrals">Platinum Badge (Referrals)</Label>
                    <Input
                      id="platinum_referrals"
                      type="number"
                      min="1"
                      {...brocksForm.register("platinum_referrals", { valueAsNumber: true })}
                    />
                    <p className="text-xs text-gray-500">Referrals for platinum badge</p>
                    {brocksForm.formState.errors.platinum_referrals && (
                      <p className="text-xs text-red-500">{brocksForm.formState.errors.platinum_referrals.message}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="upload_10_reward">10 Books Upload Reward</Label>
                    <Input
                      id="upload_10_reward"
                      type="number"
                      min="0"
                      {...brocksForm.register("upload_10_reward", { valueAsNumber: true })}
                    />
                    <p className="text-xs text-gray-500">Commission-free days</p>
                    {brocksForm.formState.errors.upload_10_reward && (
                      <p className="text-xs text-red-500">{brocksForm.formState.errors.upload_10_reward.message}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="upload_20_reward">20 Books Upload Reward</Label>
                    <Input
                      id="upload_20_reward"
                      type="number"
                      min="0"
                      {...brocksForm.register("upload_20_reward", { valueAsNumber: true })}
                    />
                    <p className="text-xs text-gray-500">Commission-free days</p>
                    {brocksForm.formState.errors.upload_20_reward && (
                      <p className="text-xs text-red-500">{brocksForm.formState.errors.upload_20_reward.message}</p>
                    )}
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="upload_30_reward">30 Books Upload Reward</Label>
                    <Input
                      id="upload_30_reward"
                      type="number"
                      min="0"
                      {...brocksForm.register("upload_30_reward", { valueAsNumber: true })}
                    />
                    <p className="text-xs text-gray-500">Commission-free days</p>
                    {brocksForm.formState.errors.upload_30_reward && (
                      <p className="text-xs text-red-500">{brocksForm.formState.errors.upload_30_reward.message}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="credit_value_rupees">Credit Value (₹ per Brock)</Label>
                    <Input
                      id="credit_value_rupees"
                      type="number"
                      step="0.01"
                      min="0"
                      {...brocksForm.register("credit_value_rupees", { valueAsNumber: true })}
                    />
                    <p className="text-xs text-gray-500">Value of each Brock in rupees</p>
                    {brocksForm.formState.errors.credit_value_rupees && (
                      <p className="text-xs text-red-500">{brocksForm.formState.errors.credit_value_rupees.message}</p>
                    )}
                  </div>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h4 className="font-medium text-blue-900 mb-2">Brocks Credit System</h4>
                  <ul className="text-sm text-blue-800 space-y-1">
                    <li>• Users receive opening credits when they create an account</li>
                    <li>• Brocks can be earned through referrals, book uploads, and activities</li>
                    <li>• Credits can be used for payments and unlock special features</li>
                    <li>• Badge system rewards active community members</li>
                  </ul>
                </div>

                <Button type="submit" className="w-full md:w-auto" disabled={updateBrocksMutation.isPending}>
                  {updateBrocksMutation.isPending ? "Saving..." : "Save Brocks Settings"}
                </Button>
              </form>
            </CardContent>
          </Card>
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
                          <Button 
                            size="sm" 
                            variant="outline"
                            className="text-green-600 border-green-600 hover:bg-green-50"
                            disabled={reviewSocietyMutation.isPending}
                            onClick={() => handleApproveReject(request.id, true)}
                          >
                            {reviewSocietyMutation.isPending ? "Processing..." : "Approve"}
                          </Button>
                          <Button 
                            size="sm" 
                            variant="outline"
                            className="text-red-600 border-red-600 hover:bg-red-50"
                            disabled={reviewSocietyMutation.isPending}
                            onClick={() => handleApproveReject(request.id, false)}
                          >
                            {reviewSocietyMutation.isPending ? "Processing..." : "Reject"}
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
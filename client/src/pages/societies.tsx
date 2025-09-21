import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useLocation } from "wouter";
import { Plus, Users, Building2, Hash, Check, AlertTriangle, ExternalLink, MapPin, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { getInitials } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { SocietyWithStats } from "@shared/schema";
import LocationPicker from "@/components/map/location-picker";

const INDIAN_CITIES = [
  "Mumbai", "Delhi", "Bangalore", "Hyderabad", "Chennai", "Kolkata", "Pune", "Ahmedabad",
  "Surat", "Jaipur", "Lucknow", "Kanpur", "Nagpur", "Indore", "Thane", "Bhopal",
  "Visakhapatnam", "Pimpri-Chinchwad", "Patna", "Vadodara", "Ghaziabad", "Ludhiana",
  "Agra", "Nashik", "Faridabad", "Meerut", "Rajkot", "Kalyan-Dombivli", "Vasai-Virar",
  "Varanasi", "Srinagar", "Dhanbad", "Jodhpur", "Amritsar", "Raipur", "Allahabad",
  "Coimbatore", "Jabalpur", "Gwalior", "Vijayawada", "Madurai", "Guwahati", "Chandigarh",
  "Hubli-Dharwad", "Mysore", "Tiruchirappalli", "Bareilly", "Aligarh", "Tiruppur"
];

const createSocietySchema = z.object({
  name: z.string().min(1, "Society name is required"),
  description: z.string().optional(),
  city: z.string().min(1, "City is required"),
  apartmentCount: z.number().min(1, "Apartment count must be at least 1"),
  location: z.string().optional(),
});

type CreateSocietyFormData = z.infer<typeof createSocietySchema>;

interface MergeData {
  formData: CreateSocietyFormData;
  minApartments: number;
  suggestedSocieties: SocietyWithStats[];
  message: string;
}

interface MergeInterfaceProps {
  availableSocieties: SocietyWithStats[];
  onMergeRequest: (targetSocietyId: number, newSocietyName: string, newSocietyDescription?: string) => void;
}

function MergeInterface({ availableSocieties, onMergeRequest }: MergeInterfaceProps) {
  const [selectedSociety, setSelectedSociety] = useState<number | null>(null);
  const [newSocietyName, setNewSocietyName] = useState("");
  const [newSocietyDescription, setNewSocietyDescription] = useState("");

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-4">Select Society to Merge With</h3>
        <div className="space-y-3 max-h-60 overflow-y-auto">
          {availableSocieties.map((society) => (
            <Card 
              key={society.id} 
              className={`cursor-pointer transition-colors ${
                selectedSociety === society.id ? 'ring-2 ring-primary' : ''
              }`}
              onClick={() => setSelectedSociety(society.id)}
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-primary to-secondary rounded-lg flex items-center justify-center text-white font-bold text-sm">
                      {getInitials(society.name)}
                    </div>
                    <div>
                      <h4 className="font-medium">{society.name}</h4>
                      <div className="flex items-center space-x-4 text-sm text-gray-600">
                        <span className="flex items-center">
                          <Users className="h-3 w-3 mr-1" />
                          {society.memberCount} members
                        </span>
                        <span className="flex items-center">
                          <Building2 className="h-3 w-3 mr-1" />
                          {society.bookCount} books
                        </span>
                      </div>
                      {society.description && (
                        <p className="text-xs text-gray-500 mt-1">{society.description}</p>
                      )}
                    </div>
                  </div>
                  {selectedSociety === society.id && (
                    <Check className="h-5 w-5 text-primary" />
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {selectedSociety && (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Your Society Name</label>
            <Input
              placeholder="Enter your society name"
              value={newSocietyName}
              onChange={(e) => setNewSocietyName(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Description (Optional)</label>
            <Textarea
              placeholder="Describe your society..."
              value={newSocietyDescription}
              onChange={(e) => setNewSocietyDescription(e.target.value)}
              className="min-h-[80px]"
            />
          </div>
          <Button
            onClick={() => onMergeRequest(selectedSociety, newSocietyName, newSocietyDescription)}
            disabled={!newSocietyName.trim()}
            className="w-full"
          >
            Submit Merge Request
          </Button>
        </div>
      )}
    </div>
  );
}

export default function Societies() {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showMergeOptions, setShowMergeOptions] = useState(false);
  const [mergeData, setMergeData] = useState<MergeData | null>(null);
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<{address: string; coordinates: [number, number]} | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();

  const form = useForm<CreateSocietyFormData>({
    resolver: zodResolver(createSocietySchema),
    defaultValues: {
      name: "",
      description: "",
      city: "",
      apartmentCount: 0,
      location: "",
    },
  });

  const { data: mySocieties, isLoading: isLoadingMy } = useQuery({
    queryKey: ["/api/societies/my"],
  });

  const { data: availableSocieties, isLoading: isLoadingAvailable } = useQuery({
    queryKey: ["/api/societies/available"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: CreateSocietyFormData) => {
      const response = await apiRequest("POST", "/api/societies", data);
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Request Submitted",
        description: "Your society creation request has been submitted for admin approval.",
      });
      setShowCreateModal(false);
      form.reset();
      queryClient.invalidateQueries({ queryKey: ["/api/societies"] });
    },
    onError: (error: any) => {
      if (error.message && error.message.includes("minimum apartment requirement")) {
        const errorData = JSON.parse(error.message.split(": ")[1]);
        setMergeData({
          formData: form.getValues(),
          minApartments: errorData.minApartments,
          suggestedSocieties: errorData.suggestedSocieties || [],
          message: errorData.message
        });
        setShowCreateModal(false);
        setShowMergeOptions(true);
      } else {
        toast({
          title: "Error",
          description: error.message || "Failed to create society",
          variant: "destructive",
        });
      }
    },
  });

  const mergeMutation = useMutation({
    mutationFn: async ({ targetSocietyId, newSocietyName, newSocietyDescription }: {
      targetSocietyId: number;
      newSocietyName: string;
      newSocietyDescription?: string;
    }) => {
      const response = await apiRequest("POST", "/api/societies/merge-request", {
        targetSocietyId,
        newSocietyName,
        newSocietyDescription,
        apartmentCount: mergeData?.formData.apartmentCount || 0,
        city: mergeData?.formData.city || "",
        location: mergeData?.formData.location || ""
      });
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Merge Request Submitted",
        description: "Your merge request has been submitted for admin approval.",
      });
      setShowMergeOptions(false);
      setMergeData(null);
      form.reset();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to submit merge request",
        variant: "destructive",
      });
    },
  });

  const joinByIdMutation = useMutation({
    mutationFn: async (societyId: number) => {
      const response = await apiRequest("POST", `/api/societies/${societyId}/join`);
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Successfully joined society!",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/societies"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to join society",
        variant: "destructive",
      });
    },
  });

  const onCreateSubmit = (data: CreateSocietyFormData) => {
    createMutation.mutate(data);
  };

  const handleUnjoinSociety = async (societyId: number) => {
    try {
      const response = await apiRequest("POST", `/api/societies/${societyId}/leave`);
      if (response.ok) {
        queryClient.invalidateQueries({ queryKey: ['/api/societies/my'] });
        queryClient.invalidateQueries({ queryKey: ['/api/societies/available'] });
      }
    } catch (error) {
      console.error('Error leaving society:', error);
    }
  };

  const handleJoinById = (societyId: number) => {
    joinByIdMutation.mutate(societyId);
  };

  const handleLocationSelect = (location: { address: string; coordinates: [number, number] }) => {
    setSelectedLocation(location);
    form.setValue("location", location.address);
    setShowLocationPicker(false);
  };

  const openLocationPicker = () => {
    setShowLocationPicker(true);
  };

  function renderMySocieties() {
    if (isLoadingMy) {
      return (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-12 h-12 bg-gray-200 rounded-xl animate-pulse"></div>
                    <div className="space-y-2">
                      <div className="h-4 bg-gray-200 rounded w-32"></div>
                      <div className="h-3 bg-gray-200 rounded w-24"></div>
                    </div>
                  </div>
                  <div className="h-6 bg-gray-200 rounded w-16"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      );
    }

    if (!mySocieties || (mySocieties as any[])?.length === 0) {
      return (
        <Card>
          <CardContent className="pt-6 text-center">
            <Building2 className="h-12 w-12 text-text-secondary mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-text-primary mb-2">
              No Societies Yet
            </h3>
            <p className="text-sm text-text-secondary mb-4">
              You haven't joined any societies yet. Create your own or join an existing one!
            </p>
            <div className="space-y-3">
              <Button onClick={() => setShowCreateModal(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create Society
              </Button>
              <Button 
                variant="outline" 
                onClick={() => {
                  setMergeData({
                    formData: { name: "", description: "", city: "", apartmentCount: 0, location: "" },
                    minApartments: 90,
                    suggestedSocieties: [],
                    message: "Choose an existing society to merge with. Location and name are required."
                  });
                  setShowMergeOptions(true);
                }}
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Merge with Existing
              </Button>
            </div>
          </CardContent>
        </Card>
      );
    }

    return (
      <div className="space-y-3">
        {(mySocieties as any[])?.map((society: any) => (
          <Card key={society.id}>
            <CardContent className="p-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-0">
                <div className="flex items-center space-x-3 min-w-0 flex-1">
                  <div className="w-12 h-12 bg-gradient-to-br from-primary to-secondary rounded-xl flex items-center justify-center text-white font-bold">
                    <span>{getInitials(society.name)}</span>
                  </div>
                  <div>
                    <h4 className="font-medium text-text-primary">
                      {society.name}
                    </h4>
                    <div className="flex items-center space-x-4 text-sm text-text-secondary">
                      <span className="flex items-center">
                        <Users className="h-3 w-3 mr-1" />
                        {society.memberCount} members
                      </span>
                      <span className="flex items-center">
                        <Building2 className="h-3 w-3 mr-1" />
                        {society.bookCount} books
                      </span>
                      <span className="flex items-center">
                        <Hash className="h-3 w-3 mr-1" />
                        {society.code}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row gap-2 sm:gap-2 min-w-0">
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => setLocation(`/societies/${society.id}/chat`)}
                    className="text-primary hover:text-primary whitespace-nowrap"
                  >
                    <MessageCircle className="h-4 w-4 mr-1" />
                    <span className="hidden sm:inline">Chat</span>
                    <span className="sm:hidden">💬</span>
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => handleUnjoinSociety(society.id)}
                    className="text-text-secondary hover:text-destructive whitespace-nowrap"
                  >
                    <span className="hidden sm:inline">Leave</span>
                    <span className="sm:hidden">Exit</span>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  function renderAvailableSocieties() {
    if (isLoadingAvailable) {
      return (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-12 h-12 bg-gray-200 rounded-xl animate-pulse"></div>
                    <div className="space-y-2">
                      <div className="h-4 bg-gray-200 rounded w-32"></div>
                      <div className="h-3 bg-gray-200 rounded w-24"></div>
                    </div>
                  </div>
                  <div className="h-6 bg-gray-200 rounded w-16"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      );
    }

    if (!availableSocieties || (availableSocieties as any[])?.length === 0) {
      return (
        <Card>
          <CardContent className="pt-6 text-center">
            <Users className="h-12 w-12 text-text-secondary mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-text-primary mb-2">
              No Available Societies
            </h3>
            <p className="text-sm text-text-secondary mb-4">
              All societies are full or none exist yet. Create a new society to get started!
            </p>
          </CardContent>
        </Card>
      );
    }

    return (
      <div className="space-y-3">
        {(availableSocieties as SocietyWithStats[])?.map((society: SocietyWithStats) => (
          <Card key={society.id}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 bg-gradient-to-br from-primary to-secondary rounded-xl flex items-center justify-center text-white font-bold">
                    <span>{getInitials(society.name)}</span>
                  </div>
                  <div>
                    <h4 className="font-medium text-text-primary">
                      {society.name}
                    </h4>
                    <div className="flex items-center space-x-4 text-sm text-text-secondary">
                      <span className="flex items-center">
                        <Users className="h-3 w-3 mr-1" />
                        {society.memberCount} members
                      </span>
                      <span className="flex items-center">
                        <Building2 className="h-3 w-3 mr-1" />
                        {society.bookCount} books
                      </span>
                    </div>
                    {society.description && (
                      <p className="text-xs text-text-secondary mt-1">
                        {society.description}
                      </p>
                    )}
                  </div>
                </div>
                <Button 
                  size="sm" 
                  onClick={() => handleJoinById(society.id)}
                  disabled={joinByIdMutation.isPending}
                  className="bg-secondary text-white hover:bg-secondary/90"
                >
                  <Check className="h-4 w-4 mr-1" />
                  {joinByIdMutation.isPending ? "Joining..." : "Join"}
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="p-4 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Societies</h1>
          <p className="text-sm text-text-secondary mt-1">
            Join communities and share books with your neighbors
          </p>
        </div>
        <Button onClick={() => setShowCreateModal(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Create Society
        </Button>
      </div>

      <Tabs defaultValue="my-societies" className="w-full">
        <TabsList>
          <TabsTrigger value="my-societies">My Societies</TabsTrigger>
          <TabsTrigger value="available">Available to Join</TabsTrigger>
        </TabsList>

        <TabsContent value="my-societies" className="space-y-4">
          {renderMySocieties()}
        </TabsContent>

        <TabsContent value="available" className="space-y-4">
          {renderAvailableSocieties()}
        </TabsContent>
      </Tabs>

      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Society</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onCreateSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Society Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter society name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="city"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>City</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select your city" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {INDIAN_CITIES.map((city) => (
                          <SelectItem key={city} value={city}>
                            {city}
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
                name="apartmentCount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Number of Apartments</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        placeholder="Enter apartment count"
                        value={field.value || ""}
                        onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="location"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Location (Optional)</FormLabel>
                    <div className="flex space-x-2">
                      <FormControl>
                        <Input placeholder="Enter specific location" {...field} />
                      </FormControl>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={openLocationPicker}
                        className="flex items-center space-x-2"
                      >
                        <MapPin className="w-4 h-4" />
                        <span>Map</span>
                      </Button>
                    </div>
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
                        placeholder="Describe your society..." 
                        className="min-h-[80px]"
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" disabled={createMutation.isPending} className="w-full">
                {createMutation.isPending ? "Creating..." : "Create Society"}
              </Button>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Merge Options Dialog */}
      <Dialog open={showMergeOptions} onOpenChange={setShowMergeOptions}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              Minimum Apartment Requirement Not Met
            </DialogTitle>
          </DialogHeader>
          
          {mergeData && (
            <div className="space-y-6">
              <Alert>
                <AlertTriangle className="w-4 h-4" />
                <AlertDescription>
                  {mergeData.message}
                </AlertDescription>
              </Alert>

              <MergeInterface 
                availableSocieties={availableSocieties as SocietyWithStats[] || []}
                onMergeRequest={(targetSocietyId: number, newSocietyName: string, newSocietyDescription?: string) => {
                  mergeMutation.mutate({
                    targetSocietyId,
                    newSocietyName,
                    newSocietyDescription
                  });
                }}
              />

              <div className="flex gap-4 pt-4">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowMergeOptions(false);
                    setMergeData(null);
                    setShowCreateModal(true);
                  }}
                  className="flex-1"
                >
                  Modify Society Details
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowMergeOptions(false);
                    setMergeData(null);
                  }}
                  className="flex-1"
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <LocationPicker
        isOpen={showLocationPicker}
        onClose={() => setShowLocationPicker(false)}
        onLocationSelect={handleLocationSelect}
        city={form.watch("city")}
      />
    </div>
  );
}
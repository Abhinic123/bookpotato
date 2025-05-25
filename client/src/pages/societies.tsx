import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Users, Building2, Hash, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import type { SocietyWithStats } from "@shared/schema";

const createSocietySchema = z.object({
  name: z.string().min(1, "Society name is required"),
  description: z.string().optional(),
  city: z.string().min(1, "City is required"),
  apartmentCount: z.number().min(90, "Society must have at least 90 apartments"),
  location: z.string().optional(),
});

type CreateSocietyFormData = z.infer<typeof createSocietySchema>;

export default function Societies() {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: mySocieties, isLoading: loadingMy } = useQuery({
    queryKey: ["/api/societies/my"],
  });

  const { data: availableSocieties, isLoading: loadingAvailable } = useQuery({
    queryKey: ["/api/societies/available"],
  });

  const createForm = useForm<CreateSocietyFormData>({
    resolver: zodResolver(createSocietySchema),
    defaultValues: {
      name: "",
      description: "",
      city: "",
      apartmentCount: 90,
      location: "",
    },
  });



  const createSocietyMutation = useMutation({
    mutationFn: async (data: CreateSocietyFormData) => {
      const response = await apiRequest("POST", "/api/societies", data);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Society Created",
        description: "Your new society has been created successfully!",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/societies"] });
      createForm.reset();
      setShowCreateModal(false);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create society",
        variant: "destructive",
      });
    },
  });



  const joinByIdMutation = useMutation({
    mutationFn: async (societyId: number) => {
      const response = await apiRequest("POST", "/api/societies/join", { societyId });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Joined Successfully",
        description: "You have successfully joined the society!",
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
    createSocietyMutation.mutate(data);
  };



  const handleJoinById = (societyId: number) => {
    joinByIdMutation.mutate(societyId);
  };

  const getSocietyColor = (name: string) => {
    const colors = [
      "from-purple-500 to-pink-500",
      "from-blue-500 to-cyan-500",
      "from-green-500 to-teal-500",
      "from-orange-500 to-red-500",
      "from-indigo-500 to-purple-500",
    ];
    const index = name.length % colors.length;
    return colors[index];
  };

  if (loadingMy) {
    return (
      <div className="p-4 space-y-4">
        <div className="animate-pulse">
          <div className="h-32 bg-gray-200 rounded-xl"></div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          {[1, 2].map((i) => (
            <div key={i} className="animate-pulse">
              <div className="h-24 bg-gray-200 rounded-xl"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Current Societies */}
      {mySocieties && mySocieties.length > 0 && (
        <div className="gradient-primary p-4 text-white">
          <h3 className="text-lg font-semibold mb-3">Your Societies</h3>
          <div className="space-y-3">
            {mySocieties.map((society: SocietyWithStats) => (
              <div key={society.id} className="bg-white bg-opacity-20 rounded-xl p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className={`w-12 h-12 bg-gradient-to-br ${getSocietyColor(society.name)} rounded-xl flex items-center justify-center text-white font-bold`}>
                      <span>{getInitials(society.name)}</span>
                    </div>
                    <div>
                      <h4 className="font-semibold">{society.name}</h4>
                      <p className="text-sm opacity-90">
                        {society.memberCount} members · {society.bookCount} books
                      </p>
                      <p className="text-xs opacity-75 flex items-center mt-1">
                        <Hash className="h-3 w-3 mr-1" />
                        {society.code}
                      </p>
                    </div>
                  </div>
                  <Badge className="bg-green-500 text-white">
                    <Check className="h-3 w-3 mr-1" />
                    Active
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Society Management */}
      <div className="p-4">
        <div className="mb-6">
          <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
            <DialogTrigger asChild>
              <Button className="bg-primary text-white p-4 rounded-xl h-auto flex items-center space-x-2 w-full">
                <Plus className="h-6 w-6" />
                <span className="text-sm font-medium">Create New Society</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-sm">
              <DialogHeader>
                <DialogTitle>Create New Society</DialogTitle>
              </DialogHeader>
              <Form {...createForm}>
                <form onSubmit={createForm.handleSubmit(onCreateSubmit)} className="space-y-4">
                  <FormField
                    control={createForm.control}
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
                    control={createForm.control}
                    name="city"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>City</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter city name" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={createForm.control}
                    name="apartmentCount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Number of Apartments</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            placeholder="Minimum 90 apartments"
                            {...field}
                            onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={createForm.control}
                    name="location"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Location (Optional)</FormLabel>
                        <FormControl>
                          <Input placeholder="Specific area or locality" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={createForm.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description (Optional)</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="Brief description of your society"
                            className="resize-none"
                            rows={2}
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
                    disabled={createSocietyMutation.isPending}
                  >
                    {createSocietyMutation.isPending ? "Creating..." : "Create Society"}
                  </Button>
                </form>
              </Form>
            </DialogContent>
          </Dialog>

          <Dialog open={showJoinModal} onOpenChange={setShowJoinModal}>
            <DialogTrigger asChild>
              <Button className="bg-secondary text-white p-4 rounded-xl h-auto flex flex-col items-center space-y-2">
                <Users className="h-6 w-6" />
                <span className="text-sm font-medium">Join Society</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-sm">
              <DialogHeader>
                <DialogTitle>Join Society</DialogTitle>
              </DialogHeader>
              <Form {...joinForm}>
                <form onSubmit={joinForm.handleSubmit(onJoinSubmit)} className="space-y-4">
                  <FormField
                    control={joinForm.control}
                    name="code"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Society Code</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="Enter society code (e.g., GWA2024)" 
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
                    disabled={joinSocietyMutation.isPending}
                  >
                    {joinSocietyMutation.isPending ? "Joining..." : "Join Society"}
                  </Button>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Available Societies */}
        <div>
          <h3 className="text-lg font-semibold mb-4">Discover Societies</h3>
          
          {loadingAvailable ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Card key={i} className="animate-pulse">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="w-12 h-12 bg-gray-200 rounded-xl"></div>
                        <div className="space-y-2">
                          <div className="h-4 bg-gray-200 rounded w-24"></div>
                          <div className="h-3 bg-gray-200 rounded w-32"></div>
                        </div>
                      </div>
                      <div className="h-8 bg-gray-200 rounded w-16"></div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : availableSocieties && availableSocieties.length > 0 ? (
            <div className="space-y-3">
              {availableSocieties.map((society: SocietyWithStats) => (
                <Card key={society.id}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className={`w-12 h-12 bg-gradient-to-br ${getSocietyColor(society.name)} rounded-xl flex items-center justify-center text-white font-bold`}>
                          <span>{getInitials(society.name)}</span>
                        </div>
                        <div>
                          <h4 className="font-medium text-text-primary">
                            {society.name}
                          </h4>
                          <p className="text-sm text-text-secondary">
                            {society.memberCount} members · {society.bookCount} books
                          </p>
                          {society.description && (
                            <p className="text-xs text-text-secondary mt-1">
                              {society.description}
                            </p>
                          )}
                        </div>
                      </div>
                      <Button 
                        onClick={() => handleJoinById(society.id)}
                        disabled={joinByIdMutation.isPending}
                        size="sm"
                      >
                        {joinByIdMutation.isPending ? "Joining..." : "Join"}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="pt-6 text-center">
                <Building2 className="h-12 w-12 text-text-secondary mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-text-primary mb-2">
                  No Societies Available
                </h3>
                <p className="text-text-secondary mb-4">
                  There are no public societies to join at the moment. Create your own to get started!
                </p>
                <Button onClick={() => setShowCreateModal(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Society
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

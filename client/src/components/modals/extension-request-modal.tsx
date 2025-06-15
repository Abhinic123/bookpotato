import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
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
import { Textarea } from "@/components/ui/textarea";
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
import { Calendar, Clock, User, Book } from "lucide-react";

const extensionRequestSchema = z.object({
  extensionDays: z.number().min(1, "Extension must be at least 1 day").max(30, "Extension cannot exceed 30 days"),
  reason: z.string().min(10, "Please provide a reason for the extension (minimum 10 characters)"),
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

  const form = useForm<ExtensionRequestForm>({
    resolver: zodResolver(extensionRequestSchema),
    defaultValues: {
      extensionDays: 7,
      reason: "",
    },
  });

  const requestExtensionMutation = useMutation({
    mutationFn: async (data: ExtensionRequestForm) => {
      const response = await apiRequest("POST", `/api/rentals/${rental.id}/request-extension`, {
        extensionDays: data.extensionDays,
        reason: data.reason,
      });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Extension Request Sent",
        description: "Your extension request has been sent to the book owner.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/rentals/borrowed"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      onClose();
      form.reset();
    },
    onError: (error: any) => {
      toast({
        title: "Failed to Send Request",
        description: error.message || "There was an error sending your extension request.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: ExtensionRequestForm) => {
    requestExtensionMutation.mutate(data);
  };

  const handleClose = () => {
    onClose();
    form.reset();
  };

  if (!rental) return null;

  const currentEndDate = new Date(rental.endDate);
  const proposedEndDate = new Date(currentEndDate);
  const extensionDays = form.watch("extensionDays") || 7;
  proposedEndDate.setDate(currentEndDate.getDate() + extensionDays);

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Request Extension
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
              <span className="font-medium">Current Return Date:</span>{" "}
              {currentEndDate.toLocaleDateString()}
            </p>
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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
                        New return date: {proposedEndDate.toLocaleDateString()}
                      </p>
                    )}
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="reason"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Reason for Extension</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Please explain why you need to extend the borrowing period..."
                        className="resize-none"
                        rows={3}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

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
                  type="submit"
                  disabled={requestExtensionMutation.isPending}
                  className="flex-1"
                >
                  {requestExtensionMutation.isPending ? (
                    <>
                      <Clock className="h-4 w-4 mr-2 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    "Send Request"
                  )}
                </Button>
              </div>
            </form>
          </Form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
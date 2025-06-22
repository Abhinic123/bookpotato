import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { formatDateRelative } from "@/lib/utils";
import { Bell, Clock, CheckCircle, XCircle, BookOpen, Calendar } from "lucide-react";
import type { Notification } from "@shared/schema";

interface ExtensionData {
  rentalId: number;
  extensionDays: number;
  reason: string;
  proposedEndDate: string;
}

interface ReturnRequestData {
  rentalId: number;
  borrowerName: string;
  borrowerPhone: string;
  lenderPhone: string;
  bookTitle: string;
  notes?: string;
}

export default function NotificationsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [processingId, setProcessingId] = useState<number | null>(null);

  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ["/api/notifications"],
  });

  const respondToExtensionMutation = useMutation({
    mutationFn: async ({ notificationId, approved, reason }: { 
      notificationId: number; 
      approved: boolean; 
      reason?: string 
    }) => {
      const response = await apiRequest("POST", `/api/notifications/${notificationId}/respond-extension`, {
        approved,
        reason
      });
      return response.json();
    },
    onSuccess: (data, variables) => {
      toast({
        title: variables.approved ? "Extension Approved" : "Extension Declined",
        description: variables.approved 
          ? "The extension request has been approved and the borrower has been notified."
          : "The extension request has been declined and the borrower has been notified.",
      });
      
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/rentals/lent"] });
      setProcessingId(null);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to respond to extension request",
        variant: "destructive",
      });
      setProcessingId(null);
    },
  });

  const markAsReadMutation = useMutation({
    mutationFn: async (notificationId: number) => {
      const response = await apiRequest("POST", `/api/notifications/${notificationId}/mark-read`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
    },
  });

  const confirmReturnMutation = useMutation({
    mutationFn: async ({ rentalId }: { rentalId: number }) => {
      const response = await apiRequest("POST", `/api/rentals/${rentalId}/confirm-return`, {});
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Return Confirmed",
        description: "Book return has been confirmed and payments have been processed.",
      });
      
      // Invalidate all relevant cache entries to ensure book availability updates
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/rentals/lent"] });
      queryClient.invalidateQueries({ queryKey: ["/api/books/all"] });
      queryClient.invalidateQueries({ queryKey: ["/api/books/browse"] });
      queryClient.invalidateQueries({ queryKey: ["/api/books/my"] });
      setProcessingId(null);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to confirm return",
        variant: "destructive",
      });
      setProcessingId(null);
    },
  });

  const handleExtensionResponse = (notification: Notification, approved: boolean) => {
    setProcessingId(notification.id);
    respondToExtensionMutation.mutate({ notificationId: notification.id, approved });
  };

  const handleConfirmReturn = (rentalId: number) => {
    setProcessingId(rentalId);
    confirmReturnMutation.mutate({ rentalId });
  };

  const handleMarkAsRead = (notificationId: number) => {
    markAsReadMutation.mutate(notificationId);
  };

  const parseExtensionData = (dataString: string | null): ExtensionData | null => {
    if (!dataString) return null;
    try {
      return JSON.parse(dataString);
    } catch {
      return null;
    }
  };

  const parseReturnRequestData = (dataString: string | null): ReturnRequestData | null => {
    if (!dataString) return null;
    try {
      return JSON.parse(dataString);
    } catch {
      return null;
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case "extension_request":
        return <Clock className="w-5 h-5 text-blue-500" />;
      case "extension_approved":
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case "extension_declined":
        return <XCircle className="w-5 h-5 text-red-500" />;
      case "return_request":
        return <BookOpen className="w-5 h-5 text-orange-500" />;
      case "return_confirmed":
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case "payment_received":
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case "book_returned":
        return <BookOpen className="w-5 h-5 text-gray-500" />;
      default:
        return <Bell className="w-5 h-5 text-gray-500" />;
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading notifications...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center space-x-3">
            <Bell className="w-8 h-8 text-blue-600" />
            <h1 className="text-3xl font-bold text-gray-900">Notifications</h1>
          </div>
          <Badge variant="secondary" className="text-sm">
            {notifications.filter((n: Notification) => !n.isRead).length} unread
          </Badge>
        </div>

        <div className="space-y-4">
          {notifications.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <Bell className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No notifications</h3>
                <p className="text-gray-600">You're all caught up! New notifications will appear here.</p>
              </CardContent>
            </Card>
          ) : (
            notifications.map((notification: Notification) => {
              const extensionData = parseExtensionData(notification.data);
              const returnRequestData = parseReturnRequestData(notification.data);
              const isExtensionRequest = notification.type === "extension_request";
              const isReturnRequest = notification.type === "return_request";
              const isProcessing = processingId === notification.id;

              return (
                <Card key={notification.id} className={`${!notification.isRead ? 'border-blue-200 bg-blue-50/30' : ''}`}>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start space-x-3">
                        {getNotificationIcon(notification.type)}
                        <div className="flex-1">
                          <CardTitle className="text-lg font-medium text-gray-900">
                            {notification.title}
                          </CardTitle>
                          <p className="text-sm text-gray-600 mt-1">
                            {formatDateRelative(new Date(notification.createdAt))}
                          </p>
                        </div>
                      </div>
                      {!notification.isRead && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleMarkAsRead(notification.id)}
                          className="text-xs"
                        >
                          Mark as read
                        </Button>
                      )}
                    </div>
                  </CardHeader>
                  
                  <CardContent className="pt-0">
                    <p className="text-gray-700 mb-4">{notification.message}</p>
                    
                    {isExtensionRequest && extensionData && (
                      <div className="bg-gray-50 rounded-lg p-4 mb-4">
                        <h4 className="font-medium text-gray-900 mb-3">Extension Details</h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                          <div className="flex items-center space-x-2">
                            <Calendar className="w-4 h-4 text-gray-500" />
                            <span className="text-gray-600">Extension:</span>
                            <span className="font-medium">{extensionData.extensionDays} day(s)</span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Calendar className="w-4 h-4 text-gray-500" />
                            <span className="text-gray-600">New return date:</span>
                            <span className="font-medium">
                              {new Date(extensionData.proposedEndDate).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                        <div className="mt-3">
                          <span className="text-gray-600 text-sm">Reason:</span>
                          <p className="text-gray-800 text-sm mt-1 italic">"{extensionData.reason}"</p>
                        </div>
                      </div>
                    )}

                    {isReturnRequest && returnRequestData && (
                      <div className="bg-orange-50 rounded-lg p-4 mb-4 border border-orange-200">
                        <h4 className="font-medium text-gray-900 mb-3">Return Coordination Details</h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm mb-4">
                          <div className="flex items-center space-x-2">
                            <BookOpen className="w-4 h-4 text-orange-500" />
                            <span className="text-gray-600">Book:</span>
                            <span className="font-medium">{returnRequestData.bookTitle}</span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <span className="text-gray-600">Borrower:</span>
                            <span className="font-medium">{returnRequestData.borrowerName}</span>
                          </div>
                        </div>
                        
                        <div className="bg-white rounded border p-3 mb-4">
                          <h5 className="font-medium text-gray-900 mb-2">Contact Information</h5>
                          <div className="space-y-2 text-sm">
                            <div>
                              <span className="text-gray-600">Borrower's Phone:</span>
                              <span className="font-mono ml-2 text-blue-600">{returnRequestData.borrowerPhone}</span>
                            </div>
                            <div>
                              <span className="text-gray-600">Your Phone:</span>
                              <span className="font-mono ml-2 text-blue-600">{returnRequestData.lenderPhone}</span>
                            </div>
                          </div>
                        </div>

                        {returnRequestData.notes && (
                          <div className="mb-4">
                            <span className="text-gray-600 text-sm">Borrower's message:</span>
                            <p className="text-gray-800 text-sm mt-1 italic bg-white p-2 rounded border">"{returnRequestData.notes}"</p>
                          </div>
                        )}

                        <div className="bg-yellow-50 border border-yellow-200 rounded p-3 mb-4 text-sm">
                          <p className="text-yellow-800">
                            <strong>Next Steps:</strong> Contact the borrower to arrange a meeting spot for the book return. 
                            Once you receive the book back, click "Confirm Return" below to complete the transaction and process payments.
                          </p>
                        </div>
                      </div>
                    )}
                    
                    {isReturnRequest && !notification.isRead && returnRequestData && (
                      <div className="flex justify-center">
                        <Button
                          onClick={() => handleConfirmReturn(returnRequestData.rentalId)}
                          disabled={isProcessing}
                          className="bg-green-600 hover:bg-green-700 px-6"
                        >
                          {isProcessing ? (
                            <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2" />
                          ) : (
                            <CheckCircle className="w-4 h-4 mr-2" />
                          )}
                          Confirm Book Received & Complete Return
                        </Button>
                      </div>
                    )}
                    
                    {isExtensionRequest && !notification.isRead && (
                      <div className="flex space-x-3">
                        <Button
                          onClick={() => handleExtensionResponse(notification, true)}
                          disabled={isProcessing}
                          className="flex-1 bg-green-600 hover:bg-green-700"
                        >
                          {isProcessing ? (
                            <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2" />
                          ) : (
                            <CheckCircle className="w-4 h-4 mr-2" />
                          )}
                          Approve Extension
                        </Button>
                        <Button
                          onClick={() => handleExtensionResponse(notification, false)}
                          disabled={isProcessing}
                          variant="destructive"
                          className="flex-1"
                        >
                          {isProcessing ? (
                            <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2" />
                          ) : (
                            <XCircle className="w-4 h-4 mr-2" />
                          )}
                          Decline Extension
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
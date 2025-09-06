import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Send, MessageCircle, Users, Bell, Hash } from "lucide-react";
import { useUser } from "@/hooks/use-user";
import { formatDistanceToNow } from "date-fns";
import { useToast } from "@/hooks/use-toast";

interface SimplifiedChatProps {
  societyId: number;
  societyName: string;
}

export default function SimplifiedChat({ societyId, societyName }: SimplifiedChatProps) {
  const { user } = useUser();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [message, setMessage] = useState("");
  const [activeTab, setActiveTab] = useState("society");
  const [selectedContact, setSelectedContact] = useState<number | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Get currentUserId safely
  const currentUserId = user?.user?.id;
  
  if (!user?.user) {
    return <div className="flex items-center justify-center h-64">
      <p className="text-gray-500">Please login to access chat</p>
    </div>;
  }

  // Society Messages Query
  const { data: societyMessages = [], refetch: refetchSocietyMessages } = useQuery({
    queryKey: [`/api/societies/${societyId}/messages`],
    queryFn: async () => {
      const response = await fetch(`/api/societies/${societyId}/messages`);
      if (!response.ok) return [];
      return response.json();
    },
  });

  // Society Members Query  
  const { data: societyMembers = [] } = useQuery({
    queryKey: [`/api/societies/${societyId}/members`],
    queryFn: async () => {
      const response = await fetch(`/api/societies/${societyId}/members`);
      if (!response.ok) return [];
      return response.json();
    },
  });

  // Direct Message Contacts Query
  const { data: directContacts = [] } = useQuery({
    queryKey: ["/api/direct-messages/contacts"],
    queryFn: async () => {
      const response = await fetch("/api/direct-messages/contacts");
      if (!response.ok) return [];
      return response.json();
    },
  });

  // Direct Messages Query
  const { data: directMessages = [], refetch: refetchDirectMessages } = useQuery({
    queryKey: [`/api/direct-messages/${selectedContact}`],
    queryFn: async () => {
      if (!selectedContact) return [];
      const response = await fetch(`/api/direct-messages/${selectedContact}`);
      if (!response.ok) return [];
      return response.json();
    },
    enabled: !!selectedContact,
  });

  // Send Society Message
  const sendSocietyMessage = useMutation({
    mutationFn: async (content: string) => {
      console.log(`Sending society message to society ${societyId}:`, content);
      const response = await fetch(`/api/societies/${societyId}/messages`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Accept": "application/json"
        },
        credentials: "include",
        body: JSON.stringify({ content, messageType: "text" }),
      });
      
      console.log("Society message response status:", response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error("Society message error:", response.status, errorText);
        throw new Error(`Failed to send message: ${response.status} ${errorText}`);
      }
      return response.json();
    },
    onSuccess: (data) => {
      console.log("Society message sent successfully:", data);
      setMessage("");
      refetchSocietyMessages();
      toast({ title: "Message sent!" });
    },
    onError: (error: any) => {
      console.error("Society message mutation error:", error);
      toast({ 
        title: "Failed to send message", 
        description: error.message || "Please check if you're a member of this society",
        variant: "destructive" 
      });
    },
  });

  // Send Direct Message
  const sendDirectMessage = useMutation({
    mutationFn: async ({ receiverId, content }: { receiverId: number; content: string }) => {
      console.log(`💬 Sending direct message to user ${receiverId}:`, content);
      const response = await fetch("/api/direct-messages", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Accept": "application/json" 
        },
        credentials: "include",
        body: JSON.stringify({ receiverId, content, messageType: "text" }),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`💬 Direct message send failed:`, response.status, errorText);
        throw new Error(`Failed to send message: ${response.status} ${errorText}`);
      }
      
      const result = await response.json();
      console.log(`💬 Direct message sent successfully:`, result);
      return result;
    },
    onSuccess: () => {
      setMessage("");
      refetchDirectMessages();
      toast({ title: "Message sent!" });
    },
    onError: (error: any) => {
      console.error(`💬 Direct message error:`, error);
      toast({ 
        title: "Failed to send message", 
        description: error.message || "Please try again",
        variant: "destructive" 
      });
    },
  });

  // Auto scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [societyMessages, directMessages]);

  const handleSendMessage = () => {
    if (!message.trim()) return;

    console.log("Attempting to send message:", {
      activeTab,
      message,
      societyId,
      selectedContact,
      userId: currentUserId
    });

    if (activeTab === "society") {
      if (!societyId) {
        console.error("No societyId available for society chat");
        toast({ title: "Society not found", variant: "destructive" });
        return;
      }
      sendSocietyMessage.mutate(message);
    } else if (activeTab === "direct" && selectedContact) {
      sendDirectMessage.mutate({ receiverId: selectedContact, content: message });
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const formatDate = (dateString: string) => {
    try {
      return formatDistanceToNow(new Date(dateString), { addSuffix: true });
    } catch {
      return "Just now";
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map(n => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  if (!user) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>;
  }

  return (
    <div className="h-screen bg-white">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
        <div className="border-b px-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="society" className="flex items-center gap-2">
              <Hash className="h-4 w-4" />
              Society Chat
            </TabsTrigger>
            <TabsTrigger value="direct" className="flex items-center gap-2">
              <MessageCircle className="h-4 w-4" />
              Direct Messages
            </TabsTrigger>
          </TabsList>
        </div>

        <div className="flex-1 overflow-hidden">
          <TabsContent value="society" className="h-full m-0 flex flex-col">
            <div className="flex flex-col h-full">
              <div className="p-4 border-b bg-blue-50 shrink-0">
                <div className="flex items-center gap-2">
                  <Hash className="h-5 w-5 text-blue-600" />
                  <span className="font-semibold text-blue-900">{societyName} General Chat</span>
                  <Badge variant="secondary">{societyMembers.length} members</Badge>
                </div>
              </div>

              <ScrollArea className="flex-1">
                <div className="space-y-4 p-4">
                  {societyMessages.length === 0 ? (
                    <div className="text-center py-8">
                      <MessageCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                      <h3 className="text-lg font-medium text-gray-900 mb-2">No messages yet</h3>
                      <p className="text-gray-500">Start the conversation with your society members!</p>
                    </div>
                  ) : (
                    societyMessages.map((msg: any) => (
                      <div key={msg.id} className={`flex gap-3 ${msg.sender_id === currentUserId ? 'justify-end' : ''}`}>
                        {msg.sender_id !== currentUserId && (
                          <Avatar className="w-8 h-8">
                            <AvatarImage src={msg.sender_picture} />
                            <AvatarFallback className="text-xs">
                              {getInitials(msg.sender_name)}
                            </AvatarFallback>
                          </Avatar>
                        )}
                        
                        <div className={`max-w-[70%] ${msg.sender_id === currentUserId ? 'order-first' : ''}`}>
                          {msg.sender_id !== currentUserId && (
                            <p className="text-xs text-gray-500 mb-1">{msg.sender_name}</p>
                          )}
                          <div className={`p-3 rounded-lg ${
                            msg.sender_id === currentUserId 
                              ? 'bg-blue-500 text-white ml-auto' 
                              : 'bg-gray-100 text-gray-900'
                          }`}>
                            <p className="text-sm">{msg.content}</p>
                            <p className={`text-xs mt-1 ${
                              msg.sender_id === currentUserId ? 'text-blue-100' : 'text-gray-500'
                            }`}>
                              {formatDate(msg.created_at)}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                  <div ref={messagesEndRef} />
                </div>
              </ScrollArea>

              <div className="p-4 border-t bg-white shrink-0">
                <div className="flex gap-2 items-center">
                  <Input
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="Type your message..."
                    className="flex-1 min-h-[40px]"
                  />
                  <Button 
                    onClick={handleSendMessage}
                    disabled={!message.trim() || sendSocietyMessage.isPending}
                    size="icon"
                    className="h-[40px] w-[40px] shrink-0"
                  >
                    {sendSocietyMessage.isPending ? (
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </TabsContent>
          
          <TabsContent value="direct" className="h-full m-0">
            <div className="flex h-full">
              {/* Contacts Sidebar */}
              <div className="w-1/3 border-r">
                <div className="p-4 border-b bg-green-50">
                  <span className="font-semibold text-green-900 flex items-center gap-2">
                    <MessageCircle className="h-5 w-5" />
                    Direct Messages
                  </span>
                </div>
                
                <ScrollArea className="h-full">
                  <div className="p-2">
                    <div className="mb-4">
                      <p className="text-xs font-medium text-gray-500 mb-2 px-2">SOCIETY MEMBERS</p>
                      {societyMembers
                        .filter((member: any) => member.id !== currentUserId)
                        .map((member: any) => (
                        <Button
                          key={member.id}
                          variant={selectedContact === member.id ? "secondary" : "ghost"}
                          className="w-full justify-start p-2 h-auto mb-1"
                          onClick={() => setSelectedContact(member.id)}
                        >
                          <div className="flex items-center gap-3 w-full">
                            <Avatar className="w-8 h-8">
                              <AvatarImage src={member.profile_picture} />
                              <AvatarFallback className="text-xs">
                                {getInitials(member.name)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 text-left">
                              <p className="text-sm font-medium">{member.name}</p>
                              {member.is_admin && (
                                <Badge variant="outline" className="text-xs">Admin</Badge>
                              )}
                            </div>
                          </div>
                        </Button>
                      ))}
                    </div>
                  </div>
                </ScrollArea>
              </div>

              {/* Chat Area */}
              <div className="flex-1 flex flex-col">
                {selectedContact ? (
                  <>
                    <div className="p-4 border-b bg-green-50">
                      <div className="flex items-center gap-2">
                        <MessageCircle className="h-5 w-5 text-green-600" />
                        <span className="font-semibold text-green-900">
                          {societyMembers.find((m: any) => m.id === selectedContact)?.name || 'Unknown'}
                        </span>
                      </div>
                    </div>

                    <ScrollArea className="flex-1 p-4">
                      <div className="space-y-4">
                        {directMessages.length === 0 ? (
                          <div className="text-center py-8">
                            <MessageCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                            <h3 className="text-lg font-medium text-gray-900 mb-2">No messages yet</h3>
                            <p className="text-gray-500">Start a private conversation!</p>
                          </div>
                        ) : (
                          directMessages.map((msg: any) => (
                            <div key={msg.id} className={`flex gap-3 ${msg.sender_id === currentUserId ? 'justify-end' : ''}`}>
                              {msg.sender_id !== currentUserId && (
                                <Avatar className="w-8 h-8">
                                  <AvatarImage src={msg.sender_picture} />
                                  <AvatarFallback className="text-xs">
                                    {getInitials(msg.sender_name)}
                                  </AvatarFallback>
                                </Avatar>
                              )}
                              
                              <div className={`max-w-[70%] ${msg.sender_id === currentUserId ? 'order-first' : ''}`}>
                                {msg.sender_id !== currentUserId && (
                                  <p className="text-xs text-gray-500 mb-1">{msg.sender_name}</p>
                                )}
                                <div className={`p-3 rounded-lg ${
                                  msg.sender_id === currentUserId 
                                    ? 'bg-green-500 text-white ml-auto' 
                                    : 'bg-gray-100 text-gray-900'
                                }`}>
                                  <p className="text-sm">{msg.content}</p>
                                  <p className={`text-xs mt-1 ${
                                    msg.sender_id === currentUserId ? 'text-green-100' : 'text-gray-500'
                                  }`}>
                                    {formatDate(msg.created_at)}
                                  </p>
                                </div>
                              </div>
                            </div>
                          ))
                        )}
                        <div ref={messagesEndRef} />
                      </div>
                    </ScrollArea>

                    <div className="p-4 border-t bg-white">
                      <div className="flex gap-2 items-end">
                        <div className="flex-1">
                          <Input
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            onKeyPress={handleKeyPress}
                            placeholder="Type your message..."
                            className="min-h-[40px]"
                          />
                        </div>
                        <Button 
                          onClick={handleSendMessage}
                          disabled={!message.trim() || sendDirectMessage.isPending}
                          size="icon"
                          className="h-[40px] w-[40px] shrink-0 z-30"
                        >
                          <Send className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="flex-1 flex items-center justify-center text-center p-8">
                    <div>
                      <MessageCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                      <h3 className="text-lg font-medium text-gray-900 mb-2">Select a Conversation</h3>
                      <p className="text-gray-500">Choose a society member to start a direct conversation</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
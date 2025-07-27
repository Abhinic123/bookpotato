import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BookOpen, Mail, Lock, User, Eye, EyeOff, Heart, Star, Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

const loginSchema = z.object({
  email: z.string().email("Please enter a valid email"),
  password: z.string().min(1, "Password is required"),
});

const signupSchema = z.object({
  username: z.string().min(2, "Username must be at least 2 characters"),
  email: z.string().email("Please enter a valid email"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  city: z.string().min(1, "City is required"),
});

interface AnimatedAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

// Playful book character component
const BookCharacter = ({ mood }: { mood: 'happy' | 'thinking' | 'excited' | 'winking' }) => {
  const expressions = {
    happy: { eyes: "😊", mouth: "📖" },
    thinking: { eyes: "🤔", mouth: "📚" },
    excited: { eyes: "🤩", mouth: "📖" },
    winking: { eyes: "😉", mouth: "📕" }
  };

  return (
    <motion.div
      className="relative w-24 h-24 mx-auto mb-4"
      animate={{
        y: [0, -5, 0],
        rotate: [0, 2, -2, 0]
      }}
      transition={{
        duration: 3,
        repeat: Infinity,
        ease: "easeInOut"
      }}
    >
      <div className="w-20 h-20 bg-gradient-to-br from-blue-400 to-purple-500 rounded-2xl relative mx-auto shadow-lg">
        <div className="absolute inset-2 bg-white rounded-xl flex items-center justify-center">
          <motion.div
            className="text-2xl"
            animate={{ scale: [1, 1.1, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            {expressions[mood].eyes}
          </motion.div>
        </div>
        <motion.div
          className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 text-lg"
          animate={{ rotate: [0, 10, -10, 0] }}
          transition={{ duration: 2, repeat: Infinity, delay: 0.5 }}
        >
          {expressions[mood].mouth}
        </motion.div>
      </div>
      
      {/* Floating sparkles */}
      <AnimatePresence>
        {[...Array(3)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute text-yellow-400"
            initial={{ opacity: 0, scale: 0 }}
            animate={{
              opacity: [0, 1, 0],
              scale: [0, 1, 0],
              x: [0, (i - 1) * 20],
              y: [0, -20]
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              delay: i * 0.5
            }}
          >
            <Sparkles className="w-3 h-3" />
          </motion.div>
        ))}
      </AnimatePresence>
    </motion.div>
  );
};

// Floating elements animation
const FloatingElements = () => {
  const elements = [
    { icon: BookOpen, color: "text-blue-400", delay: 0 },
    { icon: Heart, color: "text-red-400", delay: 0.5 },
    { icon: Star, color: "text-yellow-400", delay: 1 },
  ];

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {elements.map((Element, i) => (
        <motion.div
          key={i}
          className={`absolute ${Element.color}`}
          initial={{ opacity: 0, y: 100 }}
          animate={{
            opacity: [0, 0.6, 0],
            y: [100, -20],
            x: [0, Math.sin(i) * 50],
            rotate: [0, 360]
          }}
          transition={{
            duration: 4,
            repeat: Infinity,
            delay: Element.delay,
            ease: "easeInOut"
          }}
          style={{
            left: `${20 + i * 30}%`,
            top: '80%'
          }}
        >
          <Element.icon className="w-4 h-4" />
        </motion.div>
      ))}
    </div>
  );
};

export default function AnimatedAuthModal({ isOpen, onClose, onSuccess }: AnimatedAuthModalProps) {
  const [activeTab, setActiveTab] = useState("login");
  const [showPassword, setShowPassword] = useState(false);
  const [characterMood, setCharacterMood] = useState<'happy' | 'thinking' | 'excited' | 'winking'>('happy');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Login form
  const loginForm = useForm({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" }
  });

  // Signup form
  const signupForm = useForm({
    resolver: zodResolver(signupSchema),
    defaultValues: { username: "", email: "", password: "", city: "" }
  });

  // Login mutation
  const loginMutation = useMutation({
    mutationFn: async (data: z.infer<typeof loginSchema>) => {
      return apiRequest("POST", "/api/auth/login", data);
    },
    onSuccess: () => {
      setCharacterMood('excited');
      toast({ title: "Welcome back!", description: "Successfully logged in!" });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      setTimeout(() => {
        onSuccess?.();
        onClose();
      }, 1000);
    },
    onError: () => {
      setCharacterMood('thinking');
      toast({ title: "Login failed", description: "Please check your credentials", variant: "destructive" });
    }
  });

  // Signup mutation
  const signupMutation = useMutation({
    mutationFn: async (data: z.infer<typeof signupSchema>) => {
      return apiRequest("POST", "/api/auth/register", data);
    },
    onSuccess: () => {
      setCharacterMood('excited');
      toast({ title: "Welcome to BookShare!", description: "Account created successfully!" });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      setTimeout(() => {
        onSuccess?.();
        onClose();
      }, 1000);
    },
    onError: () => {
      setCharacterMood('thinking');
      toast({ title: "Signup failed", description: "Please try again", variant: "destructive" });
    }
  });

  // Change character mood based on user interaction
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!loginMutation.isPending && !signupMutation.isPending) {
        setCharacterMood(Math.random() > 0.5 ? 'happy' : 'winking');
      }
    }, 3000);
    return () => clearTimeout(timer);
  }, [loginMutation.isPending, signupMutation.isPending]);

  const handleTabChange = (value: string) => {
    setActiveTab(value);
    setCharacterMood('thinking');
    setTimeout(() => setCharacterMood('happy'), 500);
  };

  const onLoginSubmit = (data: z.infer<typeof loginSchema>) => {
    setCharacterMood('thinking');
    loginMutation.mutate(data);
  };

  const onSignupSubmit = (data: z.infer<typeof signupSchema>) => {
    setCharacterMood('thinking');
    signupMutation.mutate(data);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md p-0 overflow-hidden bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50">
        <FloatingElements />
        
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className="relative z-10"
        >
          <DialogHeader className="text-center pt-6 pb-2">
            <motion.div
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", bounce: 0.5 }}
            >
              <BookCharacter mood={characterMood} />
            </motion.div>
            
            <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              Welcome to BookShare! 📚
            </DialogTitle>
            <motion.p
              className="text-gray-600 text-sm"
              animate={{ opacity: [0.7, 1, 0.7] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              Your community library awaits...
            </motion.p>
          </DialogHeader>

          <Card className="m-6 border-0 shadow-xl bg-white/80 backdrop-blur-sm">
            <CardContent className="p-6">
              <Tabs value={activeTab} onValueChange={handleTabChange}>
                <TabsList className="grid w-full grid-cols-2 mb-6">
                  <TabsTrigger 
                    value="login" 
                    className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500 data-[state=active]:to-purple-500 data-[state=active]:text-white"
                  >
                    <motion.div
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      className="flex items-center space-x-2"
                    >
                      <User className="w-4 h-4" />
                      <span>Login</span>
                    </motion.div>
                  </TabsTrigger>
                  <TabsTrigger 
                    value="signup"
                    className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-500 data-[state=active]:to-pink-500 data-[state=active]:text-white"
                  >
                    <motion.div
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      className="flex items-center space-x-2"
                    >
                      <Star className="w-4 h-4" />
                      <span>Sign Up</span>
                    </motion.div>
                  </TabsTrigger>
                </TabsList>

                <AnimatePresence mode="wait">
                  <TabsContent value="login" className="space-y-4">
                    <motion.form
                      key="login-form"
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      onSubmit={loginForm.handleSubmit(onLoginSubmit)}
                      className="space-y-4"
                    >
                      <motion.div whileFocus={{ scale: 1.02 }}>
                        <Label htmlFor="login-email" className="flex items-center space-x-2 text-sm font-medium">
                          <Mail className="w-4 h-4 text-blue-500" />
                          <span>Email</span>
                        </Label>
                        <Input
                          id="login-email"
                          type="email"
                          placeholder="your@email.com"
                          {...loginForm.register("email")}
                          className="mt-1 transition-all duration-200 focus:ring-2 focus:ring-blue-500"
                          onFocus={() => setCharacterMood('thinking')}
                        />
                        {loginForm.formState.errors.email && (
                          <motion.p
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="text-red-500 text-xs mt-1"
                          >
                            {loginForm.formState.errors.email.message}
                          </motion.p>
                        )}
                      </motion.div>

                      <motion.div whileFocus={{ scale: 1.02 }}>
                        <Label htmlFor="login-password" className="flex items-center space-x-2 text-sm font-medium">
                          <Lock className="w-4 h-4 text-purple-500" />
                          <span>Password</span>
                        </Label>
                        <div className="relative mt-1">
                          <Input
                            id="login-password"
                            type={showPassword ? "text" : "password"}
                            placeholder="Enter your password"
                            {...loginForm.register("password")}
                            className="pr-10 transition-all duration-200 focus:ring-2 focus:ring-purple-500"
                            onFocus={() => setCharacterMood('winking')}
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                            onClick={() => setShowPassword(!showPassword)}
                          >
                            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </Button>
                        </div>
                        {loginForm.formState.errors.password && (
                          <motion.p
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="text-red-500 text-xs mt-1"
                          >
                            {loginForm.formState.errors.password.message}
                          </motion.p>
                        )}
                      </motion.div>

                      <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                        <Button
                          type="submit"
                          className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white shadow-lg"
                          disabled={loginMutation.isPending}
                        >
                          {loginMutation.isPending ? (
                            <motion.div
                              animate={{ rotate: 360 }}
                              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                              className="w-4 h-4 border-2 border-white border-t-transparent rounded-full"
                            />
                          ) : (
                            "Login to BookShare"
                          )}
                        </Button>
                      </motion.div>
                    </motion.form>
                  </TabsContent>

                  <TabsContent value="signup" className="space-y-4">
                    <motion.form
                      key="signup-form"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      onSubmit={signupForm.handleSubmit(onSignupSubmit)}
                      className="space-y-4"
                    >
                      <motion.div whileFocus={{ scale: 1.02 }}>
                        <Label htmlFor="signup-username" className="flex items-center space-x-2 text-sm font-medium">
                          <User className="w-4 h-4 text-green-500" />
                          <span>Username</span>
                        </Label>
                        <Input
                          id="signup-username"
                          type="text"
                          placeholder="Choose a username"
                          {...signupForm.register("username")}
                          className="mt-1 transition-all duration-200 focus:ring-2 focus:ring-green-500"
                          onFocus={() => setCharacterMood('excited')}
                        />
                        {signupForm.formState.errors.username && (
                          <motion.p
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="text-red-500 text-xs mt-1"
                          >
                            {signupForm.formState.errors.username.message}
                          </motion.p>
                        )}
                      </motion.div>

                      <motion.div whileFocus={{ scale: 1.02 }}>
                        <Label htmlFor="signup-email" className="flex items-center space-x-2 text-sm font-medium">
                          <Mail className="w-4 h-4 text-blue-500" />
                          <span>Email</span>
                        </Label>
                        <Input
                          id="signup-email"
                          type="email"
                          placeholder="your@email.com"
                          {...signupForm.register("email")}
                          className="mt-1 transition-all duration-200 focus:ring-2 focus:ring-blue-500"
                          onFocus={() => setCharacterMood('thinking')}
                        />
                        {signupForm.formState.errors.email && (
                          <motion.p
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="text-red-500 text-xs mt-1"
                          >
                            {signupForm.formState.errors.email.message}
                          </motion.p>
                        )}
                      </motion.div>

                      <motion.div whileFocus={{ scale: 1.02 }}>
                        <Label htmlFor="signup-password" className="flex items-center space-x-2 text-sm font-medium">
                          <Lock className="w-4 h-4 text-purple-500" />
                          <span>Password</span>
                        </Label>
                        <div className="relative mt-1">
                          <Input
                            id="signup-password"
                            type={showPassword ? "text" : "password"}
                            placeholder="Create a password"
                            {...signupForm.register("password")}
                            className="pr-10 transition-all duration-200 focus:ring-2 focus:ring-purple-500"
                            onFocus={() => setCharacterMood('winking')}
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                            onClick={() => setShowPassword(!showPassword)}
                          >
                            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </Button>
                        </div>
                        {signupForm.formState.errors.password && (
                          <motion.p
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="text-red-500 text-xs mt-1"
                          >
                            {signupForm.formState.errors.password.message}
                          </motion.p>
                        )}
                      </motion.div>

                      <motion.div whileFocus={{ scale: 1.02 }}>
                        <Label htmlFor="signup-city" className="flex items-center space-x-2 text-sm font-medium">
                          <BookOpen className="w-4 h-4 text-orange-500" />
                          <span>City</span>
                        </Label>
                        <Input
                          id="signup-city"
                          type="text"
                          placeholder="Your city"
                          {...signupForm.register("city")}
                          className="mt-1 transition-all duration-200 focus:ring-2 focus:ring-orange-500"
                          onFocus={() => setCharacterMood('happy')}
                        />
                        {signupForm.formState.errors.city && (
                          <motion.p
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="text-red-500 text-xs mt-1"
                          >
                            {signupForm.formState.errors.city.message}
                          </motion.p>
                        )}
                      </motion.div>

                      <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                        <Button
                          type="submit"
                          className="w-full bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 text-white shadow-lg"
                          disabled={signupMutation.isPending}
                        >
                          {signupMutation.isPending ? (
                            <motion.div
                              animate={{ rotate: 360 }}
                              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                              className="w-4 h-4 border-2 border-white border-t-transparent rounded-full"
                            />
                          ) : (
                            "Join BookShare"
                          )}
                        </Button>
                      </motion.div>
                    </motion.form>
                  </TabsContent>
                </AnimatePresence>
              </Tabs>
            </CardContent>
          </Card>
        </motion.div>
      </DialogContent>
    </Dialog>
  );
}
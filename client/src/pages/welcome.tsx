import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { 
  BookOpen, 
  Users, 
  MapPin, 
  Star,
  ArrowRight,
  ChevronLeft,
  ChevronRight
} from "lucide-react";
import { useLocation } from "wouter";

const welcomeScreens = [
  {
    id: 1,
    title: "Welcome to BookShare",
    subtitle: "Your Community Library Platform",
    description: "Connect with your neighbors and share books within your society. Discover new reads while building a stronger community.",
    icon: BookOpen,
    gradient: "from-blue-500 to-cyan-500",
    image: "/api/placeholder/400/300"
  },
  {
    id: 2,
    title: "Join Your Society",
    subtitle: "Connect with Your Community",
    description: "Find and join your residential society to start sharing books with your neighbors. Build lasting connections through literature.",
    icon: Users,
    gradient: "from-purple-500 to-pink-500",
    image: "/api/placeholder/400/300"
  },
  {
    id: 3,
    title: "Discover Local Books",
    subtitle: "Browse Nearby Collections",
    description: "Explore books available in your society. From bestsellers to classics, find your next great read just steps away from home.",
    icon: MapPin,
    gradient: "from-green-500 to-teal-500",
    image: "/api/placeholder/400/300"
  },
  {
    id: 4,
    title: "Earn While Sharing",
    subtitle: "Share Books, Earn Money",
    description: "Lend your books to community members and earn daily rental fees. Turn your personal library into a source of income.",
    icon: Star,
    gradient: "from-orange-500 to-red-500",
    image: "/api/placeholder/400/300"
  }
];

export default function Welcome() {
  const [currentScreen, setCurrentScreen] = useState(0);
  const [, navigate] = useLocation();

  useEffect(() => {
    // Check if user has seen welcome screens before
    const hasSeenWelcome = localStorage.getItem("hasSeenWelcome");
    if (hasSeenWelcome) {
      navigate("/");
    }
  }, [navigate]);

  const nextScreen = () => {
    if (currentScreen < welcomeScreens.length - 1) {
      setCurrentScreen(currentScreen + 1);
    } else {
      completeWelcome();
    }
  };

  const prevScreen = () => {
    if (currentScreen > 0) {
      setCurrentScreen(currentScreen - 1);
    }
  };

  const completeWelcome = () => {
    localStorage.setItem("hasSeenWelcome", "true");
    navigate("/");
  };

  const skipWelcome = () => {
    completeWelcome();
  };

  const screen = welcomeScreens[currentScreen];
  const Icon = screen.icon;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-md mx-auto shadow-2xl border-0 overflow-hidden">
        {/* Progress Bar */}
        <div className="h-1 bg-gray-200">
          <div 
            className="h-full bg-gradient-to-r from-blue-500 to-cyan-500 transition-all duration-300"
            style={{ width: `${((currentScreen + 1) / welcomeScreens.length) * 100}%` }}
          />
        </div>

        <CardContent className="p-0">
          {/* Header */}
          <div className="flex justify-between items-center p-6 pb-0">
            <div className="text-sm text-gray-500">
              {currentScreen + 1} of {welcomeScreens.length}
            </div>
            <Button variant="ghost" size="sm" onClick={skipWelcome}>
              Skip
            </Button>
          </div>

          {/* Main Content */}
          <div className="p-6 text-center space-y-6">
            {/* Icon */}
            <div className={`w-20 h-20 mx-auto rounded-full bg-gradient-to-r ${screen.gradient} flex items-center justify-center`}>
              <Icon className="w-10 h-10 text-white" />
            </div>

            {/* Text Content */}
            <div className="space-y-3">
              <h1 className="text-2xl font-bold text-gray-900">
                {screen.title}
              </h1>
              <h2 className="text-lg font-medium text-gray-600">
                {screen.subtitle}
              </h2>
              <p className="text-gray-500 leading-relaxed">
                {screen.description}
              </p>
            </div>

            {/* Illustration Placeholder */}
            <div className="w-full h-48 bg-gradient-to-br from-gray-100 to-gray-200 rounded-lg flex items-center justify-center">
              <Icon className="w-16 h-16 text-gray-400" />
            </div>
          </div>

          {/* Navigation */}
          <div className="p-6 pt-0">
            <div className="flex items-center justify-between">
              <Button
                variant="ghost"
                onClick={prevScreen}
                disabled={currentScreen === 0}
                className="flex items-center space-x-1"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Back</span>
              </Button>

              {/* Dots Indicator */}
              <div className="flex space-x-2">
                {welcomeScreens.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => setCurrentScreen(index)}
                    className={`w-2 h-2 rounded-full transition-all ${
                      index === currentScreen 
                        ? 'bg-blue-500 w-6' 
                        : 'bg-gray-300'
                    }`}
                  />
                ))}
              </div>

              <Button
                onClick={nextScreen}
                className="flex items-center space-x-1 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600"
              >
                <span>{currentScreen === welcomeScreens.length - 1 ? 'Get Started' : 'Next'}</span>
                <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
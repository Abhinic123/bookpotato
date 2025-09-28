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
import communityImage from '@assets/Screen1_1759047490095.png';
import societyImage from '@assets/Screen2_1759048930380.png';

const welcomeScreens = [
  {
    id: 1,
    title: "Welcome to BorrowBooks",
    subtitle: "Your Community Library Platform",
    description: "Connect with your neighbors and share books within your society. Discover new reads while building a stronger community.",
    icon: BookOpen,
    gradient: "from-blue-500 to-cyan-500",
    illustration: (
      <svg viewBox="0 0 200 150" className="w-32 h-24 mx-auto">
        <defs>
          <linearGradient id="bookGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#3B82F6" />
            <stop offset="100%" stopColor="#06B6D4" />
          </linearGradient>
        </defs>
        <rect x="50" y="40" width="60" height="80" rx="4" fill="url(#bookGradient)" />
        <rect x="70" y="50" width="60" height="80" rx="4" fill="#1D4ED8" />
        <rect x="90" y="60" width="60" height="80" rx="4" fill="#0EA5E9" />
        <circle cx="100" cy="25" r="15" fill="#FEF3C7" />
        <path d="M95 20 L100 30 L105 20" stroke="#F59E0B" strokeWidth="2" fill="none" />
      </svg>
    )
  },
  {
    id: 2,
    title: "Join Your Society",
    subtitle: "Connect with Your Community",
    description: "Find and join your residential society to start sharing books with your neighbors. Build lasting connections through literature.",
    icon: Users,
    gradient: "from-purple-500 to-pink-500",
    illustration: (
      <div className="w-full h-64 rounded-lg overflow-hidden bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        <img 
          src={societyImage} 
          alt="Person joining society with buildings in background" 
          className="w-full h-full object-cover"
        />
      </div>
    )
  },
  {
    id: 3,
    title: "Discover Local Books",
    subtitle: "Browse Nearby Collections",
    description: "Explore books available in your society. From bestsellers to classics, find your next great read just steps away from home.",
    icon: MapPin,
    gradient: "from-green-500 to-teal-500",
    illustration: (
      <svg viewBox="0 0 200 150" className="w-32 h-24 mx-auto">
        <defs>
          <linearGradient id="mapGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#10B981" />
            <stop offset="100%" stopColor="#14B8A6" />
          </linearGradient>
        </defs>
        <circle cx="100" cy="75" r="60" fill="url(#mapGradient)" opacity="0.3" />
        <path d="M100 45 Q110 55 100 75 Q90 55 100 45" fill="#EF4444" />
        <circle cx="100" cy="55" r="4" fill="#FFFFFF" />
        <rect x="80" y="90" width="12" height="16" fill="#3B82F6" />
        <rect x="108" y="85" width="12" height="20" fill="#8B5CF6" />
        <rect x="136" y="95" width="10" height="15" fill="#10B981" />
        <path d="M70 110 Q100 90 130 110" stroke="#6B7280" strokeWidth="2" fill="none" strokeDasharray="3,3" />
      </svg>
    )
  },
  {
    id: 4,
    title: "Earn While Sharing",
    subtitle: "Share Books, Earn Money",
    description: "Lend your books to community members and earn daily rental fees. Turn your personal library into a source of income.",
    icon: Star,
    gradient: "from-orange-500 to-red-500",
    illustration: (
      <svg viewBox="0 0 200 150" className="w-32 h-24 mx-auto">
        <defs>
          <linearGradient id="coinGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#F59E0B" />
            <stop offset="100%" stopColor="#EF4444" />
          </linearGradient>
        </defs>
        <rect x="60" y="70" width="30" height="40" rx="2" fill="#3B82F6" />
        <rect x="110" y="60" width="30" height="50" rx="2" fill="#8B5CF6" />
        <circle cx="75" cy="50" r="12" fill="url(#coinGradient)" />
        <text x="75" y="55" textAnchor="middle" fill="#FFFFFF" fontSize="8" fontWeight="bold">₹</text>
        <circle cx="125" cy="40" r="12" fill="url(#coinGradient)" />
        <text x="125" y="45" textAnchor="middle" fill="#FFFFFF" fontSize="8" fontWeight="bold">₹</text>
        <circle cx="160" cy="85" r="10" fill="#F59E0B" />
        <text x="160" y="89" textAnchor="middle" fill="#FFFFFF" fontSize="6" fontWeight="bold">₹</text>
        <path d="M75 62 L75 68" stroke="#F59E0B" strokeWidth="2" />
        <path d="M125 52 L125 58" stroke="#F59E0B" strokeWidth="2" />
      </svg>
    )
  }
];

export default function Welcome() {
  const [currentScreen, setCurrentScreen] = useState(0);
  const [, navigate] = useLocation();

  useEffect(() => {
    // Don't redirect if already on welcome page - let user see welcome screens
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
    navigate("/auth");
  };

  const skipWelcome = () => {
    localStorage.setItem("hasSeenWelcome", "true");
    navigate("/auth");
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
            {/* Illustration */}
            <div className="mb-6">
              {screen.illustration}
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

            {/* Community Illustration */}
            <div className="w-full h-64 rounded-lg overflow-hidden bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
              <img 
                src={communityImage} 
                alt="Community reading together" 
                className="w-full h-full object-cover"
              />
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
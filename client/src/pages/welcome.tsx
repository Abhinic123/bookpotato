import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowRight, BookOpen, Users, Shield, Coins } from "lucide-react";

export default function Welcome() {
  const [currentStep, setCurrentStep] = useState(0);

  const steps = [
    {
      icon: <BookOpen className="w-16 h-16 text-blue-600" />,
      title: "Share Your Books",
      description: "Upload your physical books and set daily rental fees. Use our barcode scanner to quickly add book details and make them available to your community."
    },
    {
      icon: <Users className="w-16 h-16 text-teal-600" />,
      title: "Join Communities",
      description: "Connect with readers in your society or apartment complex. Create or join societies with 90+ apartments to access a vast collection of books."
    },
    {
      icon: <Coins className="w-16 h-16 text-blue-600" />,
      title: "Earn & Save",
      description: "Lend your books to earn money and borrow others' books at affordable daily rates. Our platform takes a small commission to keep the service running."
    },
    {
      icon: <Shield className="w-16 h-16 text-teal-600" />,
      title: "Safe & Secure",
      description: "Built-in messaging, payment processing, and security deposits ensure safe transactions. Track your borrowed and lent books easily."
    }
  ];

  const nextStep = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      // Redirect to auth page
      window.location.href = "/auth";
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-teal-50 flex items-center justify-center p-4">
      <div className="w-full max-w-4xl">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Welcome to <span className="text-blue-600">BookShare</span>
          </h1>
          <p className="text-xl text-gray-600">
            Your Community-Driven Digital Library Platform
          </p>
        </div>

        <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-xl">
          <CardHeader className="text-center pb-4">
            <div className="flex justify-center mb-4">
              {steps[currentStep].icon}
            </div>
            <CardTitle className="text-2xl font-bold text-gray-900">
              {steps[currentStep].title}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-6">
            <p className="text-lg text-gray-600 leading-relaxed max-w-2xl mx-auto">
              {steps[currentStep].description}
            </p>

            {/* Progress indicators */}
            <div className="flex justify-center space-x-2">
              {steps.map((_, index) => (
                <div
                  key={index}
                  className={`w-3 h-3 rounded-full transition-colors ${
                    index === currentStep ? "bg-blue-600" : "bg-gray-300"
                  }`}
                />
              ))}
            </div>

            {/* Navigation buttons */}
            <div className="flex justify-between items-center pt-6">
              <Button
                variant="outline"
                onClick={prevStep}
                disabled={currentStep === 0}
                className="px-6"
              >
                Previous
              </Button>

              <span className="text-sm text-gray-500">
                {currentStep + 1} of {steps.length}
              </span>

              <Button
                onClick={nextStep}
                className="px-6 bg-blue-600 hover:bg-blue-700"
              >
                {currentStep === steps.length - 1 ? "Get Started" : "Next"}
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="text-center mt-8">
          <Button
            variant="link"
            onClick={() => window.location.href = "/auth"}
            className="text-blue-600 hover:text-blue-700"
          >
            Skip Introduction →
          </Button>
        </div>
      </div>
    </div>
  );
}
import { Link, useLocation } from "wouter";
import { Calendar, Users, Star, LogIn, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { logout } from "@/lib/auth";
import { useState } from "react";
import LoginModal from "@/components/modals/LoginModal";

export default function Header() {
  const [location] = useLocation();
  const { user } = useAuth();
  const [showLoginModal, setShowLoginModal] = useState(false);

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  const isActive = (path: string) => location === path;

  return (
    <>
      <nav className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <h1 className="text-xl font-bold text-gray-900">
                  <Calendar className="inline text-brand mr-2" size={20} />
                  ScheduleMaster
                </h1>
              </div>
              <div className="hidden md:block ml-10">
                <div className="flex items-baseline space-x-4">
                  <Link href="/" className={`px-3 py-2 text-sm font-medium transition-colors ${
                    isActive("/") 
                      ? "text-brand border-b-2 border-brand" 
                      : "text-gray-500 hover:text-gray-700"
                  }`}>
                    Escala
                  </Link>
                  <Link href="/employees" className={`px-3 py-2 text-sm font-medium transition-colors ${
                    isActive("/employees") 
                      ? "text-brand border-b-2 border-brand" 
                      : "text-gray-500 hover:text-gray-700"
                  }`}>
                    Funcionários
                  </Link>
                  <Link href="/holidays" className={`px-3 py-2 text-sm font-medium transition-colors ${
                    isActive("/holidays") 
                      ? "text-brand border-b-2 border-brand" 
                      : "text-gray-500 hover:text-gray-700"
                  }`}>
                    Feriados
                  </Link>
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              {user ? (
                <div className="flex items-center space-x-3">
                  <span className="text-sm text-gray-600">{user.email}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleLogout}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    <LogOut className="mr-1" size={16} />
                    Logout
                  </Button>
                </div>
              ) : (
                <Button
                  onClick={() => setShowLoginModal(true)}
                  className="bg-brand hover:bg-brand-dark text-white"
                >
                  <LogIn className="mr-2" size={16} />
                  Login Admin
                </Button>
              )}
            </div>
          </div>
        </div>
        
        {/* Mobile menu */}
        <div className="md:hidden border-t border-gray-200">
          <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3">
            <Link href="/" className={`block px-3 py-2 text-base font-medium rounded-md ${
              isActive("/") 
                ? "text-brand bg-brand/10" 
                : "text-gray-600 hover:text-gray-900"
            }`}>
              <Calendar className="inline mr-2" size={16} />
              Escala
            </Link>
            <Link href="/employees" className={`block px-3 py-2 text-base font-medium rounded-md ${
              isActive("/employees") 
                ? "text-brand bg-brand/10" 
                : "text-gray-600 hover:text-gray-900"
            }`}>
              <Users className="inline mr-2" size={16} />
              Funcionários
            </Link>
            <Link href="/holidays" className={`block px-3 py-2 text-base font-medium rounded-md ${
              isActive("/holidays") 
                ? "text-brand bg-brand/10" 
                : "text-gray-600 hover:text-gray-900"
            }`}>
              <Star className="inline mr-2" size={16} />
              Feriados
            </Link>
          </div>
        </div>
      </nav>

      {showLoginModal && (
        <LoginModal
          isOpen={showLoginModal}
          onClose={() => setShowLoginModal(false)}
        />
      )}
    </>
  );
}

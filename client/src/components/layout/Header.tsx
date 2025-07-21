// src/components/Header.tsx

import { Link, useLocation } from "wouter";
import { Calendar, Users, Star, Plane, LogIn, LogOut } from "lucide-react";
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
              {/* Logo + Title */}
              <div className="flex-shrink-0">
                <h1 className="text-xl font-bold text-gray-900 flex items-center">
                  <img
                    src="/src/img/logo_parlacom.png"
                    alt="Parlacom Logo"
                    className="inline h-6 w-6 mr-2"
                  />
                  Escala Suporte - Parlacom
                </h1>
              </div>

              {/* Desktop Nav */}
              <div className="hidden md:block ml-10">
                <div className="flex items-baseline space-x-4">
                  <Link
                    href="/"
                    className={`px-3 py-2 text-sm font-medium transition-colors flex items-center ${
                      isActive("/")
                        ? "text-brand border-b-2 border-brand"
                        : "text-gray-500 hover:text-gray-700"
                    }`}
                  >
                    <Calendar className="inline mr-1" size={16} />
                    Escala
                  </Link>
                  <Link
                    href="/employees"
                    className={`px-3 py-2 text-sm font-medium transition-colors flex items-center ${
                      isActive("/employees")
                        ? "text-brand border-b-2 border-brand"
                        : "text-gray-500 hover:text-gray-700"
                    }`}
                  >
                    <Users className="inline mr-1" size={16} />
                    Funcionários
                  </Link>
                  <Link
                    href="/holidays"
                    className={`px-3 py-2 text-sm font-medium transition-colors flex items-center ${
                      isActive("/holidays")
                        ? "text-brand border-b-2 border-brand"
                        : "text-gray-500 hover:text-gray-700"
                    }`}
                  >
                    <Star className="inline mr-1" size={16} />
                    Feriados
                  </Link>
                  <Link
                    href="/vacations"
                    className={`px-3 py-2 text-sm font-medium transition-colors flex items-center ${
                      isActive("/vacations")
                        ? "text-brand border-b-2 border-brand"
                        : "text-gray-500 hover:text-gray-700"
                    }`}
                  >
                    <Plane className="inline mr-1" size={16} />
                    Férias
                  </Link>
                </div>
              </div>
            </div>

            {/* Auth Controls */}
            <div className="flex items-center space-x-4">
              {user ? (
                <div className="flex items-center space-x-3">
                  <span className="text-sm text-gray-600">{user.email}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleLogout}
                    className="text-gray-500 hover:text-gray-700 flex items-center"
                  >
                    <LogOut className="mr-1" size={16} />
                    Logout
                  </Button>
                </div>
              ) : (
                <Button
                  onClick={() => setShowLoginModal(true)}
                  className="bg-brand hover:bg-brand-dark text-white flex items-center"
                >
                  <LogIn className="mr-2" size={16} />
                  Login Admin
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Mobile Menu */}
        <div className="md:hidden border-t border-gray-200">
          <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3">
            <Link
              href="/"
              className={`block px-3 py-2 text-base font-medium rounded-md flex items-center ${
                isActive("/")
                  ? "text-brand bg-brand/10"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              <Calendar className="inline mr-2" size={18} />
              Escala
            </Link>
            <Link
              href="/employees"
              className={`block px-3 py-2 text-base font-medium rounded-md flex items-center ${
                isActive("/employees")
                  ? "text-brand bg-brand/10"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              <Users className="inline mr-2" size={18} />
              Funcionários
            </Link>
            <Link
              href="/holidays"
              className={`block px-3 py-2 text-base font-medium rounded-md flex items-center ${
                isActive("/holidays")
                  ? "text-brand bg-brand/10"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              <Star className="inline mr-2" size={18} />
              Feriados
            </Link>
            <Link
              href="/vacations"
              className={`block px-3 py-2 text-base font-medium rounded-md flex items-center ${
                isActive("/vacations")
                  ? "text-brand bg-brand/10"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              <Plane className="inline mr-2" size={18} />
              Férias
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

import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useState, useEffect } from 'react';

function Navbar() {
  const { user, isAuthenticated, logout } = useAuth();
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Cerrar menú móvil al cambiar de ruta
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [window.location.pathname]);

  return (
    <nav 
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isScrolled 
          ? 'bg-black w-full' 
          : 'bg-white w-full md:w-[95%] md:mx-auto md:mt-4 md:rounded-sm md:shadow-lg'
      }`}
    >
      <div className={`transition-all duration-300 ${
        isScrolled ? 'max-w-full px-4 md:px-8' : 'max-w-7xl mx-auto px-4 md:px-8'
      }`}>
        <div className="flex justify-between items-center py-3 md:py-4">
          {/* Logo */}
          <Link 
            to="/" 
            className={`text-lg md:text-2xl font-black tracking-wider transition-colors duration-300 ${
              isScrolled ? 'text-white' : 'text-black'
            }`}
          >
            NBA ANALYTICS
          </Link>
          
          {/* Desktop Menu */}
          <div className="hidden lg:flex items-center space-x-6 xl:space-x-8">
            <Link 
              to="/" 
              className={`text-xs xl:text-sm font-bold uppercase tracking-widest transition-colors duration-300 hover:text-red-600 ${
                isScrolled ? 'text-gray-200' : 'text-gray-800'
              }`}
            >
              Dashboard
            </Link>
            <Link 
              to="/teams" 
              className={`text-xs xl:text-sm font-bold uppercase tracking-widest transition-colors duration-300 hover:text-red-600 ${
                isScrolled ? 'text-gray-200' : 'text-gray-800'
              }`}
            >
              Teams
            </Link>
            <Link 
              to="/players" 
              className={`text-xs xl:text-sm font-bold uppercase tracking-widest transition-colors duration-300 hover:text-red-600 ${
                isScrolled ? 'text-gray-200' : 'text-gray-800'
              }`}
            >
              Players
            </Link>
            <Link 
              to="/games" 
              className={`text-xs xl:text-sm font-bold uppercase tracking-widest transition-colors duration-300 hover:text-red-600 ${
                isScrolled ? 'text-gray-200' : 'text-gray-800'
              }`}
            >
              Games
            </Link>
            
            {isAuthenticated && (
              <Link 
                to="/predictions" 
                className={`text-xs xl:text-sm font-bold uppercase tracking-widest transition-colors duration-300 hover:text-red-600 ${
                  isScrolled ? 'text-gray-200' : 'text-gray-800'
                }`}
              >
                PREDICCIONES
              </Link>
            )}
            
            {isAuthenticated ? (
              <>
                <Link 
                  to="/profile" 
                  className={`flex items-center space-x-2 text-xs xl:text-sm font-bold uppercase tracking-widest transition-colors duration-300 hover:text-red-600 ${
                    isScrolled ? 'text-gray-200' : 'text-gray-800'
                  }`}
                >
                  {user?.picture && (
                    <img
                      src={user.picture}
                      alt={user.name}
                      className="w-6 h-6 md:w-8 md:h-8 rounded-full border-2 border-red-600"
                    />
                  )}
                  <span className="hidden xl:inline">{user?.name || 'Perfil'}</span>
                </Link>
                <button
                  onClick={logout}
                  className={`px-4 xl:px-6 py-2 text-xs font-black uppercase tracking-widest transition-all duration-200 ${
                    isScrolled 
                      ? 'bg-red-600 text-white hover:bg-red-700' 
                      : 'bg-black text-white hover:bg-red-600'
                  }`}
                >
                  Salir
                </button>
              </>
            ) : (
              <Link
                to="/login"
                className={`px-4 xl:px-6 py-2 text-xs font-black uppercase tracking-widest transition-all duration-200 ${
                  isScrolled 
                    ? 'bg-red-600 text-white hover:bg-red-700' 
                    : 'bg-black text-white hover:bg-red-600'
                }`}
              >
                Entrar
              </Link>
            )}
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className={`lg:hidden p-2 transition-colors ${
              isScrolled ? 'text-white' : 'text-black'
            }`}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {isMobileMenuOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>

        {/* Mobile Menu */}
        {isMobileMenuOpen && (
          <div className="lg:hidden pb-4 border-t border-gray-200">
            <div className="flex flex-col space-y-3 pt-4">
              <Link 
                to="/" 
                onClick={() => setIsMobileMenuOpen(false)}
                className={`text-sm font-bold uppercase tracking-widest transition-colors duration-300 hover:text-red-600 py-2 ${
                  isScrolled ? 'text-gray-200' : 'text-gray-800'
                }`}
              >
                Dashboard
              </Link>
              <Link 
                to="/teams" 
                onClick={() => setIsMobileMenuOpen(false)}
                className={`text-sm font-bold uppercase tracking-widest transition-colors duration-300 hover:text-red-600 py-2 ${
                  isScrolled ? 'text-gray-200' : 'text-gray-800'
                }`}
              >
                Teams
              </Link>
              <Link 
                to="/players" 
                onClick={() => setIsMobileMenuOpen(false)}
                className={`text-sm font-bold uppercase tracking-widest transition-colors duration-300 hover:text-red-600 py-2 ${
                  isScrolled ? 'text-gray-200' : 'text-gray-800'
                }`}
              >
                Players
              </Link>
              <Link 
                to="/games" 
                onClick={() => setIsMobileMenuOpen(false)}
                className={`text-sm font-bold uppercase tracking-widest transition-colors duration-300 hover:text-red-600 py-2 ${
                  isScrolled ? 'text-gray-200' : 'text-gray-800'
                }`}
              >
                Games
              </Link>
              
              {isAuthenticated && (
                <Link 
                  to="/predictions" 
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={`text-sm font-bold uppercase tracking-widest transition-colors duration-300 hover:text-red-600 py-2 ${
                    isScrolled ? 'text-gray-200' : 'text-gray-800'
                  }`}
                >
                  PREDICCIONES
                </Link>
              )}
              
              {isAuthenticated ? (
                <>
                  <Link 
                    to="/profile" 
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={`flex items-center space-x-2 text-sm font-bold uppercase tracking-widest transition-colors duration-300 hover:text-red-600 py-2 ${
                      isScrolled ? 'text-gray-200' : 'text-gray-800'
                    }`}
                  >
                    {user?.picture && (
                      <img
                        src={user.picture}
                        alt={user.name}
                        className="w-6 h-6 rounded-full border-2 border-red-600"
                      />
                    )}
                    <span>{user?.name || 'Perfil'}</span>
                  </Link>
                  <button
                    onClick={() => {
                      logout();
                      setIsMobileMenuOpen(false);
                    }}
                    className={`text-left px-4 py-2 text-sm font-black uppercase tracking-widest transition-all duration-200 ${
                      isScrolled 
                        ? 'bg-red-600 text-white hover:bg-red-700' 
                        : 'bg-black text-white hover:bg-red-600'
                    }`}
                  >
                    Salir
                  </button>
                </>
              ) : (
                <Link
                  to="/login"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={`text-center px-4 py-2 text-sm font-black uppercase tracking-widest transition-all duration-200 ${
                    isScrolled 
                      ? 'bg-red-600 text-white hover:bg-red-700' 
                      : 'bg-black text-white hover:bg-red-600'
                  }`}
                >
                  Entrar
                </Link>
              )}
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}

export default Navbar;
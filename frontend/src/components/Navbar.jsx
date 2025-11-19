import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useState, useEffect } from 'react';

function Navbar() {
  const { user, isAuthenticated, logout } = useAuth();
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <nav 
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isScrolled 
          ? 'bg-black w-full' 
          : 'bg-white w-[95%] mx-auto mt-4 rounded-sm shadow-lg'
      }`}
    >
      <div className={`transition-all duration-300 ${
        isScrolled ? 'max-w-full px-8' : 'max-w-7xl mx-auto px-8'
      }`}>
        <div className="flex justify-between items-center py-4">
          <Link 
            to="/" 
            className={`text-2xl font-black tracking-wider transition-colors duration-300 ${
              isScrolled ? 'text-white' : 'text-black'
            }`}
          >
            NBA ANALYTICS
          </Link>
          
          <div className="flex items-center space-x-8">
            <Link 
              to="/" 
              className={`text-sm font-bold uppercase tracking-widest transition-colors duration-300 hover:text-red-600 ${
                isScrolled ? 'text-gray-200' : 'text-gray-800'
              }`}
            >
              Dashboard
            </Link>
            <Link 
              to="/teams" 
              className={`text-sm font-bold uppercase tracking-widest transition-colors duration-300 hover:text-red-600 ${
                isScrolled ? 'text-gray-200' : 'text-gray-800'
              }`}
            >
              Teams
            </Link>
            <Link 
              to="/players" 
              className={`text-sm font-bold uppercase tracking-widest transition-colors duration-300 hover:text-red-600 ${
                isScrolled ? 'text-gray-200' : 'text-gray-800'
              }`}
            >
              Players
            </Link>
            <Link 
              to="/games" 
              className={`text-sm font-bold uppercase tracking-widest transition-colors duration-300 hover:text-red-600 ${
                isScrolled ? 'text-gray-200' : 'text-gray-800'
              }`}
            >
              Games
            </Link>
            
            {isAuthenticated && (
              <Link 
                to="/predictions" 
                className={`text-sm font-bold uppercase tracking-widest transition-colors duration-300 hover:text-red-600 ${
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
                  className={`flex items-center space-x-2 text-sm font-bold uppercase tracking-widest transition-colors duration-300 hover:text-red-600 ${
                    isScrolled ? 'text-gray-200' : 'text-gray-800'
                  }`}
                >
                  {user?.picture && (
                    <img
                      src={user.picture}
                      alt={user.name}
                      className="w-8 h-8 rounded-full border-2 border-red-600"
                    />
                  )}
                  <span>{user?.name || 'Perfil'}</span>
                </Link>
                <button
                  onClick={logout}
                  className={`px-6 py-2 text-xs font-black uppercase tracking-widest transition-all duration-200 ${
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
                className={`px-6 py-2 text-xs font-black uppercase tracking-widest transition-all duration-200 ${
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
      </div>
    </nav>
  );
}

export default Navbar;
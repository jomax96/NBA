import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

function Navbar() {
  const { user, isAuthenticated, logout } = useAuth();

  return (
    <nav className="bg-blue-600 text-white shadow-lg">
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center py-4">
          <Link to="/" className="text-2xl font-bold">
            NBA Analytics Hub
          </Link>
          <div className="flex items-center space-x-4">
            <Link to="/" className="hover:text-blue-200 transition">Dashboard</Link>
            <Link to="/teams" className="hover:text-blue-200 transition">Equipos</Link>
            <Link to="/players" className="hover:text-blue-200 transition">Jugadores</Link>
            <Link to="/games" className="hover:text-blue-200 transition">Partidos</Link>
            
            {/* Solo usuarios autenticados pueden ver Predictions */}
            {isAuthenticated && (
              <Link to="/predictions" className="hover:text-blue-200 transition">Predicciones</Link>
            )}
            
            {isAuthenticated ? (
              <>
                <Link to="/profile" className="hover:text-blue-200 transition flex items-center space-x-2">
                  {user?.picture && (
                    <img
                      src={user.picture}
                      alt={user.name}
                      className="w-8 h-8 rounded-full border-2 border-white"
                    />
                  )}
                  <span>{user?.name || 'Perfil'}</span>
                </Link>
                <button
                  onClick={logout}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded transition"
                >
                  Cerrar Sesión
                </button>
              </>
            ) : (
              <Link
                to="/login"
                className="px-4 py-2 bg-blue-700 hover:bg-blue-800 rounded transition"
              >
                Iniciar Sesión
              </Link>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}

export default Navbar;


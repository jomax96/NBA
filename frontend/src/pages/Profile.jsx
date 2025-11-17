import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';

function Profile() {
  const { user, logout } = useAuth();
  const [favorites, setFavorites] = useState([]);
  const [searchHistory, setSearchHistory] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('profile');

  useEffect(() => {
    if (user) {
      fetchUserData();
    }
  }, [user]);

  const fetchUserData = async () => {
    try {
      const [favoritesRes, historyRes, alertsRes] = await Promise.all([
        axios.get('users/favorites').catch(() => ({ data: { data: [] } })),
        axios.get('users/search-history?limit=20').catch(() => ({ data: { data: [] } })),
        axios.get('users/alerts').catch(() => ({ data: { data: [] } }))
      ]);

      setFavorites(favoritesRes.data.data || []);
      setSearchHistory(historyRes.data.data || []);
      setAlerts(alertsRes.data.data || []);
    } catch (error) {
      console.error('Error fetching user data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-blue-800 px-6 py-8 text-white">
            <div className="flex items-center space-x-4">
              {user?.picture && (
                <img
                  src={user.picture}
                  alt={user.name}
                  className="w-20 h-20 rounded-full border-4 border-white"
                />
              )}
              <div>
                <h1 className="text-3xl font-bold">{user?.name || 'Usuario'}</h1>
                <p className="text-blue-100">{user?.email}</p>
                <p className="text-sm text-blue-200 mt-1">
                  Autenticado con {user?.provider === 'google' ? 'Google' : 'Email/Password'}
                </p>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="border-b border-gray-200">
            <nav className="flex -mb-px">
              <button
                onClick={() => setActiveTab('profile')}
                className={`px-6 py-4 text-sm font-medium ${activeTab === 'profile'
                  ? 'border-b-2 border-blue-600 text-blue-600'
                  : 'text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
              >
                Perfil
              </button>
              <button
                onClick={() => setActiveTab('favorites')}
                className={`px-6 py-4 text-sm font-medium ${activeTab === 'favorites'
                  ? 'border-b-2 border-blue-600 text-blue-600'
                  : 'text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
              >
                Favoritos ({favorites.length})
              </button>
              <button
                onClick={() => setActiveTab('history')}
                className={`px-6 py-4 text-sm font-medium ${activeTab === 'history'
                  ? 'border-b-2 border-blue-600 text-blue-600'
                  : 'text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
              >
                Historial ({searchHistory.length})
              </button>
              <button
                onClick={() => setActiveTab('alerts')}
                className={`px-6 py-4 text-sm font-medium ${activeTab === 'alerts'
                  ? 'border-b-2 border-blue-600 text-blue-600'
                  : 'text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
              >
                Alertas ({alerts.length})
              </button>
            </nav>
          </div>

          {/* Content */}
          <div className="p-6">
            {activeTab === 'profile' && (
              <div>
                <h2 className="text-2xl font-semibold mb-4">Información del Perfil</h2>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Nombre</label>
                    <p className="mt-1 text-gray-900">{user?.name || 'N/A'}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Email</label>
                    <p className="mt-1 text-gray-900">{user?.email}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Método de Autenticación</label>
                    <p className="mt-1 text-gray-900 capitalize">
                      {user?.provider === 'google' ? 'Google OAuth' : 'Email/Password'}
                    </p>
                  </div>
                  <div className="pt-4">
                    <button
                      onClick={logout}
                      className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
                    >
                      Cerrar Sesión
                    </button>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'favorites' && (
              <div>
                <h2 className="text-2xl font-semibold mb-4">Mis Favoritos</h2>
                {favorites.length === 0 ? (
                  <p className="text-gray-500">No tienes favoritos aún.</p>
                ) : (
                  <div className="space-y-2">
                    {favorites.map((fav, index) => (
                      <div key={index} className="p-4 border rounded-lg">
                        <p className="font-medium">{fav.favoriteType}: {fav.favoriteId}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'history' && (
              <div>
                <h2 className="text-2xl font-semibold mb-4">Historial de Búsquedas</h2>
                {searchHistory.length === 0 ? (
                  <p className="text-gray-500">No hay búsquedas recientes.</p>
                ) : (
                  <div className="space-y-2">
                    {searchHistory.map((item, index) => (
                      <div key={index} className="p-4 border rounded-lg">
                        <p className="text-sm text-gray-500">
                          {new Date(item.timestamp).toLocaleString()}
                        </p>
                        <p className="font-medium">
                          {JSON.stringify(item.query)}
                        </p>
                        <p className="text-sm text-gray-600">
                          {item.resultsCount} resultados
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'alerts' && (
              <div>
                <h2 className="text-2xl font-semibold mb-4">Mis Alertas</h2>
                {alerts.length === 0 ? (
                  <p className="text-gray-500">No tienes alertas configuradas.</p>
                ) : (
                  <div className="space-y-2">
                    {alerts.map((alert, index) => (
                      <div key={index} className="p-4 border rounded-lg">
                        <p className="font-medium">{alert.type}: {alert.condition}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default Profile;


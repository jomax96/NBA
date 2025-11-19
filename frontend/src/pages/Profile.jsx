import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';

function Profile() {
  const { user, logout } = useAuth();
  const [favorites, setFavorites] = useState([]);
  const [favoritesDetails, setFavoritesDetails] = useState({ teams: [], players: [] });
  const [searchHistory, setSearchHistory] = useState([]);
  const [searchHistoryDetails, setSearchHistoryDetails] = useState([]);
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

      const favs = favoritesRes.data.data || [];
      const history = historyRes.data.data || [];

      setFavorites(favs);
      setSearchHistory(history);
      setAlerts(alertsRes.data.data || []);

      // Obtener detalles de favoritos
      await fetchFavoritesDetails(favs);

      // Obtener detalles del historial
      await fetchSearchHistoryDetails(history);
    } catch (error) {
      console.error('Error fetching user data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchFavoritesDetails = async (favs) => {
    try {
      const teamFavs = favs.filter(f => f.favoriteType === 'team');
      const playerFavs = favs.filter(f => f.favoriteType === 'player');

      // Fetch team details
      const teamsPromises = teamFavs.map(async (fav) => {
        try {
          const response = await axios.get(`teams/${fav.favoriteId}`);
          return {
            id: fav.favoriteId,
            ...response.data.data,
            _favId: fav._id
          };
        } catch (error) {
          console.error(`Error fetching team ${fav.favoriteId}:`, error);
          return {
            id: fav.favoriteId,
            full_name: `Team ID: ${fav.favoriteId}`,
            _favId: fav._id
          };
        }
      });

      // Fetch player details
      const playersPromises = playerFavs.map(async (fav) => {
        try {
          const response = await axios.get(`players/${fav.favoriteId}`);
          return {
            id: fav.favoriteId,
            ...response.data.data,
            _favId: fav._id
          };
        } catch (error) {
          console.error(`Error fetching player ${fav.favoriteId}:`, error);
          return {
            id: fav.favoriteId,
            player_name: `Player ID: ${fav.favoriteId}`,
            _favId: fav._id
          };
        }
      });

      const [teams, players] = await Promise.all([
        Promise.all(teamsPromises),
        Promise.all(playersPromises)
      ]);

      setFavoritesDetails({ teams, players });
    } catch (error) {
      console.error('Error fetching favorites details:', error);
    }
  };

  const fetchSearchHistoryDetails = async (history) => {
    try {
      const detailsPromises = history.map(async (item) => {
        try {
          // Parsear la query si es un string JSON
          let query = item.query;
          if (typeof query === 'string') {
            try {
              query = JSON.parse(query);
            } catch {
              // Si no es JSON válido, mantenerlo como está
            }
          }

          // Si la query tiene homeTeamId y awayTeamId, obtener los nombres de los equipos
          if (query?.homeTeamId && query?.awayTeamId) {
            const [homeTeam, awayTeam] = await Promise.all([
              axios.get(`teams/${query.homeTeamId}`).catch(() => null),
              axios.get(`teams/${query.awayTeamId}`).catch(() => null)
            ]);

            return {
              ...item,
              type: 'game_search',
              homeTeam: homeTeam?.data?.data || { full_name: `Team ${query.homeTeamId}` },
              awayTeam: awayTeam?.data?.data || { full_name: `Team ${query.awayTeamId}` },
              limit: query.limit || 10
            };
          }

          // Si la query tiene searchTerm (búsqueda de jugadores)
          if (query?.searchTerm || typeof query === 'string') {
            return {
              ...item,
              type: 'player_search',
              searchTerm: query.searchTerm || query
            };
          }

          // Tipo desconocido
          return {
            ...item,
            type: 'unknown',
            query
          };
        } catch (error) {
          console.error('Error processing history item:', error);
          return {
            ...item,
            type: 'unknown',
            query: item.query
          };
        }
      });

      const details = await Promise.all(detailsPromises);
      setSearchHistoryDetails(details);
    } catch (error) {
      console.error('Error fetching search history details:', error);
    }
  };

  const removeFavorite = async (type, id) => {
    try {
      await axios.post('users/favorites', {
        type,
        id: id.toString(),
        action: 'remove'
      });

      // Actualizar estado local
      setFavorites(favorites.filter(f => !(f.favoriteType === type && f.favoriteId === id)));

      // Actualizar detalles
      if (type === 'team') {
        setFavoritesDetails(prev => ({
          ...prev,
          teams: prev.teams.filter(t => t.id !== id)
        }));
      } else {
        setFavoritesDetails(prev => ({
          ...prev,
          players: prev.players.filter(p => p.id !== id)
        }));
      }
    } catch (error) {
      console.error('Error removing favorite:', error);
      alert('Error al eliminar favorito');
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
                  <div className="text-center py-8">
                    <p className="text-gray-500 mb-2">No tienes favoritos aún.</p>
                    <p className="text-sm text-gray-400">Explora equipos y jugadores para agregar favoritos</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Equipos Favoritos */}
                    {favoritesDetails.teams.length > 0 && (
                      <div>
                        <h3 className="text-lg font-semibold mb-3 flex items-center">
                          <span className="mr-2">🏀</span>
                          Equipos ({favoritesDetails.teams.length})
                        </h3>
                        <div className="space-y-2">
                          {favoritesDetails.teams.map((team) => (
                            <div
                              key={team.id}
                              className="p-4 border rounded-lg hover:bg-gray-50 flex justify-between items-center"
                            >
                              <div>
                                <p className="font-medium text-lg">{team.full_name}</p>
                                <p className="text-sm text-gray-600">
                                  {team.city}{team.state ? `, ${team.state}` : ''} • {team.abbreviation}
                                </p>
                              </div>
                              <button
                                onClick={() => removeFavorite('team', team.id)}
                                className="text-red-500 hover:text-red-700 px-3 py-1 rounded hover:bg-red-50"
                                title="Eliminar de favoritos"
                              >
                                🗑️ Eliminar
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Jugadores Favoritos */}
                    {favoritesDetails.players.length > 0 && (
                      <div>
                        <h3 className="text-lg font-semibold mb-3 flex items-center">
                          <span className="mr-2">⭐</span>
                          Jugadores ({favoritesDetails.players.length})
                        </h3>
                        <div className="space-y-2">
                          {favoritesDetails.players.map((player) => (
                            <div
                              key={player.id}
                              className="p-4 border rounded-lg hover:bg-gray-50 flex justify-between items-center"
                            >
                              <div>
                                <p className="font-medium text-lg">{player.player_name}</p>
                                <p className="text-sm text-gray-600">
                                  {player.position && <span className="mr-2">{player.position}</span>}
                                  {player.team_name && <span>• {player.team_name}</span>}
                                </p>
                              </div>
                              <button
                                onClick={() => removeFavorite('player', player.id)}
                                className="text-red-500 hover:text-red-700 px-3 py-1 rounded hover:bg-red-50"
                                title="Eliminar de favoritos"
                              >
                                🗑️ Eliminar
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'history' && (
              <div>
                <h2 className="text-2xl font-semibold mb-4">Historial de Búsquedas</h2>
                {searchHistoryDetails.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-gray-500 mb-2">No hay búsquedas recientes.</p>
                    <p className="text-sm text-gray-400">Tu historial aparecerá aquí después de buscar</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {searchHistoryDetails.map((item, index) => (
                      <div key={index} className="p-4 border rounded-lg hover:bg-gray-50">
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex-1">
                            {item.type === 'game_search' ? (
                              <div>
                                <div className="flex items-center mb-2">
                                  <span className="text-lg mr-2">🏀</span>
                                  <h3 className="font-semibold text-gray-900">Búsqueda de Partidos</h3>
                                </div>
                                <div className="ml-7 space-y-1">
                                  <p className="text-gray-700">
                                    <span className="font-medium">{item.homeTeam?.full_name || 'Equipo Local'}</span>
                                    {' vs '}
                                    <span className="font-medium">{item.awayTeam?.full_name || 'Equipo Visitante'}</span>
                                  </p>
                                  <p className="text-sm text-gray-500">
                                    Límite: {item.limit}
                                  </p>
                                </div>
                              </div>
                            ) : item.type === 'player_search' ? (
                              <div>
                                <div className="flex items-center mb-2">
                                  <span className="text-lg mr-2">👤</span>
                                  <h3 className="font-semibold text-gray-900">Búsqueda de Jugador</h3>
                                </div>
                                <div className="ml-7">
                                  <p className="text-gray-700">
                                    Término: <span className="font-medium">{item.searchTerm}</span>
                                  </p>
                                </div>
                              </div>
                            ) : (
                              <div>
                                <div className="flex items-center mb-2">
                                  <span className="text-lg mr-2">🔍</span>
                                  <h3 className="font-semibold text-gray-900">Búsqueda</h3>
                                </div>
                                <div className="ml-7">
                                  <p className="text-sm text-gray-600 font-mono bg-gray-100 p-2 rounded">
                                    {typeof item.query === 'string'
                                      ? item.query
                                      : JSON.stringify(item.query, null, 2)}
                                  </p>
                                </div>
                              </div>
                            )}
                          </div>
                          <div className="text-right ml-4">
                            <p className="text-xs text-gray-500">
                              {new Date(item.timestamp).toLocaleDateString('es-ES', {
                                day: '2-digit',
                                month: 'short',
                                year: 'numeric'
                              })}
                            </p>
                            <p className="text-xs text-gray-400">
                              {new Date(item.timestamp).toLocaleTimeString('es-ES', {
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </p>
                          </div>
                        </div>
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
                  <div className="text-center py-8">
                    <p className="text-gray-500 mb-2">No tienes alertas configuradas.</p>
                    <p className="text-sm text-gray-400">Las alertas te notificarán sobre eventos importantes</p>
                  </div>
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
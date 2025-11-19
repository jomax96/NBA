import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';

function Profile() {
  const { user, logout } = useAuth();
  const [favorites, setFavorites] = useState([]);
  const [favoritesDetails, setFavoritesDetails] = useState({ teams: [], players: [] });
  const [searchHistory, setSearchHistory] = useState([]);
  const [searchHistoryDetails, setSearchHistoryDetails] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('profile');

  useEffect(() => {
    if (user) {
      fetchUserData();
    }
  }, [user]);

  const fetchUserData = async () => {
    try {
      const [favoritesRes, historyRes, notificationsRes] = await Promise.all([
        axios.get('users/favorites').catch(() => ({ data: { data: [] } })),
        axios.get('users/search-history?limit=20').catch(() => ({ data: { data: [] } })),
        axios.get('users/notifications?limit=50').catch(() => ({ data: { data: [] } }))
      ]);

      const favs = favoritesRes.data.data || [];
      const history = historyRes.data.data || [];

      setFavorites(favs);
      setSearchHistory(history);
      setNotifications(notificationsRes.data.data || []);

      await fetchFavoritesDetails(favs);
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

      const teamsPromises = teamFavs.map(async (fav) => {
        try {
          const response = await axios.get(`teams/${fav.favoriteId}`);
          return { id: fav.favoriteId, ...response.data.data, _favId: fav._id };
        } catch (error) {
          return { id: fav.favoriteId, full_name: `Team ID: ${fav.favoriteId}`, _favId: fav._id };
        }
      });

      const playersPromises = playerFavs.map(async (fav) => {
        try {
          const response = await axios.get(`players/${fav.favoriteId}`);
          return { id: fav.favoriteId, ...response.data.data, _favId: fav._id };
        } catch (error) {
          return { id: fav.favoriteId, player_name: `Player ID: ${fav.favoriteId}`, _favId: fav._id };
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
          let query = item.query;
          if (typeof query === 'string') {
            try {
              query = JSON.parse(query);
            } catch {
              // Keep as is
            }
          }

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

          if (query?.searchTerm || typeof query === 'string') {
            return {
              ...item,
              type: 'player_search',
              searchTerm: query.searchTerm || query
            };
          }

          return { ...item, type: 'unknown', query };
        } catch (error) {
          return { ...item, type: 'unknown', query: item.query };
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

      setFavorites(favorites.filter(f => !(f.favoriteType === type && f.favoriteId === id)));

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

  const formatNotificationType = (type) => {
    const typeMap = {
      'auth.login': { label: 'Inicio de Sesión', color: 'blue' },
      'auth.register': { label: 'Registro', color: 'green' },
      'auth.logout': { label: 'Cierre de Sesión', color: 'gray' },
      'favorite.added': { label: 'Favorito Agregado', color: 'yellow' },
      'favorite.removed': { label: 'Favorito Eliminado', color: 'red' },
    };
    return typeMap[type] || { label: type, color: 'gray' };
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center pt-24">
        <div className="text-white text-2xl font-black uppercase tracking-widest">Cargando...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black pt-24 pb-16">
      <div className="max-w-7xl mx-auto px-8">
        <div className="bg-white">
          {/* Header */}
          <div className="bg-black px-8 py-8 border-b-4 border-red-600">
            <div className="flex items-center space-x-6">
              {user?.picture && (
                <img
                  src={user.picture}
                  alt={user.name}
                  className="w-20 h-20 border-4 border-red-600"
                />
              )}
              <div>
                <h1 className="text-4xl font-black text-white uppercase tracking-wider">
                  {user?.name || 'Usuario'}
                </h1>
                <p className="text-gray-400 font-bold uppercase tracking-wider text-sm mt-1">
                  {user?.email}
                </p>
                <p className="text-gray-500 uppercase tracking-wider text-xs mt-1">
                  {user?.provider === 'google' ? 'Google' : 'Email/Password'}
                </p>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="border-b-2 border-gray-200">
            <nav className="flex">
              <button
                onClick={() => setActiveTab('profile')}
                className={`px-8 py-4 text-xs font-black uppercase tracking-widest ${
                  activeTab === 'profile'
                    ? 'border-b-4 border-red-600 text-black'
                    : 'text-gray-500 hover:text-black'
                }`}
              >
                Perfil
              </button>
              <button
                onClick={() => setActiveTab('favorites')}
                className={`px-8 py-4 text-xs font-black uppercase tracking-widest ${
                  activeTab === 'favorites'
                    ? 'border-b-4 border-red-600 text-black'
                    : 'text-gray-500 hover:text-black'
                }`}
              >
                Favoritos ({favorites.length})
              </button>
              <button
                onClick={() => setActiveTab('history')}
                className={`px-8 py-4 text-xs font-black uppercase tracking-widest ${
                  activeTab === 'history'
                    ? 'border-b-4 border-red-600 text-black'
                    : 'text-gray-500 hover:text-black'
                }`}
              >
                Historial ({searchHistory.length})
              </button>
              <button
                onClick={() => setActiveTab('notifications')}
                className={`px-8 py-4 text-xs font-black uppercase tracking-widest ${
                  activeTab === 'notifications'
                    ? 'border-b-4 border-red-600 text-black'
                    : 'text-gray-500 hover:text-black'
                }`}
              >
                Notificaciones ({notifications.length})
              </button>
            </nav>
          </div>

          {/* Content */}
          <div className="p-8">
            {activeTab === 'profile' && (
              <div className="space-y-6">
                <div>
                  <label className="block text-xs font-black uppercase tracking-widest text-gray-500 mb-2">
                    Nombre
                  </label>
                  <p className="text-xl font-bold text-black">{user?.name || 'N/A'}</p>
                </div>
                <div>
                  <label className="block text-xs font-black uppercase tracking-widest text-gray-500 mb-2">
                    Email
                  </label>
                  <p className="text-xl font-bold text-black">{user?.email}</p>
                </div>
                <div>
                  <label className="block text-xs font-black uppercase tracking-widest text-gray-500 mb-2">
                    Autenticación
                  </label>
                  <p className="text-xl font-bold text-black uppercase">
                    {user?.provider === 'google' ? 'Google OAuth' : 'Email/Password'}
                  </p>
                </div>
                <div className="pt-6 border-t-2 border-gray-200">
                  <button
                    onClick={logout}
                    className="px-8 py-3 bg-black text-white font-black uppercase tracking-widest hover:bg-red-600 transition-colors"
                  >
                    Cerrar Sesión
                  </button>
                </div>
              </div>
            )}

            {activeTab === 'favorites' && (
              <div>
                {favorites.length === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-gray-400 font-bold uppercase tracking-wider">
                      No tienes favoritos
                    </p>
                  </div>
                ) : (
                  <div className="space-y-8">
                    {favoritesDetails.teams.length > 0 && (
                      <div>
                        <h3 className="text-xl font-black uppercase tracking-wider text-black mb-4 pb-2 border-b-2 border-red-600">
                          Equipos ({favoritesDetails.teams.length})
                        </h3>
                        <div className="space-y-2">
                          {favoritesDetails.teams.map((team) => (
                            <div
                              key={team.id}
                              className="p-4 border-2 border-gray-200 hover:border-red-600 flex justify-between items-center transition-colors"
                            >
                              <div>
                                <p className="font-black text-xl text-black uppercase">
                                  {team.full_name}
                                </p>
                                <p className="text-sm text-gray-500 font-bold uppercase tracking-wider">
                                  {team.city} • {team.abbreviation}
                                </p>
                              </div>
                              <button
                                onClick={() => removeFavorite('team', team.id)}
                                className="px-4 py-2 text-xs font-black uppercase tracking-wider text-red-600 hover:bg-red-600 hover:text-white transition-colors"
                              >
                                Eliminar
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {favoritesDetails.players.length > 0 && (
                      <div>
                        <h3 className="text-xl font-black uppercase tracking-wider text-black mb-4 pb-2 border-b-2 border-red-600">
                          Jugadores ({favoritesDetails.players.length})
                        </h3>
                        <div className="space-y-2">
                          {favoritesDetails.players.map((player) => (
                            <div
                              key={player.id}
                              className="p-4 border-2 border-gray-200 hover:border-red-600 flex justify-between items-center transition-colors"
                            >
                              <div>
                                <p className="font-black text-xl text-black uppercase">
                                  {player.player_name}
                                </p>
                                <p className="text-sm text-gray-500 font-bold uppercase tracking-wider">
                                  {player.position && <span>{player.position}</span>}
                                  {player.team_name && <span> • {player.team_name}</span>}
                                </p>
                              </div>
                              <button
                                onClick={() => removeFavorite('player', player.id)}
                                className="px-4 py-2 text-xs font-black uppercase tracking-wider text-red-600 hover:bg-red-600 hover:text-white transition-colors"
                              >
                                Eliminar
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
                {searchHistoryDetails.length === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-gray-400 font-bold uppercase tracking-wider">
                      No hay búsquedas recientes
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {searchHistoryDetails.map((item, index) => (
                      <div key={index} className="p-4 border-2 border-gray-200 hover:border-red-600 transition-colors">
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            {item.type === 'game_search' ? (
                              <div>
                                <h3 className="font-black text-black uppercase mb-2">
                                  Búsqueda de Partidos
                                </h3>
                                <p className="text-sm text-gray-600 font-bold">
                                  {item.homeTeam?.full_name || 'Equipo Local'} vs{' '}
                                  {item.awayTeam?.full_name || 'Equipo Visitante'}
                                </p>
                              </div>
                            ) : item.type === 'player_search' ? (
                              <div>
                                <h3 className="font-black text-black uppercase mb-2">
                                  Búsqueda de Jugador
                                </h3>
                                <p className="text-sm text-gray-600 font-bold">
                                  {item.searchTerm}
                                </p>
                              </div>
                            ) : (
                              <div>
                                <h3 className="font-black text-black uppercase mb-2">
                                  Búsqueda
                                </h3>
                              </div>
                            )}
                          </div>
                          <div className="text-right ml-4">
                            <p className="text-xs text-gray-500 font-bold">
                              {new Date(item.timestamp).toLocaleDateString('es-ES')}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'notifications' && (
              <div>
                {notifications.length === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-gray-400 font-bold uppercase tracking-wider">
                      No hay notificaciones
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {notifications.map((notification) => {
                      const typeInfo = formatNotificationType(notification.type);
                      return (
                        <div
                          key={notification._id}
                          className="p-4 border-2 border-gray-200 hover:border-red-600 transition-colors"
                        >
                          <div className="flex justify-between items-start">
                            <div>
                              <h3 className="font-black text-black uppercase mb-2">
                                {typeInfo.label}
                              </h3>
                              <p className="text-xs text-gray-500 uppercase tracking-wider">
                                {notification.status === 'sent' ? 'Enviado' :
                                 notification.status === 'pending' ? 'Pendiente' : 'Fallido'}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-xs text-gray-500 font-bold">
                                {new Date(notification.sentAt).toLocaleDateString('es-ES')}
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
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
import { useEffect, useState } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

function Players() {
  const { isAuthenticated } = useAuth();
  const [players, setPlayers] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const fetchPlayers = async () => {
      try {
        setError(null);
        const response = await axios.get('players/top');
        setPlayers(response.data.data || []);
      } catch (error) {
        console.error('Error fetching players:', error);
        setError('Error al cargar los jugadores');
      } finally {
        setLoading(false);
      }
    };

    const fetchFavorites = async () => {
      if (isAuthenticated) {
        try {
          const response = await axios.get('users/favorites');
          const playerFavorites = (response.data.data || [])
            .filter(fav => fav.favoriteType === 'player')
            .map(fav => fav.favoriteId);
          setFavorites(playerFavorites);
        } catch (error) {
          console.error('Error fetching favorites:', error);
        }
      }
    };

    fetchPlayers();
    fetchFavorites();
  }, [isAuthenticated]);

  useEffect(() => {
    const searchPlayers = async () => {
      if (searchQuery.length < 2) {
        setSearching(true);
        try {
          const response = await axios.get('players/top');
          setPlayers(response.data.data || []);
        } catch (error) {
          console.error('Error fetching players:', error);
        } finally {
          setSearching(false);
        }
        return;
      }

      setSearching(true);
      try {
        const response = await axios.get('players/search', {
          params: { query: searchQuery }
        });
        setPlayers(response.data.data || []);
      } catch (error) {
        console.error('Error searching players:', error);
        setError('Error al buscar jugadores');
      } finally {
        setSearching(false);
      }
    };

    const timeoutId = setTimeout(() => {
      searchPlayers();
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  const toggleFavorite = async (playerId, isFavorite) => {
    if (!isAuthenticated) {
      alert('Debes iniciar sesión para agregar favoritos');
      return;
    }

    try {
      await axios.post('users/favorites', {
        type: 'player',
        id: playerId.toString(),
        action: isFavorite ? 'remove' : 'add'
      });

      if (isFavorite) {
        setFavorites(favorites.filter(id => id !== playerId.toString()));
      } else {
        setFavorites([...favorites, playerId.toString()]);
      }
    } catch (error) {
      console.error('Error toggling favorite:', error);
      alert('Error al actualizar favoritos');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Cargando jugadores...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">Top Players</h1>
        <p className="text-gray-600">Explora los mejores jugadores de la NBA</p>
      </div>

      <div className="mb-6 relative">
        <input
          type="text"
          placeholder="Buscar por nombre, equipo o posición..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        {searching && (
          <div className="absolute right-3 top-2.5">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
          </div>
        )}
      </div>

      <div className="mb-4 text-sm text-gray-600">
        {searchQuery.length >= 2 ? (
          <span>Resultados de búsqueda: {players.length} jugadores</span>
        ) : (
          <span>Mostrando {players.length} jugadores</span>
        )}
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Nombre
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Posición
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Equipo
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Altura
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Peso
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {players.length === 0 ? (
                <tr>
                  <td colSpan="5" className="px-6 py-4 text-center text-gray-500">
                    {searchQuery.length >= 2
                      ? 'No se encontraron jugadores con ese criterio'
                      : 'No hay jugadores disponibles'}
                  </td>
                </tr>
              ) : (
                players.map((player, index) => {
                  const playerId = player.player_id;
                  const isFavorite = favorites.includes(playerId?.toString());

                  return (
                    <tr key={`${playerId}-${index}`} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center space-x-2">
                          <span className="text-sm font-medium text-gray-900">
                            {player.player_name}
                          </span>
                          {isAuthenticated && (
                            <button
                              onClick={() => toggleFavorite(playerId, isFavorite)}
                              className="text-lg hover:scale-110 transition-transform"
                              title={isFavorite ? 'Quitar de favoritos' : 'Agregar a favoritos'}
                            >
                              {isFavorite ? '❤️' : '🤍'}
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                          {player.position || 'N/A'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm">
                          <div className="font-medium text-gray-900">
                            {player.team_name || 'Free Agent'}
                          </div>
                          {player.team_abbr && (
                            <div className="text-gray-500 text-xs">
                              {player.team_abbr}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {player.height || 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {player.weight ? `${player.weight} lbs` : 'N/A'}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {players.length > 0 && (
        <div className="mt-4 text-xs text-gray-500 text-center">
          Datos actualizados • {players.length} jugadores{searchQuery.length >= 2 ? ' encontrados' : ' activos'}
        </div>
      )}
    </div>
  );
}

export default Players;
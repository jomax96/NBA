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
        setError('Error cargando jugadores');
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
        setError('Error buscando jugadores');
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
      alert('Error actualizando favoritos');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center pt-24">
        <div className="text-white text-2xl font-black uppercase tracking-widest">Cargando Jugadores...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-black pt-24 px-8">
        <div className="max-w-7xl mx-auto">
          <div className="bg-red-600 text-white px-6 py-4 font-black uppercase tracking-wider">
            {error}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black pt-24 pb-16">
      {/* Hero Section */}
      <div className="bg-black py-12 border-b-4 border-red-600 mb-12">
        <div className="max-w-7xl mx-auto px-8">
          <h1 className="text-6xl font-black text-white uppercase tracking-wider">
            JUGADORES DESTACADOS
          </h1>
          <p className="text-lg text-gray-400 uppercase tracking-widest font-bold mt-2">
            EXPLORA LO MEJOR DE LA NBA
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-8">
        {/* Search Bar */}
        <div className="mb-8 relative">
          <input
            type="text"
            placeholder="BUSCA POR NOMBRE, EQUIPO O POSICIÓN..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-6 py-4 bg-white text-black placeholder-gray-400 font-bold uppercase tracking-wider focus:outline-none focus:ring-4 focus:ring-red-600"
          />
          {searching && (
            <div className="absolute right-6 top-4">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-red-600"></div>
            </div>
          )}
        </div>

        <div className="mb-6">
          <span className="text-gray-400 font-bold uppercase tracking-wider text-sm">
            {searchQuery.length >= 2 ? (
              `RESULTADOS DE BÚSQUEDA: ${players.length} JUGADORES`
            ) : (
              `MOSTRANDO ${players.length} JUGADORES`
            )}
          </span>
        </div>

        {/* Players Grid */}
        <div className="bg-white">
          {players.length === 0 ? (
            <div className="px-8 py-16 text-center text-gray-500 font-bold uppercase tracking-wider">
              {searchQuery.length >= 2
                ? 'NO SE ENCONTRARON JUGADORES'
                : 'NO HAY JUGADORES DISPONIBLES'}
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {players.map((player, index) => {
                const playerId = player.player_id;
                const isFavorite = favorites.includes(playerId?.toString());

                return (
                  <div 
                    key={`${playerId}-${index}`} 
                    className="px-8 py-6 hover:bg-gray-50 transition-colors duration-200 group"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-4 mb-2">
                          <h3 className="text-2xl font-black text-black uppercase">
                            {player.player_name}
                          </h3>
                          {isAuthenticated && (
                            <button
                              onClick={() => toggleFavorite(playerId, isFavorite)}
                              className="transition-transform hover:scale-110"
                            >
                              <svg 
                                className={`w-6 h-6 ${isFavorite ? 'text-red-600' : 'text-gray-300'}`} 
                                fill={isFavorite ? 'currentColor' : 'none'} 
                                stroke="currentColor" 
                                viewBox="0 0 24 24"
                              >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                              </svg>
                            </button>
                          )}
                        </div>
                        <div className="flex items-center space-x-6 text-sm">
                          <span className="px-3 py-1 bg-red-600 text-white font-black uppercase tracking-wider">
                            {player.position || 'N/A'}
                          </span>
                          <span className="text-gray-600 font-bold uppercase tracking-wider">
                            {player.team_name || 'Agente Libre'}
                          </span>
                          {player.team_abbr && (
                            <span className="text-gray-400 font-bold uppercase">
                              {player.team_abbr}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center space-x-8 text-right">
                        <div>
                          <p className="text-xs text-gray-500 uppercase tracking-widest font-black mb-1">
                            Altura
                          </p>
                          <p className="text-lg font-black text-black">
                            {player.height || 'N/A'}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 uppercase tracking-widest font-black mb-1">
                            Peso
                          </p>
                          <p className="text-lg font-black text-black">
                            {player.weight ? `${player.weight} LBS` : 'N/A'}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {players.length > 0 && (
          <div className="mt-6 text-center">
            <span className="text-xs text-gray-500 uppercase tracking-wider font-bold">
              DATOS ACTUALIZADOS • {players.length} JUGADORES {searchQuery.length >= 2 ? 'ENCONTRADOS' : 'ACTIVOS'}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

export default Players;

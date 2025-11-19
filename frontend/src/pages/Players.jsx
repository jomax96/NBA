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
      <div className="min-h-screen bg-black flex items-center justify-center pt-20 md:pt-24 px-4">
        <div className="text-white text-xl md:text-2xl font-black uppercase tracking-widest">Cargando Jugadores...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-black pt-20 md:pt-24 px-4 md:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="bg-red-600 text-white px-4 md:px-6 py-4 font-black uppercase tracking-wider">
            {error}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black pt-20 md:pt-24 pb-8 md:pb-16">
      {/* Hero Section */}
      <div className="bg-black py-8 md:py-12 border-b-4 border-red-600 mb-8 md:mb-12">
        <div className="max-w-7xl mx-auto px-4 md:px-8">
          <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-black text-white uppercase tracking-wider">
            JUGADORES DESTACADOS
          </h1>
          <p className="text-sm md:text-lg text-gray-400 uppercase tracking-widest font-bold mt-2">
            EXPLORA LO MEJOR DE LA NBA
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 md:px-8">
        {/* Search Bar */}
        <div className="mb-6 md:mb-8 relative">
          <input
            type="text"
            placeholder="BUSCA POR NOMBRE, EQUIPO O POSICIÓN..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-4 md:px-6 py-3 md:py-4 bg-white text-black placeholder-gray-400 font-bold uppercase tracking-wider focus:outline-none focus:ring-4 focus:ring-red-600 text-sm md:text-base"
          />
          {searching && (
            <div className="absolute right-4 md:right-6 top-3 md:top-4">
              <div className="animate-spin rounded-full h-5 w-5 md:h-6 md:w-6 border-b-2 border-red-600"></div>
            </div>
          )}
        </div>

        <div className="mb-4 md:mb-6">
          <span className="text-gray-400 font-bold uppercase tracking-wider text-xs md:text-sm">
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
            <div className="px-4 md:px-8 py-12 md:py-16 text-center text-gray-500 font-bold uppercase tracking-wider text-sm md:text-base">
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
                    className="px-4 md:px-8 py-4 md:py-6 hover:bg-gray-50 transition-colors duration-200 group"
                  >
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 md:space-x-4 mb-2">
                          <h3 className="text-lg md:text-2xl font-black text-black uppercase">
                            {player.player_name}
                          </h3>
                          {isAuthenticated && (
                            <button
                              onClick={() => toggleFavorite(playerId, isFavorite)}
                              className="transition-transform hover:scale-110 flex-shrink-0"
                            >
                              <svg 
                                className={`w-5 h-5 md:w-6 md:h-6 ${isFavorite ? 'text-red-600' : 'text-gray-300'}`} 
                                fill={isFavorite ? 'currentColor' : 'none'} 
                                stroke="currentColor" 
                                viewBox="0 0 24 24"
                              >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                              </svg>
                            </button>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-3 md:gap-6 text-xs md:text-sm">
                          <span className="px-2 md:px-3 py-1 bg-red-600 text-white font-black uppercase tracking-wider">
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
                      <div className="flex items-center gap-4 md:gap-8 text-left md:text-right">
                        <div>
                          <p className="text-xs text-gray-500 uppercase tracking-widest font-black mb-1">
                            Altura
                          </p>
                          <p className="text-base md:text-lg font-black text-black">
                            {player.height || 'N/A'}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 uppercase tracking-widest font-black mb-1">
                            Peso
                          </p>
                          <p className="text-base md:text-lg font-black text-black">
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
          <div className="mt-4 md:mt-6 text-center">
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
import { useEffect, useState } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

function Players() {
  const { isAuthenticated } = useAuth();
  const [players, setPlayers] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPlayers = async () => {
      try {
        const response = await axios.get('/api/players/top');
        setPlayers(response.data.data || []);
      } catch (error) {
        console.error('Error fetching players:', error);
      } finally {
        setLoading(false);
      }
    };

    const fetchFavorites = async () => {
      if (isAuthenticated) {
        try {
          const response = await axios.get('/api/users/favorites');
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

  const toggleFavorite = async (playerId, isFavorite) => {
    if (!isAuthenticated) {
      alert('Debes iniciar sesión para agregar favoritos');
      return;
    }

    try {
      await axios.post('/api/users/favorites', {
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
    return <div className="p-8">Loading players...</div>;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-4xl font-bold mb-8">Top Players</h1>
      
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Position</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Team</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {players.map((player) => {
              const isFavorite = favorites.includes(player.player_id.toString());
              return (
                <tr key={player.player_id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex items-center space-x-2">
                      <span>{player.player_name}</span>
                      {isAuthenticated && (
                        <button
                          onClick={() => toggleFavorite(player.player_id, isFavorite)}
                          className="text-lg hover:scale-110 transition"
                          title={isFavorite ? 'Quitar de favoritos' : 'Agregar a favoritos'}
                        >
                          {isFavorite ? '❤️' : '🤍'}
                        </button>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{player.position}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{player.team_name || 'N/A'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default Players;


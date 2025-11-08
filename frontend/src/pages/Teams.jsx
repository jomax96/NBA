import { useEffect, useState } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

function Teams() {
  const { isAuthenticated } = useAuth();
  const [teams, setTeams] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTeams = async () => {
      try {
        const response = await axios.get('/api/teams');
        setTeams(response.data.data || []);
      } catch (error) {
        console.error('Error fetching teams:', error);
      } finally {
        setLoading(false);
      }
    };

    const fetchFavorites = async () => {
      if (isAuthenticated) {
        try {
          const response = await axios.get('/api/users/favorites');
          const teamFavorites = (response.data.data || [])
            .filter(fav => fav.favoriteType === 'team')
            .map(fav => fav.favoriteId);
          setFavorites(teamFavorites);
        } catch (error) {
          console.error('Error fetching favorites:', error);
        }
      }
    };

    fetchTeams();
    fetchFavorites();
  }, [isAuthenticated]);

  const toggleFavorite = async (teamId, isFavorite) => {
    if (!isAuthenticated) {
      alert('Debes iniciar sesión para agregar favoritos');
      return;
    }

    try {
      await axios.post('/api/users/favorites', {
        type: 'team',
        id: teamId.toString(),
        action: isFavorite ? 'remove' : 'add'
      });
      
      if (isFavorite) {
        setFavorites(favorites.filter(id => id !== teamId.toString()));
      } else {
        setFavorites([...favorites, teamId.toString()]);
      }
    } catch (error) {
      console.error('Error toggling favorite:', error);
      alert('Error al actualizar favoritos');
    }
  };

  if (loading) {
    return <div className="p-8">Loading teams...</div>;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-4xl font-bold mb-8">NBA Teams</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {teams.map((team) => {
          const isFavorite = favorites.includes(team.team_id.toString());
          return (
            <div key={team.team_id} className="bg-white p-6 rounded-lg shadow hover:shadow-lg transition relative">
              {isAuthenticated && (
                <button
                  onClick={() => toggleFavorite(team.team_id, isFavorite)}
                  className="absolute top-4 right-4 text-2xl hover:scale-110 transition"
                  title={isFavorite ? 'Quitar de favoritos' : 'Agregar a favoritos'}
                >
                  {isFavorite ? '❤️' : '🤍'}
                </button>
              )}
              <h2 className="text-2xl font-semibold mb-2 pr-8">{team.team_name}</h2>
              <p className="text-gray-600">{team.city}</p>
              <p className="text-sm text-gray-500 mt-2">
                {team.conference} Conference • {team.division} Division
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default Teams;


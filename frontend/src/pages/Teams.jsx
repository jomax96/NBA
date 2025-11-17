import { useEffect, useState } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

function Teams() {
  const { isAuthenticated } = useAuth();
  const [teams, setTeams] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [teamStats, setTeamStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(false);

  useEffect(() => {
    const fetchTeams = async () => {
      try {
        const response = await axios.get('teams');
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
          const response = await axios.get('users/favorites');
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
      await axios.post('/users/favorites', {
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

  const fetchTeamStats = async (teamId) => {
    setStatsLoading(true);
    try {
      // CORRECCIÓN: Añadir /stats al endpoint
      const response = await axios.get(`teams/${teamId}`);
      console.log('Team stats response:', response.data); // Debug
      setTeamStats(response.data.data);
      setSelectedTeam(teamId);
    } catch (error) {
      console.error('Error fetching team stats:', error);
      alert('Error al cargar estadísticas del equipo');
    } finally {
      setStatsLoading(false);
    }
  };

  const closeStats = () => {
    setSelectedTeam(null);
    setTeamStats(null);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-xl">Cargando equipos...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-4xl font-bold mb-8">Equipos NBA</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {teams.map((team) => {
          const isFavorite = favorites.includes(team.id.toString());
          return (
            <div
              key={team.id}
              className="bg-white p-6 rounded-lg shadow hover:shadow-lg transition relative cursor-pointer"
              onClick={() => fetchTeamStats(team.id)}
            >
              {isAuthenticated && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleFavorite(team.id, isFavorite);
                  }}
                  className="absolute top-4 right-4 text-2xl hover:scale-110 transition z-10"
                  title={isFavorite ? 'Quitar de favoritos' : 'Agregar a favoritos'}
                >
                  {isFavorite ? '❤️' : '🤍'}
                </button>
              )}

              <div className="mb-2">
                <span className="text-3xl font-bold text-gray-400 mr-3">
                  {team.abbreviation}
                </span>
              </div>

              <h2 className="text-2xl font-semibold mb-2 pr-8">{team.full_name}</h2>
              <p className="text-lg text-gray-700 font-medium">{team.nickname}</p>
              <p className="text-gray-600">{team.city}{team.state ? `, ${team.state}` : ''}</p>

              {team.year_founded && (
                <p className="text-sm text-gray-500 mt-3">
                  Fundado en {Math.round(team.year_founded)}
                </p>
              )}

              <div className="mt-4 pt-4 border-t">
                <span className="text-sm text-blue-600 hover:text-blue-800">
                  Ver estadísticas →
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal de Estadísticas */}
      {selectedTeam && teamStats && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b p-6 flex justify-between items-center">
              <h2 className="text-2xl font-bold">{teamStats.full_name}</h2>
              <button
                onClick={closeStats}
                className="text-gray-500 hover:text-gray-700 text-2xl"
              >
                ×
              </button>
            </div>

            <div className="p-6">
              {statsLoading ? (
                <div className="text-center py-8">Cargando estadísticas...</div>
              ) : (
                <>
                  {/* Información del Equipo */}
                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <div className="bg-gray-50 p-4 rounded">
                      <p className="text-sm text-gray-600">Ciudad</p>
                      <p className="text-lg font-semibold">
                        {teamStats.city}{teamStats.state ? `, ${teamStats.state}` : ''}
                      </p>
                    </div>
                    <div className="bg-gray-50 p-4 rounded">
                      <p className="text-sm text-gray-600">Apodo</p>
                      <p className="text-lg font-semibold">{teamStats.nickname}</p>
                    </div>
                    <div className="bg-gray-50 p-4 rounded">
                      <p className="text-sm text-gray-600">Abreviatura</p>
                      <p className="text-lg font-semibold">{teamStats.abbreviation}</p>
                    </div>
                    <div className="bg-gray-50 p-4 rounded">
                      <p className="text-sm text-gray-600">Fundado</p>
                      <p className="text-lg font-semibold">
                        {teamStats.year_founded ? Math.round(teamStats.year_founded) : 'N/A'}
                      </p>
                    </div>
                  </div>

                  {/* Record de Temporada */}
                  <div className="bg-blue-50 p-4 rounded mb-6">
                    <h3 className="text-lg font-semibold mb-3">Record de Temporada</h3>
                    <div className="grid grid-cols-3 gap-4 text-center">
                      <div>
                        <p className="text-2xl font-bold text-green-600">
                          {parseInt(teamStats.wins) || 0}
                        </p>
                        <p className="text-sm text-gray-600">Victorias</p>
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-red-600">
                          {parseInt(teamStats.losses) || 0}
                        </p>
                        <p className="text-sm text-gray-600">Derrotas</p>
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-blue-600">
                          {(() => {
                            const wins = parseInt(teamStats.wins) || 0;
                            const losses = parseInt(teamStats.losses) || 0;
                            const totalGames = wins + losses;

                            // CORRECCIÓN: Verificar que haya al menos un juego
                            if (totalGames > 0) {
                              return ((wins / totalGames) * 100).toFixed(1);
                            }
                            return '0.0';
                          })()}%
                        </p>
                        <p className="text-sm text-gray-600">% Victorias</p>
                      </div>
                    </div>
                  </div>

                  {/* Estadísticas de Puntos */}
                  <div className="bg-gray-50 p-4 rounded">
                    <h3 className="text-lg font-semibold mb-3">Promedios de Puntos</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-gray-600">Puntos Anotados</p>
                        <p className="text-2xl font-bold text-green-600">
                          {teamStats.avg_points_scored
                            ? parseFloat(teamStats.avg_points_scored).toFixed(1)
                            : '0.0'}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Puntos Permitidos</p>
                        <p className="text-2xl font-bold text-red-600">
                          {teamStats.avg_points_allowed
                            ? parseFloat(teamStats.avg_points_allowed).toFixed(1)
                            : '0.0'}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Diferencial</p>
                        <p className={`text-2xl font-bold ${(parseFloat(teamStats.avg_points_scored || 0) - parseFloat(teamStats.avg_points_allowed || 0)) > 0
                          ? 'text-green-600'
                          : 'text-red-600'
                          }`}>
                          {(() => {
                            const scored = parseFloat(teamStats.avg_points_scored || 0);
                            const allowed = parseFloat(teamStats.avg_points_allowed || 0);
                            const diff = scored - allowed;
                            return (diff > 0 ? '+' : '') + diff.toFixed(1);
                          })()}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Total de Juegos</p>
                        <p className="text-2xl font-bold text-gray-700">
                          {parseInt(teamStats.total_games) || 0}
                        </p>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Teams;
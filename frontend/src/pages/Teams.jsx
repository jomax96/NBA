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
      alert('Error actualizando favoritos');
    }
  };

  const fetchTeamStats = async (teamId) => {
    setStatsLoading(true);
    try {
      const response = await axios.get(`teams/${teamId}`);
      setTeamStats(response.data.data);
      setSelectedTeam(teamId);
    } catch (error) {
      console.error('Error fetching team stats:', error);
      alert('Error cargando estadísticas del equipo');
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
      <div className="min-h-screen bg-black flex items-center justify-center pt-24">
        <div className="text-white text-2xl font-black uppercase tracking-widest">Cargando equipos...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black pt-24 pb-16">
      {/* Hero Section */}
      <div className="bg-black py-12 border-b-4 border-red-600 mb-12">
        <div className="max-w-7xl mx-auto px-8">
          <h1 className="text-6xl font-black text-white uppercase tracking-wider">
            EQUIPOS NBA
          </h1>
          <p className="text-lg text-gray-400 uppercase tracking-widest font-bold mt-2">
            TODAS LAS 30 FRANQUICIAS
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {teams.map((team) => {
            const isFavorite = favorites.includes(team.id.toString());
            return (
              <div
                key={team.id}
                className="bg-white p-6 hover:bg-gray-50 transition-all duration-200 cursor-pointer group relative"
                onClick={() => fetchTeamStats(team.id)}
              >
                {isAuthenticated && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleFavorite(team.id, isFavorite);
                    }}
                    className="absolute top-4 right-4 z-10"
                  >
                    <div className={`w-8 h-8 flex items-center justify-center ${
                      isFavorite ? 'text-red-600' : 'text-gray-300'
                    } hover:scale-110 transition-transform`}>
                      <svg className="w-6 h-6" fill={isFavorite ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                      </svg>
                    </div>
                  </button>
                )}

                <div className="mb-4">
                  <span className="text-5xl font-black text-gray-300 group-hover:text-red-600 transition-colors">
                    {team.abbreviation}
                  </span>
                </div>

                <h2 className="text-2xl font-black text-black uppercase mb-1 pr-10">
                  {team.full_name}
                </h2>
                <p className="text-sm font-bold text-gray-600 uppercase tracking-wider mb-1">
                  {team.nickname}
                </p>
                <p className="text-sm text-gray-500 font-medium">
                  {team.city}{team.state ? `, ${team.state}` : ''}
                </p>

                {team.year_founded && (
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <span className="text-xs text-gray-400 uppercase tracking-wider font-bold">
                      Fundado {Math.round(team.year_founded)}
                    </span>
                  </div>
                )}

                <div className="mt-4 flex items-center text-red-600 font-black text-xs uppercase tracking-wider group-hover:translate-x-2 transition-transform">
                  <span>Ver estadísticas</span>
                  <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Stats Modal */}
      {selectedTeam && teamStats && (
        <div className="fixed inset-0 bg-black bg-opacity-95 flex items-center justify-center p-4 z-50">
          <div className="bg-white max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-black px-8 py-6 flex justify-between items-center border-b-4 border-red-600">
              <h2 className="text-3xl font-black text-white uppercase tracking-wider">
                {teamStats.full_name}
              </h2>
              <button
                onClick={closeStats}
                className="text-white hover:text-red-600 transition-colors"
              >
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-8 bg-black">
              {statsLoading ? (
                <div className="text-center py-16 text-white font-black uppercase tracking-wider">
                  Cargando estadísticas...
                </div>
              ) : (
                <>
                  {/* Team Info Grid */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                    <div className="bg-white p-6">
                      <p className="text-xs text-gray-500 uppercase tracking-widest font-black mb-2">Ciudad</p>
                      <p className="text-2xl font-black text-black">
                        {teamStats.city}
                      </p>
                    </div>
                    <div className="bg-white p-6">
                      <p className="text-xs text-gray-500 uppercase tracking-widest font-black mb-2">Apodo</p>
                      <p className="text-2xl font-black text-black">
                        {teamStats.nickname}
                      </p>
                    </div>
                    <div className="bg-white p-6">
                      <p className="text-xs text-gray-500 uppercase tracking-widest font-black mb-2">Código</p>
                      <p className="text-2xl font-black text-black">
                        {teamStats.abbreviation}
                      </p>
                    </div>
                    <div className="bg-white p-6">
                      <p className="text-xs text-gray-500 uppercase tracking-widest font-black mb-2">Fundado</p>
                      <p className="text-2xl font-black text-black">
                        {teamStats.year_founded ? Math.round(teamStats.year_founded) : 'N/A'}
                      </p>
                    </div>
                  </div>

                  {/* Season Record */}
                  <div className="bg-white p-8 mb-8">
                    <h3 className="text-2xl font-black uppercase tracking-wider text-black mb-6 pb-4 border-b-4 border-red-600">
                      Récord de la Temporada
                    </h3>
                    <div className="grid grid-cols-3 gap-8 text-center">
                      <div>
                        <p className="text-6xl font-black text-black mb-2">
                          {parseInt(teamStats.wins) || 0}
                        </p>
                        <p className="text-sm text-gray-500 uppercase tracking-widest font-black">
                          Victorias
                        </p>
                      </div>
                      <div>
                        <p className="text-6xl font-black text-black mb-2">
                          {parseInt(teamStats.losses) || 0}
                        </p>
                        <p className="text-sm text-gray-500 uppercase tracking-widest font-black">
                          Derrotas
                        </p>
                      </div>
                      <div>
                        <p className="text-6xl font-black text-red-600 mb-2">
                          {(() => {
                            const wins = parseInt(teamStats.wins) || 0;
                            const losses = parseInt(teamStats.losses) || 0;
                            const totalGames = wins + losses;
                            if (totalGames > 0) {
                              return ((wins / totalGames) * 100).toFixed(1);
                            }
                            return '0.0';
                          })()}%
                        </p>
                        <p className="text-sm text-gray-500 uppercase tracking-widest font-black">
                          Porcentaje de Victoria
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Point Averages */}
                  <div className="bg-white p-8">
                    <h3 className="text-2xl font-black uppercase tracking-wider text-black mb-6 pb-4 border-b-4 border-red-600">
                      Promedios de Puntos
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                      <div>
                        <p className="text-xs text-gray-500 uppercase tracking-widest font-black mb-2">
                          Puntos Anotados
                        </p>
                        <p className="text-5xl font-black text-black">
                          {teamStats.avg_points_scored
                            ? parseFloat(teamStats.avg_points_scored).toFixed(1)
                            : '0.0'}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 uppercase tracking-widest font-black mb-2">
                          Puntos Permitidos
                        </p>
                        <p className="text-5xl font-black text-black">
                          {teamStats.avg_points_allowed
                            ? parseFloat(teamStats.avg_points_allowed).toFixed(1)
                            : '0.0'}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 uppercase tracking-widest font-black mb-2">
                          Diferencial
                        </p>
                        <p className={`text-5xl font-black ${
                          (parseFloat(teamStats.avg_points_scored || 0) - parseFloat(teamStats.avg_points_allowed || 0)) > 0
                            ? 'text-red-600'
                            : 'text-gray-400'
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
                        <p className="text-xs text-gray-500 uppercase tracking-widest font-black mb-2">
                          Juegos Jugados
                        </p>
                        <p className="text-5xl font-black text-black">
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

import { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

function Games() {
  const { isAuthenticated } = useAuth();
  const [teams, setTeams] = useState([]);
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);

  // Filtros actualizados - USAR IDs
  const [homeTeamId, setHomeTeamId] = useState('');
  const [awayTeamId, setAwayTeamId] = useState('');
  const [limit, setLimit] = useState(10);

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
    fetchTeams();
  }, []);

  const handleSearch = async (e) => {
    e.preventDefault();

    // Validar que ambos equipos estén seleccionados
    if (!homeTeamId || !awayTeamId) {
      alert('Por favor selecciona ambos equipos (local y visitante)');
      return;
    }

    setSearching(true);
    setGames([]);

    try {
      const params = new URLSearchParams();
      params.append('homeTeamId', homeTeamId);
      params.append('awayTeamId', awayTeamId);
      params.append('limit', limit.toString());

      const response = await axios.get(`games/search?${params}`);
      setGames(response.data.data || []);

      // Mostrar mensaje si no hay resultados
      if (response.data.data.length === 0) {
        alert('No se encontraron partidos entre estos equipos');
      }
    } catch (error) {
      console.error('Error searching games:', error);
      alert(error.response?.data?.error || 'Error al buscar partidos');
    } finally {
      setSearching(false);
    }
  };

  // Obtener nombres de equipos para mostrar en el título
  const getTeamName = (teamId) => {
    const team = teams.find(t => t.id === parseInt(teamId));
    return team ? team.full_name : '';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-xl">Cargando equipos...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-4xl font-bold mb-8">Búsqueda de Partidos Históricos</h1>

      {!isAuthenticated && (
        <div className="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded mb-6">
          <p className="text-sm">
            <strong>Tip:</strong> Inicia sesión para guardar tu historial de búsquedas.
          </p>
        </div>
      )}

      {/* Formulario de búsqueda */}
      <div className="bg-white p-6 rounded-lg shadow mb-6">
        <form onSubmit={handleSearch} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Equipo Local <span className="text-red-500">*</span>
              </label>
              <select
                value={homeTeamId}
                onChange={(e) => setHomeTeamId(e.target.value)}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
              >
                <option value="">Selecciona equipo local</option>
                {teams.map((team) => (
                  <option key={`home-${team.id}`} value={team.id}>
                    {team.full_name} ({team.abbreviation})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Equipo Visitante <span className="text-red-500">*</span>
              </label>
              <select
                value={awayTeamId}
                onChange={(e) => setAwayTeamId(e.target.value)}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
              >
                <option value="">Selecciona equipo visitante</option>
                {teams.map((team) => (
                  <option key={`away-${team.id}`} value={team.id}>
                    {team.full_name} ({team.abbreviation})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Número de Partidos
              </label>
              <input
                type="number"
                value={limit}
                onChange={(e) => setLimit(parseInt(e.target.value) || 10)}
                min="1"
                max="50"
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          <div className="flex gap-4">
            <button
              type="submit"
              disabled={searching || !homeTeamId || !awayTeamId}
              className="flex-1 bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
            >
              {searching ? (
                <span className="flex items-center justify-center">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Buscando...
                </span>
              ) : (
                'Buscar Partidos Históricos'
              )}
            </button>

            {(homeTeamId || awayTeamId) && (
              <button
                type="button"
                onClick={() => {
                  setHomeTeamId('');
                  setAwayTeamId('');
                  setGames([]);
                }}
                className="px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium"
              >
                Limpiar
              </button>
            )}
          </div>
        </form>
      </div>

      {/* Resultados */}
      {games.length > 0 && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-6 py-4 bg-gray-50 border-b">
            <h2 className="text-xl font-semibold">
              Últimos {games.length} partidos entre {getTeamName(homeTeamId)} (Local) vs {getTeamName(awayTeamId)} (Visitante)
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Fecha
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Equipo Local
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Marcador
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Equipo Visitante
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Resultado
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {games.map((game) => {
                  const homeWon = game.wl_home === 'W';
                  return (
                    <tr key={game.game_id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {new Date(game.game_date).toLocaleDateString('es-ES', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric'
                        })}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {game.home_team}
                        </div>
                        <div className="text-sm text-gray-500">{game.home_abbr}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <div className="text-lg font-bold">
                          <span className={homeWon ? 'text-green-600' : 'text-gray-900'}>
                            {game.home_team_score}
                          </span>
                          <span className="text-gray-400 mx-2">-</span>
                          <span className={!homeWon ? 'text-green-600' : 'text-gray-900'}>
                            {game.visitor_team_score}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {game.visitor_team}
                        </div>
                        <div className="text-sm text-gray-500">{game.visitor_abbr}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${homeWon
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                          }`}>
                          {homeWon ? 'Victoria Local' : 'Victoria Visitante'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {games.length === 0 && !searching && (
        <div className="bg-white p-12 rounded-lg shadow text-center">
          <svg className="mx-auto h-12 w-12 text-gray-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          <p className="text-gray-500 text-lg">
            Selecciona el equipo local y visitante para buscar su historial de partidos.
          </p>
        </div>
      )}
    </div>
  );
}

export default Games;
import { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

function Games() {
  const { isAuthenticated } = useAuth();
  const [teams, setTeams] = useState([]);
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  
  // Filtros
  const [selectedTeamId, setSelectedTeamId] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [limit, setLimit] = useState(50);

  useEffect(() => {
    fetchTeams();
  }, []);

  const fetchTeams = async () => {
    try {
      const response = await axios.get('/api/teams');
      setTeams(response.data.data || []);
    } catch (error) {
      console.error('Error fetching teams:', error);
    }
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    setSearching(true);
    setGames([]);

    try {
      const params = new URLSearchParams();
      if (selectedTeamId) params.append('teamId', selectedTeamId);
      if (dateFrom) params.append('dateFrom', dateFrom);
      if (dateTo) params.append('dateTo', dateTo);
      params.append('limit', limit.toString());

      const response = await axios.get(`/api/games/search?${params}`);
      setGames(response.data.data || []);
    } catch (error) {
      console.error('Error searching games:', error);
      alert('Error al buscar partidos');
    } finally {
      setSearching(false);
    }
  };

  if (loading) {
    return <div className="p-8">Loading...</div>;
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Equipo
              </label>
              <select
                value={selectedTeamId}
                onChange={(e) => setSelectedTeamId(e.target.value)}
                className="w-full px-4 py-2 border rounded-lg"
              >
                <option value="">Todos los equipos</option>
                {teams.map((team) => (
                  <option key={team.team_id} value={team.team_id}>
                    {team.team_name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Fecha Desde
              </label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-full px-4 py-2 border rounded-lg"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Fecha Hasta
              </label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-full px-4 py-2 border rounded-lg"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Límite
              </label>
              <input
                type="number"
                value={limit}
                onChange={(e) => setLimit(parseInt(e.target.value))}
                min="1"
                max="500"
                className="w-full px-4 py-2 border rounded-lg"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={searching}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {searching ? 'Buscando...' : 'Buscar Partidos'}
          </button>
        </form>
      </div>

      {/* Resultados */}
      {games.length > 0 && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-6 py-4 bg-gray-50 border-b">
            <h2 className="text-xl font-semibold">
              Resultados ({games.length} partidos)
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fecha</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Equipo Local</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Equipo Visitante</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Marcador</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {games.map((game) => (
                  <tr key={game.game_id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {new Date(game.game_date).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      {game.home_team} ({game.home_abbr})
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      {game.visitor_team} ({game.visitor_abbr})
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <span className="font-bold">{game.home_team_score}</span> -{' '}
                      <span className="font-bold">{game.visitor_team_score}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {games.length === 0 && !searching && (
        <div className="bg-white p-6 rounded-lg shadow text-center text-gray-500">
          <p>Utiliza el formulario de arriba para buscar partidos históricos.</p>
        </div>
      )}
    </div>
  );
}

export default Games;


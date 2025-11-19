import { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

function Games() {
  const { isAuthenticated } = useAuth();
  const [teams, setTeams] = useState([]);
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
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

    if (!homeTeamId || !awayTeamId) {
      alert('Por favor selecciona ambos equipos');
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

  const getTeamName = (teamId) => {
    const team = teams.find(t => t.id === parseInt(teamId));
    return team ? team.full_name : '';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center pt-24">
        <div className="text-white text-2xl font-black uppercase tracking-widest">
          Cargando equipos...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black pt-24 pb-16">
      <div className="bg-black py-12 border-b-4 border-red-600 mb-12">
        <div className="max-w-7xl mx-auto px-8">
          <h1 className="text-6xl font-black text-white uppercase tracking-wider">
            PARTIDOS HISTÓRICOS
          </h1>
          <p className="text-lg text-gray-400 uppercase tracking-widest font-bold mt-2">
            BUSCA ENFRENTAMIENTOS DIRECTOS
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-8">
        {!isAuthenticated && (
          <div className="bg-white border-l-4 border-red-600 px-6 py-4 mb-8">
            <p className="text-sm font-bold uppercase tracking-wider text-black">
              CONSEJO: Inicia sesión para guardar tu historial de búsqueda
            </p>
          </div>
        )}

        <div className="bg-white p-8 mb-8">
          <form onSubmit={handleSearch} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="block text-xs font-black uppercase tracking-widest text-gray-600 mb-3">
                  Equipo Local <span className="text-red-600">*</span>
                </label>
                <select
                  value={homeTeamId}
                  onChange={(e) => setHomeTeamId(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-gray-300 focus:border-red-600 focus:outline-none font-bold text-black"
                  required
                >
                  <option value="">SELECCIONAR EQUIPO LOCAL</option>
                  {teams.map((team) => (
                    <option key={`home-${team.id}`} value={team.id}>
                      {team.full_name} ({team.abbreviation})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-black uppercase tracking-widest text-gray-600 mb-3">
                  Equipo Visitante <span className="text-red-600">*</span>
                </label>
                <select
                  value={awayTeamId}
                  onChange={(e) => setAwayTeamId(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-gray-300 focus:border-red-600 focus:outline-none font-bold text-black"
                  required
                >
                  <option value="">SELECCIONAR EQUIPO VISITANTE</option>
                  {teams.map((team) => (
                    <option key={`away-${team.id}`} value={team.id}>
                      {team.full_name} ({team.abbreviation})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-black uppercase tracking-widest text-gray-600 mb-3">
                  Número de Partidos
                </label>
                <input
                  type="number"
                  value={limit}
                  onChange={(e) => setLimit(parseInt(e.target.value) || 10)}
                  min="1"
                  max="50"
                  className="w-full px-4 py-3 border-2 border-gray-300 focus:border-red-600 focus:outline-none font-bold text-black"
                />
              </div>
            </div>

            <div className="flex gap-4">
              <button
                type="submit"
                disabled={searching || !homeTeamId || !awayTeamId}
                className="flex-1 bg-black text-white py-4 px-6 font-black uppercase tracking-widest hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {searching ? 'BUSCANDO...' : 'BUSCAR PARTIDOS'}
              </button>

              {(homeTeamId || awayTeamId) && (
                <button
                  type="button"
                  onClick={() => {
                    setHomeTeamId('');
                    setAwayTeamId('');
                    setGames([]);
                  }}
                  className="px-8 py-4 border-2 border-black text-black font-black uppercase tracking-widest hover:bg-black hover:text-white transition-colors"
                >
                  Limpiar
                </button>
              )}
            </div>
          </form>
        </div>

        {games.length > 0 && (
          <div className="bg-white">
            <div className="px-8 py-6 bg-black border-b-4 border-red-600">
              <h2 className="text-2xl font-black text-white uppercase tracking-wider">
                ÚLTIMOS {games.length} PARTIDOS: {getTeamName(homeTeamId)} VS {getTeamName(awayTeamId)}
              </h2>
            </div>
            <div className="divide-y divide-gray-200">
              {games.map((game) => {
                const homeWon = game.wl_home === 'W';
                return (
                  <div key={game.game_id} className="px-8 py-6 hover:bg-gray-50 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-bold text-gray-500 uppercase tracking-wider">
                        {new Date(game.game_date).toLocaleDateString('es-ES', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric'
                        })}
                      </div>

                      <div className="flex-1 mx-8 flex items-center justify-between">
                        <div className="text-right">
                          <div className="text-xl font-black text-black uppercase">{game.home_team}</div>
                          <div className="text-sm text-gray-500 font-bold">{game.home_abbr}</div>
                        </div>

                        <div className="mx-8 flex items-center space-x-4">
                          <div className={`text-4xl font-black ${homeWon ? 'text-red-600' : 'text-gray-400'}`}>
                            {game.home_team_score}
                          </div>
                          <div className="text-2xl text-gray-400 font-black">-</div>
                          <div className={`text-4xl font-black ${!homeWon ? 'text-red-600' : 'text-gray-400'}`}>
                            {game.visitor_team_score}
                          </div>
                        </div>

                        <div className="text-left">
                          <div className="text-xl font-black text-black uppercase">{game.visitor_team}</div>
                          <div className="text-sm text-gray-500 font-bold">{game.visitor_abbr}</div>
                        </div>
                      </div>

                      <div className={`px-4 py-2 font-black uppercase tracking-wider text-xs ${
                        homeWon ? 'bg-red-600 text-white' : 'bg-gray-200 text-gray-600'
                      }`}>
                        {homeWon ? 'VICTORIA LOCAL' : 'VICTORIA VISITANTE'}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {games.length === 0 && !searching && (
          <div className="bg-white p-16 text-center">
            <div className="text-6xl text-gray-300 mb-6"></div>
            <p className="text-gray-500 text-lg font-bold uppercase tracking-wider">
              Selecciona los equipos para buscar su historial de partidos
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default Games;

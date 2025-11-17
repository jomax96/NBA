import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

function Predictions() {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const [teams, setTeams] = useState([]);
  const [homeTeamId, setHomeTeamId] = useState('');
  const [visitorTeamId, setVisitorTeamId] = useState('');
  const [prediction, setPrediction] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingTeams, setLoadingTeams] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
    }
  }, [isAuthenticated, navigate]);

  useEffect(() => {
    const fetchTeams = async () => {
      try {
        const response = await axios.get('teams');
        setTeams(response.data.data || []);
      } catch (error) {
        console.error('Error fetching teams:', error);
        setError('Error al cargar los equipos');
      } finally {
        setLoadingTeams(false);
      }
    };

    if (isAuthenticated) {
      fetchTeams();
    }
  }, [isAuthenticated]);

  const handlePredict = async (e) => {
    e.preventDefault();

    if (!homeTeamId || !visitorTeamId) {
      setError('Por favor selecciona ambos equipos');
      return;
    }

    if (homeTeamId === visitorTeamId) {
      setError('Los equipos deben ser diferentes');
      return;
    }

    setLoading(true);
    setPrediction(null);
    setError('');

    try {
      const response = await axios.post('predictions/predict', {
        homeTeamId: homeTeamId,  // Enviar como string
        visitorTeamId: visitorTeamId  // Enviar como string
      });

      setPrediction(response.data.data);
    } catch (err) {
      console.error('Error getting prediction:', err);
      if (err.response?.status === 401) {
        setError('Debes iniciar sesión para usar predicciones');
        navigate('/login');
      } else if (err.response?.status === 503) {
        setError('El servicio de predicciones no está disponible temporalmente');
      } else {
        setError(err.response?.data?.error || 'Error al obtener predicción');
      }
    } finally {
      setLoading(false);
    }
  };

  const getTeamName = (teamId) => {
    const team = teams.find(t => t.id === teamId);
    return team ? team.full_name : teamId;
  };

  const handleClear = () => {
    setHomeTeamId('');
    setVisitorTeamId('');
    setPrediction(null);
    setError('');
  };

  if (!isAuthenticated) {
    return null;
  }

  if (loadingTeams) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-xl">Cargando equipos...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-4xl font-bold mb-4">Predicciones de Partidos NBA</h1>
      <p className="text-gray-600 mb-8">
        Obtén predicciones basadas en machine learning para próximos partidos.
        El modelo analiza estadísticas recientes y enfrentamientos directos.
      </p>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-6">
          <div className="flex items-center">
            <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            {error}
          </div>
        </div>
      )}

      <div className="bg-white p-6 rounded-lg shadow mb-6">
        <h2 className="text-2xl font-semibold mb-4">Selecciona los Equipos</h2>
        <form onSubmit={handlePredict} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                value={visitorTeamId}
                onChange={(e) => setVisitorTeamId(e.target.value)}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
              >
                <option value="">Selecciona equipo visitante</option>
                {teams.map((team) => (
                  <option key={`visitor-${team.id}`} value={team.id}>
                    {team.full_name} ({team.abbreviation})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex gap-4">
            <button
              type="submit"
              disabled={loading || !homeTeamId || !visitorTeamId || homeTeamId === visitorTeamId}
              className="flex-1 bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
            >
              {loading ? (
                <span className="flex items-center justify-center">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Analizando...
                </span>
              ) : (
                'Obtener Predicción'
              )}
            </button>

            {(homeTeamId || visitorTeamId) && (
              <button
                type="button"
                onClick={handleClear}
                className="px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium"
              >
                Limpiar
              </button>
            )}
          </div>
        </form>
      </div>

      {prediction && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4">
            <h2 className="text-2xl font-bold text-white">Resultados de la Predicción</h2>
          </div>

          <div className="p-6">
            {/* Matchup Header */}
            <div className="mb-6 text-center">
              <div className="flex items-center justify-center gap-4 mb-4">
                <div className="text-right flex-1">
                  <h3 className="text-xl font-bold text-gray-900">
                    {getTeamName(prediction.home_team_id)}
                  </h3>
                  <span className="text-sm text-gray-500">Local</span>
                </div>
                <div className="text-3xl font-bold text-gray-400">VS</div>
                <div className="text-left flex-1">
                  <h3 className="text-xl font-bold text-gray-900">
                    {getTeamName(prediction.visitor_team_id)}
                  </h3>
                  <span className="text-sm text-gray-500">Visitante</span>
                </div>
              </div>
            </div>

            {/* Win Probabilities */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="bg-gradient-to-br from-green-50 to-green-100 p-4 rounded-lg border border-green-200">
                <div className="text-center">
                  <div className="text-3xl font-bold text-green-700">
                    {prediction.home_team_win_probability}%
                  </div>
                  <div className="text-sm text-green-600 mt-1">
                    Probabilidad Local
                  </div>
                </div>
              </div>

              <div className="bg-gradient-to-br from-red-50 to-red-100 p-4 rounded-lg border border-red-200">
                <div className="text-center">
                  <div className="text-3xl font-bold text-red-700">
                    {prediction.visitor_team_win_probability}%
                  </div>
                  <div className="text-sm text-red-600 mt-1">
                    Probabilidad Visitante
                  </div>
                </div>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="mb-6">
              <div className="h-8 bg-gray-200 rounded-full overflow-hidden flex">
                <div
                  className="bg-green-500 flex items-center justify-center text-white text-sm font-semibold"
                  style={{ width: `${prediction.home_team_win_probability}%` }}
                >
                  {prediction.home_team_win_probability > 20 && `${prediction.home_team_win_probability}%`}
                </div>
                <div
                  className="bg-red-500 flex items-center justify-center text-white text-sm font-semibold"
                  style={{ width: `${prediction.visitor_team_win_probability}%` }}
                >
                  {prediction.visitor_team_win_probability > 20 && `${prediction.visitor_team_win_probability}%`}
                </div>
              </div>
            </div>

            {/* Predicted Winner */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-blue-600 font-medium">Ganador Predicho</div>
                  <div className="text-2xl font-bold text-blue-900 mt-1">
                    {prediction.predicted_winner === 'home'
                      ? getTeamName(prediction.home_team_id)
                      : getTeamName(prediction.visitor_team_id)
                    }
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm text-blue-600">Confianza</div>
                  <span className={`inline-block px-3 py-1 rounded-full text-sm font-semibold mt-1 ${prediction.confidence === 'high' ? 'bg-green-100 text-green-800' :
                      prediction.confidence === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-gray-100 text-gray-800'
                    }`}>
                    {prediction.confidence === 'high' ? 'Alta' :
                      prediction.confidence === 'medium' ? 'Media' : 'Baja'}
                  </span>
                </div>
              </div>
            </div>

            {/* Estimated Score */}
            {prediction.estimated_score && (
              <div className="bg-gray-50 rounded-lg p-4 mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Marcador Estimado</h3>
                <div className="flex items-center justify-center gap-8">
                  <div className="text-center">
                    <div className="text-4xl font-bold text-gray-900">
                      {prediction.estimated_score.home}
                    </div>
                    <div className="text-sm text-gray-600 mt-1">Local</div>
                  </div>
                  <div className="text-2xl font-bold text-gray-400">-</div>
                  <div className="text-center">
                    <div className="text-4xl font-bold text-gray-900">
                      {prediction.estimated_score.visitor}
                    </div>
                    <div className="text-sm text-gray-600 mt-1">Visitante</div>
                  </div>
                </div>
              </div>
            )}

            {/* Factors */}
            {prediction.factors && (
              <div className="border-t pt-4">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Factores Analizados</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white border rounded-lg p-3">
                    <div className="text-sm text-gray-600">Win Rate Local (Reciente)</div>
                    <div className="text-xl font-bold text-gray-900">
                      {prediction.factors.home_recent_win_rate}%
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {prediction.factors.home_recent_games} juegos analizados
                    </div>
                  </div>
                  <div className="bg-white border rounded-lg p-3">
                    <div className="text-sm text-gray-600">Win Rate Visitante (Reciente)</div>
                    <div className="text-xl font-bold text-gray-900">
                      {prediction.factors.visitor_recent_win_rate}%
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {prediction.factors.visitor_recent_games} juegos analizados
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Head to Head */}
            {prediction.head_to_head && (
              <div className="border-t mt-4 pt-4">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Historial de Enfrentamientos</h3>
                <div className="bg-white border rounded-lg p-4">
                  <div className="flex items-center justify-around">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-600">
                        {prediction.head_to_head.home_wins}
                      </div>
                      <div className="text-sm text-gray-600">Victorias Local</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-gray-400">
                        {prediction.head_to_head.total_games}
                      </div>
                      <div className="text-sm text-gray-600">Total Juegos</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-red-600">
                        {prediction.head_to_head.visitor_wins}
                      </div>
                      <div className="text-sm text-gray-600">Victorias Visitante</div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Note for fallback */}
            {prediction.note && (
              <div className="mt-4 bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded">
                <p className="text-sm">{prediction.note}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {!prediction && !loading && (
        <div className="bg-white p-12 rounded-lg shadow text-center">
          <svg className="mx-auto h-16 w-16 text-gray-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <p className="text-gray-500 text-lg">
            Selecciona dos equipos para obtener una predicción basada en machine learning
          </p>
        </div>
      )}
    </div>
  );
}

export default Predictions;
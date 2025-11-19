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
        setError('Error loading teams');
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
      setError('Please select both teams');
      return;
    }

    if (homeTeamId === visitorTeamId) {
      setError('Teams must be different');
      return;
    }

    setLoading(true);
    setPrediction(null);
    setError('');

    try {
      const response = await axios.post('predictions/predict', {
        homeTeamId: homeTeamId,
        visitorTeamId: visitorTeamId
      });

      setPrediction(response.data.data);
    } catch (err) {
      console.error('Error getting prediction:', err);
      if (err.response?.status === 401) {
        setError('You must sign in to use predictions');
        navigate('/login');
      } else if (err.response?.status === 503) {
        setError('Prediction service temporarily unavailable');
      } else {
        setError(err.response?.data?.error || 'Error getting prediction');
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
      <div className="min-h-screen bg-black flex items-center justify-center pt-24">
        <div className="text-white text-2xl font-black uppercase tracking-widest">Loading Teams...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black pt-24 pb-16">
      <div className="bg-black py-12 border-b-4 border-red-600 mb-12">
        <div className="max-w-7xl mx-auto px-8">
          <h1 className="text-6xl font-black text-white uppercase tracking-wider">
            PREDICCIONES NBA
          </h1>
          <p className="text-lg text-gray-400 uppercase tracking-widest font-bold mt-2">
            ANÁLISIS CON MACHINE LEARNING
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-8">
        {error && (
          <div className="bg-red-600 text-white px-6 py-4 mb-8 font-black uppercase tracking-wider">
            {error}
          </div>
        )}

        <div className="bg-white p-8 mb-8">
          <h2 className="text-2xl font-black uppercase tracking-wider text-black mb-6 pb-4 border-b-4 border-red-600">
            Seleccionar Equipos
          </h2>
          <form onSubmit={handlePredict} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                  value={visitorTeamId}
                  onChange={(e) => setVisitorTeamId(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-gray-300 focus:border-red-600 focus:outline-none font-bold text-black"
                  required
                >
                  <option value="">SELECCIONAR EQUIPO VISITANTE</option>
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
                className="flex-1 bg-black text-white py-4 px-6 font-black uppercase tracking-widest hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? 'ANALIZANDO...' : 'OBTENER PREDICCIÓN'}
              </button>

              {(homeTeamId || visitorTeamId) && (
                <button
                  type="button"
                  onClick={handleClear}
                  className="px-8 py-4 border-2 border-black text-black font-black uppercase tracking-widest hover:bg-black hover:text-white transition-colors"
                >
                  Limpiar
                </button>
              )}
            </div>
          </form>
        </div>

        {prediction && (
          <div className="bg-white">
            <div className="bg-black px-8 py-6 border-b-4 border-red-600">
              <h2 className="text-3xl font-black text-white uppercase tracking-wider">
                RESULTADOS DE LA PREDICCIÓN
              </h2>
            </div>

            <div className="p-8">
              <div className="mb-8 text-center">
                <div className="flex items-center justify-center gap-8">
                  <div className="text-right flex-1">
                    <h3 className="text-3xl font-black text-black uppercase mb-2">
                      {getTeamName(prediction.home_team_id)}
                    </h3>
                    <span className="text-sm text-gray-500 font-bold uppercase tracking-wider">Local</span>
                  </div>
                  <div className="text-4xl font-black text-gray-400">VS</div>
                  <div className="text-left flex-1">
                    <h3 className="text-3xl font-black text-black uppercase mb-2">
                      {getTeamName(prediction.visitor_team_id)}
                    </h3>
                    <span className="text-sm text-gray-500 font-bold uppercase tracking-wider">Visitante</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6 mb-8">
                <div className="bg-black p-8 text-center">
                  <div className="text-6xl font-black text-white mb-3">
                    {prediction.home_team_win_probability}%
                  </div>
                  <div className="text-sm text-gray-400 font-black uppercase tracking-wider">
                    Probabilidad Local
                  </div>
                </div>

                <div className="bg-black p-8 text-center">
                  <div className="text-6xl font-black text-white mb-3">
                    {prediction.visitor_team_win_probability}%
                  </div>
                  <div className="text-sm text-gray-400 font-black uppercase tracking-wider">
                    Probabilidad Visitante
                  </div>
                </div>
              </div>

              <div className="h-12 bg-gray-200 overflow-hidden flex mb-8">
                <div
                  className="bg-red-600 flex items-center justify-center text-white text-sm font-black"
                  style={{ width: `${prediction.home_team_win_probability}%` }}
                >
                  {prediction.home_team_win_probability > 15 && `${prediction.home_team_win_probability}%`}
                </div>
                <div
                  className="bg-gray-600 flex items-center justify-center text-white text-sm font-black"
                  style={{ width: `${prediction.visitor_team_win_probability}%` }}
                >
                  {prediction.visitor_team_win_probability > 15 && `${prediction.visitor_team_win_probability}%`}
                </div>
              </div>

              <div className="bg-black p-8 mb-8">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm text-gray-400 font-black uppercase tracking-widest mb-2">
                      Ganador Predicho
                    </div>
                    <div className="text-4xl font-black text-white uppercase">
                      {prediction.predicted_winner === 'home'
                        ? getTeamName(prediction.home_team_id)
                        : getTeamName(prediction.visitor_team_id)}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-gray-400 font-black uppercase tracking-widest mb-2">
                      Confianza
                    </div>
                    <span className={`inline-block px-6 py-3 text-sm font-black uppercase tracking-wider ${
                      prediction.confidence === 'high' ? 'bg-red-600 text-white' :
                      prediction.confidence === 'medium' ? 'bg-gray-300 text-black' :
                      'bg-gray-200 text-gray-600'
                    }`}>
                      {prediction.confidence === 'high' ? 'ALTA' :
                       prediction.confidence === 'medium' ? 'MEDIA' : 'BAJA'}
                    </span>
                  </div>
                </div>
              </div>

              {prediction.estimated_score && (
                <div className="bg-gray-100 p-8 mb-8">
                  <h3 className="text-2xl font-black uppercase tracking-wider text-black mb-6 pb-4 border-b-4 border-red-600">
                    Marcador Estimado
                  </h3>
                  <div className="flex items-center justify-center gap-12">
                    <div className="text-center">
                      <div className="text-6xl font-black text-black mb-2">
                        {prediction.estimated_score.home}
                      </div>
                      <div className="text-sm text-gray-500 font-black uppercase tracking-wider">Local</div>
                    </div>
                    <div className="text-4xl font-black text-gray-400">-</div>
                    <div className="text-center">
                      <div className="text-6xl font-black text-black mb-2">
                        {prediction.estimated_score.visitor}
                      </div>
                      <div className="text-sm text-gray-500 font-black uppercase tracking-wider">Visitante</div>
                    </div>
                  </div>
                </div>
              )}

              {prediction.factors && (
                <div className="border-t-4 border-black pt-8">
                  <h3 className="text-2xl font-black uppercase tracking-wider text-black mb-6">
                    Factores Analizados
                  </h3>
                  <div className="grid grid-cols-2 gap-6">
                    <div className="bg-gray-100 p-6">
                      <div className="text-xs text-gray-500 uppercase tracking-widest font-black mb-2">
                        Win Rate Local Reciente
                      </div>
                      <div className="text-4xl font-black text-black">
                        {prediction.factors.home_recent_win_rate}%
                      </div>
                      <div className="text-xs text-gray-500 uppercase mt-2">
                        {prediction.factors.home_recent_games} Juegos Analizados
                      </div>
                    </div>
                    <div className="bg-gray-100 p-6">
                      <div className="text-xs text-gray-500 uppercase tracking-widest font-black mb-2">
                        Win Rate Visitante Reciente
                      </div>
                      <div className="text-4xl font-black text-black">
                        {prediction.factors.visitor_recent_win_rate}%
                      </div>
                      <div className="text-xs text-gray-500 uppercase mt-2">
                        {prediction.factors.visitor_recent_games} Juegos Analizados
                      </div>
                    </div>
                  </div>
                </div>
              )}
              {prediction.head_to_head && (
                <div className="border-t-4 border-black pt-8 mt-8">
                  <h3 className="text-2xl font-black uppercase tracking-wider text-black mb-6">
                    Historial de Enfrentamientos
                  </h3>
                  <div className="bg-gray-100 p-8">
                    <div className="flex items-center justify-around">
                      <div className="text-center">
                        <div className="text-5xl font-black text-black mb-2">
                          {prediction.head_to_head.home_wins}
                        </div>
                        <div className="text-xs text-gray-500 uppercase tracking-widest font-black">
                          Victorias Local
                        </div>
                      </div>
                      <div className="text-center">
                        <div className="text-5xl font-black text-gray-400 mb-2">
                          {prediction.head_to_head.total_games}
                        </div>
                        <div className="text-xs text-gray-500 uppercase tracking-widest font-black">
                          Total Juegos
                        </div>
                      </div>
                      <div className="text-center">
                        <div className="text-5xl font-black text-black mb-2">
                          {prediction.head_to_head.visitor_wins}
                        </div>
                        <div className="text-xs text-gray-500 uppercase tracking-widest font-black">
                          Victorias Visitante
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {!prediction && !loading && (
          <div className="bg-white p-16 text-center">
            <div className="text-6xl text-gray-300 mb-6"></div>
            <p className="text-gray-500 text-lg font-bold uppercase tracking-wider">
              Select two teams to get a machine learning powered prediction
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default Predictions;
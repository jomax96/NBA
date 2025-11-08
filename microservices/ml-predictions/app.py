from flask import Flask, request, jsonify
from flask_cors import CORS
import mysql.connector
import os
import joblib
import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestClassifier
import logging

app = Flask(__name__)
CORS(app)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Configuración de BD
DB_CONFIG = {
    'host': os.getenv('MYSQL_HOST', 'localhost'),
    'user': os.getenv('MYSQL_USER', 'nba_user'),
    'password': os.getenv('MYSQL_PASSWORD', 'nba_password'),
    'database': os.getenv('MYSQL_DATABASE', 'nba_db')
}

# Modelo ML (cargado o entrenado)
ml_model = None

def get_db_connection():
    """Obtiene conexión a MySQL"""
    try:
        return mysql.connector.connect(**DB_CONFIG)
    except Exception as e:
        logger.error(f"Database connection error: {e}")
        return None

def load_or_train_model():
    """Carga modelo existente o entrena uno nuevo"""
    global ml_model
    model_path = 'models/game_predictor.pkl'
    
    try:
        if os.path.exists(model_path):
            ml_model = joblib.load(model_path)
            logger.info("Model loaded from file")
        else:
            logger.info("Training new model...")
            ml_model = train_model()
            os.makedirs('models', exist_ok=True)
            joblib.dump(ml_model, model_path)
            logger.info("Model trained and saved")
    except Exception as e:
        logger.error(f"Error loading/training model: {e}")
        ml_model = None

def train_model():
    """Entrena modelo de predicción"""
    conn = get_db_connection()
    if not conn:
        logger.warn("Cannot train model: DB unavailable")
        return None
    
    try:
        query = """
        SELECT 
            g.home_team_id, g.visitor_team_id,
            g.home_team_score, g.visitor_team_score,
            CASE WHEN g.home_team_score > g.visitor_team_score THEN 1 ELSE 0 END as home_win
        FROM games g
        WHERE g.home_team_score IS NOT NULL 
        AND g.visitor_team_score IS NOT NULL
        LIMIT 1000
        """
        
        df = pd.read_sql(query, conn)
        conn.close()
        
        if len(df) < 10:
            logger.warn("Not enough data to train model")
            return None
        
        # Features simples (en producción, usar más features)
        X = df[['home_team_id', 'visitor_team_id']].values
        y = df['home_win'].values
        
        # Entrenar Random Forest
        model = RandomForestClassifier(n_estimators=100, random_state=42)
        model.fit(X, y)
        
        return model
    except Exception as e:
        logger.error(f"Error training model: {e}")
        return None

def get_team_recent_stats(team_id, conn, limit=10):
    """Obtiene estadísticas recientes de un equipo"""
    try:
        query = """
        SELECT 
            AVG(CASE WHEN g.home_team_id = ? THEN g.home_team_score ELSE g.visitor_team_score END) as avg_points,
            AVG(CASE WHEN g.home_team_id = ? THEN 
                CASE WHEN g.home_team_score > g.visitor_team_score THEN 1 ELSE 0 END
            ELSE 
                CASE WHEN g.visitor_team_score > g.home_team_score THEN 1 ELSE 0 END
            END) as win_rate
        FROM games g
        WHERE (g.home_team_id = ? OR g.visitor_team_id = ?)
        AND g.home_team_score IS NOT NULL
        ORDER BY g.game_date DESC
        LIMIT ?
        """
        
        cursor = conn.cursor()
        cursor.execute(query, (team_id, team_id, team_id, team_id, limit))
        result = cursor.fetchone()
        cursor.close()
        
        return {
            'avg_points': float(result[0]) if result[0] else 100.0,
            'win_rate': float(result[1]) if result[1] else 0.5
        }
    except Exception as e:
        logger.error(f"Error getting team stats: {e}")
        return {'avg_points': 100.0, 'win_rate': 0.5}

@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'service': 'ml-predictions',
        'model_loaded': ml_model is not None
    })

@app.route('/predict', methods=['POST'])
def predict():
    """Predice resultado de partido"""
    try:
        data = request.json
        home_team_id = data.get('home_team_id')
        visitor_team_id = data.get('visitor_team_id')
        
        if not home_team_id or not visitor_team_id:
            return jsonify({'error': 'home_team_id and visitor_team_id required'}), 400
        
        conn = get_db_connection()
        if not conn:
            return jsonify({
                'error': 'Database unavailable',
                'prediction': 'unavailable'
            }), 503
        
        # Obtener estadísticas recientes
        home_stats = get_team_recent_stats(home_team_id, conn)
        visitor_stats = get_team_recent_stats(visitor_team_id, conn)
        conn.close()
        
        # Predicción simple basada en estadísticas
        if ml_model:
            try:
                # Usar modelo si está disponible
                prediction = ml_model.predict_proba([[home_team_id, visitor_team_id]])[0]
                home_win_prob = float(prediction[1])
            except:
                # Fallback a lógica simple
                home_win_prob = 0.5 + (home_stats['win_rate'] - visitor_stats['win_rate']) * 0.3
        else:
            # Lógica simple sin modelo
            home_win_prob = 0.5 + (home_stats['win_rate'] - visitor_stats['win_rate']) * 0.3
        
        home_win_prob = max(0.1, min(0.9, home_win_prob))  # Clamp entre 0.1 y 0.9
        
        # Estimar marcador
        estimated_home_score = int(home_stats['avg_points'])
        estimated_visitor_score = int(visitor_stats['avg_points'])
        
        return jsonify({
            'home_team_id': home_team_id,
            'visitor_team_id': visitor_team_id,
            'home_team_win_probability': round(home_win_prob * 100, 2),
            'visitor_team_win_probability': round((1 - home_win_prob) * 100, 2),
            'predicted_winner': 'home' if home_win_prob > 0.5 else 'visitor',
            'estimated_score': {
                'home': estimated_home_score,
                'visitor': estimated_visitor_score
            },
            'confidence': 'medium'
        })
        
    except Exception as e:
        logger.error(f"Prediction error: {e}")
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    # Cargar/entrenar modelo al iniciar
    load_or_train_model()
    
    port = int(os.getenv('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=False)


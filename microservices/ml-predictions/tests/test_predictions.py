import pytest
from app import app, get_team_recent_stats, get_db_connection

@pytest.fixture
def client():
    app.config['TESTING'] = True
    with app.test_client() as client:
        yield client

def test_health_endpoint(client):
    """Test health check endpoint"""
    response = client.get('/health')
    assert response.status_code == 200
    data = response.get_json()
    assert data['status'] == 'healthy'
    assert 'model_loaded' in data

def test_predict_missing_params(client):
    """Test prediction endpoint with missing parameters"""
    response = client.post('/predict', json={})
    assert response.status_code == 400

def test_predict_endpoint(client):
    """Test prediction endpoint with valid parameters"""
    response = client.post('/predict', json={
        'home_team_id': 1,
        'visitor_team_id': 2
    })
    # Puede ser 200 o 503 dependiendo de BD
    assert response.status_code in [200, 503]
    if response.status_code == 200:
        data = response.get_json()
        assert 'home_team_win_probability' in data
        assert 'visitor_team_win_probability' in data


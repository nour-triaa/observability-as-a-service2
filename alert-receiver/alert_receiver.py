from flask import Flask, request, jsonify
from datetime import datetime

app = Flask(__name__)
alerts_store = []

@app.route('/api/alerts', methods=['POST'])
def receive_alert():
    data = request.json
    for alert in data.get('alerts', []):
        alerts_store.append({
            'id': len(alerts_store) + 1,
            'name': alert.get('labels', {}).get('alertname', 'Unknown'),
            'severity': alert.get('labels', {}).get('severity', 'info'),
            'status': alert.get('status', 'firing'),
            'message': alert.get('annotations', {}).get('description', ''),
            'timestamp': datetime.now().isoformat(),
            'resolved': alert.get('status') == 'resolved'
        })
    return jsonify({'status': 'received'}), 200

@app.route('/api/alerts', methods=['GET'])
def get_alerts():
    return jsonify(alerts_store), 200

@app.route('/health', methods=['GET'])
def health():
    return jsonify({'status': 'ok'}), 200

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)

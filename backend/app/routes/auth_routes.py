from flask import Blueprint, request, jsonify

auth_bp = Blueprint('auth', __name__)

# Master password for production and COC changes
MASTER_PASSWORD = "241425"

@auth_bp.route('/verify-password', methods=['POST'])
def verify_password():
    """Verify password for production/COC changes"""
    try:
        data = request.get_json()
        password = data.get('password', '')
        
        if password == MASTER_PASSWORD:
            return jsonify({
                'success': True,
                'valid': True,
                'message': 'Password verified successfully'
            }), 200
        else:
            return jsonify({
                'success': True,
                'valid': False,
                'message': 'Invalid password'
            }), 200
            
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

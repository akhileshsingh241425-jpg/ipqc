from flask import Blueprint, request, jsonify, send_file
import os
import base64
from datetime import datetime
from werkzeug.utils import secure_filename
import json

ftr_upload_bp = Blueprint('ftr_upload', __name__)

UPLOAD_FOLDER = os.path.join(os.path.dirname(__file__), '../../uploads/ftr_reports')
GRAPHS_FOLDER = os.path.join(os.path.dirname(__file__), '../../uploads/iv_graphs')
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(GRAPHS_FOLDER, exist_ok=True)

ALLOWED_EXTENSIONS = {'pdf'}
ALLOWED_IMAGE_EXTENSIONS = {'png', 'jpg', 'jpeg'}

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def allowed_image(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_IMAGE_EXTENSIONS

# ============= IV GRAPH MANAGEMENT =============

@ftr_upload_bp.route('/api/ftr/graphs', methods=['GET'])
def get_graphs():
    """Get all uploaded IV curve graphs organized by wattage - returns base64 encoded images"""
    try:
        graphs = {}
        if os.path.exists(GRAPHS_FOLDER):
            for filename in os.listdir(GRAPHS_FOLDER):
                if allowed_image(filename):
                    # Extract wattage from filename (e.g., 630_1.png -> 630)
                    parts = filename.split('_')
                    if parts:
                        wattage = parts[0]
                        if wattage not in graphs:
                            graphs[wattage] = []
                        
                        # Read file and convert to base64
                        filepath = os.path.join(GRAPHS_FOLDER, filename)
                        try:
                            with open(filepath, 'rb') as f:
                                img_data = f.read()
                                # Determine mime type
                                ext = filename.rsplit('.', 1)[1].lower()
                                mime = 'image/jpeg' if ext in ['jpg', 'jpeg'] else 'image/png'
                                # Create base64 data URL
                                b64 = base64.b64encode(img_data).decode('utf-8')
                                graphs[wattage].append(f"data:{mime};base64,{b64}")
                        except Exception as e:
                            print(f"Error reading {filename}: {e}")
                            continue
        
        return jsonify({'success': True, 'graphs': graphs}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@ftr_upload_bp.route('/api/ftr/graphs/upload', methods=['POST'])
def upload_graphs():
    """Upload IV curve graph images for a specific wattage"""
    try:
        wattage = request.form.get('wattage')
        if not wattage:
            return jsonify({'error': 'Wattage not specified'}), 400
        
        if 'files' not in request.files:
            return jsonify({'error': 'No files provided'}), 400
        
        files = request.files.getlist('files')
        uploaded = []
        
        # Count existing graphs for this wattage
        existing_count = 0
        for f in os.listdir(GRAPHS_FOLDER):
            if f.startswith(f"{wattage}_"):
                existing_count += 1
        
        for i, file in enumerate(files):
            if file and allowed_image(file.filename):
                # Generate unique filename
                ext = file.filename.rsplit('.', 1)[1].lower()
                new_filename = f"{wattage}_{existing_count + i + 1}.{ext}"
                filepath = os.path.join(GRAPHS_FOLDER, new_filename)
                file.save(filepath)
                uploaded.append(f"/uploads/iv_graphs/{new_filename}")
        
        return jsonify({
            'success': True,
            'message': f'{len(uploaded)} graphs uploaded for {wattage}W',
            'uploaded': uploaded
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@ftr_upload_bp.route('/api/ftr/graphs/<wattage>', methods=['DELETE'])
def delete_graphs(wattage):
    """Delete all graphs for a specific wattage"""
    try:
        deleted = 0
        for filename in os.listdir(GRAPHS_FOLDER):
            if filename.startswith(f"{wattage}_"):
                os.remove(os.path.join(GRAPHS_FOLDER, filename))
                deleted += 1
        
        return jsonify({
            'success': True,
            'message': f'{deleted} graphs deleted for {wattage}W'
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@ftr_upload_bp.route('/api/ftr/graphs/<wattage>/<int:index>', methods=['DELETE'])
def delete_single_graph(wattage, index):
    """Delete a specific graph"""
    try:
        # Find and delete the specific file
        for filename in os.listdir(GRAPHS_FOLDER):
            if filename.startswith(f"{wattage}_{index}."):
                os.remove(os.path.join(GRAPHS_FOLDER, filename))
                return jsonify({'success': True, 'message': 'Graph deleted'}), 200
        
        return jsonify({'error': 'Graph not found'}), 404
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@ftr_upload_bp.route('/api/ftr/graphs/clear', methods=['DELETE'])
def clear_all_graphs():
    """Delete all graphs"""
    try:
        deleted = 0
        for filename in os.listdir(GRAPHS_FOLDER):
            if allowed_image(filename):
                os.remove(os.path.join(GRAPHS_FOLDER, filename))
                deleted += 1
        
        return jsonify({
            'success': True,
            'message': f'{deleted} graphs deleted'
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@ftr_upload_bp.route('/api/ftr/graph-image/<path:filename>', methods=['GET'])
def serve_graph_image(filename):
    """Serve graph image file"""
    try:
        return send_file(os.path.join(GRAPHS_FOLDER, filename), mimetype='image/png')
    except Exception as e:
        return jsonify({'error': str(e)}), 404

@ftr_upload_bp.route('/api/ftr/upload-bulk', methods=['POST'])
def upload_bulk_ftr():
    """Upload multiple FTR PDFs and return their file paths"""
    try:
        data = request.json
        
        if not data or 'reports' not in data:
            return jsonify({'error': 'No reports data provided'}), 400
        
        uploaded_files = []
        
        for report in data['reports']:
            if 'pdfData' not in report or 'serialNumber' not in report:
                continue
            
            # Decode base64 PDF data
            pdf_data = report['pdfData']
            if pdf_data.startswith('data:application/pdf;base64,'):
                pdf_data = pdf_data.replace('data:application/pdf;base64,', '')
            
            pdf_bytes = base64.b64decode(pdf_data)
            
            # Generate filename
            serial_number = report['serialNumber'].replace('/', '_').replace('\\', '_')
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            filename = f"FTR_{serial_number}_{timestamp}.pdf"
            filename = secure_filename(filename)
            
            # Save file
            filepath = os.path.join(UPLOAD_FOLDER, filename)
            with open(filepath, 'wb') as f:
                f.write(pdf_bytes)
            
            # Return relative path for database storage
            relative_path = f"/uploads/ftr_reports/{filename}"
            
            uploaded_files.append({
                'serialNumber': report['serialNumber'],
                'filePath': relative_path,
                'moduleType': report.get('moduleType', ''),
                'pmax': report.get('pmax', 0)
            })
        
        return jsonify({
            'success': True,
            'message': f'{len(uploaded_files)} FTR reports uploaded successfully',
            'files': uploaded_files
        }), 200
        
    except Exception as e:
        print(f"Error uploading FTR reports: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

@ftr_upload_bp.route('/api/ftr/upload-single', methods=['POST'])
def upload_single_ftr():
    """Upload single FTR PDF"""
    try:
        if 'file' not in request.files:
            return jsonify({'error': 'No file provided'}), 400
        
        file = request.files['file']
        
        if file.filename == '':
            return jsonify({'error': 'No file selected'}), 400
        
        if not allowed_file(file.filename):
            return jsonify({'error': 'Invalid file type. Only PDF allowed'}), 400
        
        # Get metadata
        serial_number = request.form.get('serialNumber', 'unknown')
        serial_number = serial_number.replace('/', '_').replace('\\', '_')
        
        # Generate filename
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        filename = f"FTR_{serial_number}_{timestamp}.pdf"
        filename = secure_filename(filename)
        
        # Save file
        filepath = os.path.join(UPLOAD_FOLDER, filename)
        file.save(filepath)
        
        # Return relative path
        relative_path = f"/uploads/ftr_reports/{filename}"
        
        return jsonify({
            'success': True,
            'message': 'FTR report uploaded successfully',
            'filePath': relative_path
        }), 200
        
    except Exception as e:
        print(f"Error uploading FTR: {str(e)}")
        return jsonify({'error': str(e)}), 500

from flask import Blueprint, request, jsonify, send_file
import os
import base64
from datetime import datetime
from werkzeug.utils import secure_filename

ftr_upload_bp = Blueprint('ftr_upload', __name__)

UPLOAD_FOLDER = os.path.join(os.path.dirname(__file__), '../../uploads/ftr_reports')
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

ALLOWED_EXTENSIONS = {'pdf'}

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

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

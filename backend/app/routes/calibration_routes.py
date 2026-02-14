"""
Calibration Routes - Manage calibration instruments and upload data
"""

from flask import Blueprint, request, jsonify, current_app
from app.models.calibration_data import CalibrationInstrument, CalibrationHistory
from app.models.database import db
from datetime import datetime, date
from werkzeug.utils import secure_filename
import json
import traceback
import os
import uuid
import base64
import requests
import time

calibration_bp = Blueprint('calibration', __name__, url_prefix='/api/calibration')

# Azure OCR Configuration - Set these in environment variables
AZURE_CV_KEY = os.environ.get('AZURE_CV_KEY', '')
AZURE_CV_ENDPOINT = os.environ.get('AZURE_CV_ENDPOINT', 'https://ocr-app14007.cognitiveservices.azure.com')

# Groq API Configuration - Set in environment variables
GROQ_API_KEY = os.environ.get('GROQ_API_KEY', '')
GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions'

# Allowed extensions for image uploads
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'pdf', 'webp'}

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def get_upload_folder():
    """Get calibration uploads folder"""
    folder = os.path.join(current_app.config.get('UPLOAD_FOLDER', 'uploads'), 'calibration_images')
    os.makedirs(folder, exist_ok=True)
    return folder


def parse_date(date_str):
    """Parse date from various formats"""
    if not date_str or date_str in ['NA', 'N/A', '-', '']:
        return None
    
    # Handle different date formats
    formats = [
        '%d/%b/%Y',      # 10/Dec/2024
        '%d/%m/%Y',      # 10/12/2024
        '%Y-%m-%d',      # 2024-12-10
        '%d.%m.%Y',      # 10.12.2024
        '%d-%m-%Y',      # 10-12-2024
        '%m/%d/%Y',      # 12/10/2024
        '%d %b %Y',      # 10 Dec 2024
        '%d-%b-%Y',      # 10-Dec-2024
    ]
    
    for fmt in formats:
        try:
            return datetime.strptime(str(date_str).strip(), fmt).date()
        except (ValueError, TypeError):
            continue
    
    return None


@calibration_bp.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'success': True,
        'message': 'Calibration API is running',
        'timestamp': datetime.now().isoformat(),
        'azure_ocr_configured': bool(AZURE_CV_KEY),
        'groq_ai_configured': bool(GROQ_API_KEY)
    }), 200


@calibration_bp.route('/scan-certificate', methods=['POST'])
def scan_certificate():
    """Scan certificate using Azure OCR + Groq AI and extract calibration data"""
    try:
        if 'certificate' not in request.files:
            return jsonify({'success': False, 'message': 'No certificate file provided'}), 400
        
        file = request.files['certificate']
        if file.filename == '':
            return jsonify({'success': False, 'message': 'No file selected'}), 400
        
        if not allowed_file(file.filename):
            return jsonify({'success': False, 'message': 'Invalid file type. Allowed: PNG, JPG, JPEG, PDF'}), 400
        
        # Check if API keys are configured
        if not AZURE_CV_KEY:
            return jsonify({
                'success': False, 
                'message': 'Azure OCR not configured. Please set AZURE_CV_KEY and AZURE_CV_ENDPOINT environment variables on server.',
                'error_type': 'config_error'
            }), 500
        if not GROQ_API_KEY:
            return jsonify({
                'success': False, 
                'message': 'Groq AI not configured. Please set GROQ_API_KEY environment variable on server.',
                'error_type': 'config_error'
            }), 500
        
        # Read file content
        file_content = file.read()
        
        # Step 1: Use Azure OCR to extract text
        extracted_text = ""
        try:
            # Azure OCR Read API
            ocr_url = f"{AZURE_CV_ENDPOINT}/vision/v3.2/read/analyze"
            
            headers = {
                'Ocp-Apim-Subscription-Key': AZURE_CV_KEY,
                'Content-Type': 'application/octet-stream'
            }
            
            # Submit image for OCR
            response = requests.post(ocr_url, headers=headers, data=file_content, timeout=30)
            
            if response.status_code == 202:
                # Get operation location for results
                operation_url = response.headers.get('Operation-Location')
                
                if not operation_url:
                    return jsonify({
                        'success': False,
                        'message': 'Azure OCR did not return operation URL'
                    }), 500
                
                # Poll for results
                result_headers = {'Ocp-Apim-Subscription-Key': AZURE_CV_KEY}
                max_retries = 15
                
                for retry in range(max_retries):
                    time.sleep(1.5)
                    result_response = requests.get(operation_url, headers=result_headers, timeout=30)
                    
                    if result_response.status_code != 200:
                        continue
                        
                    result = result_response.json()
                    
                    if result.get('status') == 'succeeded':
                        # Extract text from results
                        for read_result in result.get('analyzeResult', {}).get('readResults', []):
                            for line in read_result.get('lines', []):
                                extracted_text += line.get('text', '') + '\n'
                        break
                    elif result.get('status') == 'failed':
                        return jsonify({
                            'success': False, 
                            'message': 'Azure OCR processing failed'
                        }), 500
                    elif result.get('status') == 'running':
                        continue
            elif response.status_code == 401:
                return jsonify({
                    'success': False, 
                    'message': 'Azure OCR authentication failed. Check AZURE_CV_KEY.'
                }), 500
            elif response.status_code == 404:
                return jsonify({
                    'success': False, 
                    'message': 'Azure OCR endpoint not found. Check AZURE_CV_ENDPOINT.'
                }), 500
            else:
                return jsonify({
                    'success': False, 
                    'message': f'Azure OCR error: Status {response.status_code}'
                }), 500
                
        except Exception as ocr_error:
            traceback.print_exc()
            return jsonify({'success': False, 'message': f'OCR error: {str(ocr_error)}'}), 500
        
        if not extracted_text.strip():
            return jsonify({'success': False, 'message': 'No text found in certificate'}), 400
        
        # Step 2: Use Groq AI to parse extracted text - Optimized for ACUMEN & similar formats
        extraction_prompt = f"""You are an expert at extracting data from calibration certificates.
Most certificates are from ACUMEN MEASUREMENT & CALIBRATION SERVICES or similar labs.

OCR EXTRACTED TEXT:
---
{extracted_text}
---

EXTRACT these fields into JSON. Map the certificate fields correctly:

{{
  "certificate_no": "Look for: Certificate No (e.g., AMCS/25/0487)",
  "instrument_id": "Look for: Inst. Id No., Inst Id No, Asset ID (e.g., GSPL/MINS/002, GSPL/INS/001)",
  "machine_name": "Look for: Name under 'Instrument Details' (e.g., DIG. HIGE VOLTAGE INSULATION TESTER, VERNIER CALIPER)",
  "make": "Look for: Make (e.g., JINCHEN/CHT9984A, MITUTOYO)",
  "model_name": "Look for: Model in Make field or separate Model field",
  "item_sr_no": "Look for: Sr.No., Serial No (e.g., JCM90138_INGAU2310.C2-22)",
  "range_capacity": "Look for: Range (e.g., 0-150mm, 0-5kV, As Per Inst.)",
  "least_count": "Look for: Least Count, LC (e.g., 0.02mm, 1mm, As Per Inst.)",
  "location": "Look for: Location (e.g., PRODUCTION, QUALITY, STORE)",
  "calibration_agency": "This is the LAB NAME at top - ACUMEN MEASUREMENT & CALIBRATION SERVICES (OPC) PRIVATE LIMITED or similar",
  "date_of_calibration": "Look for: Date of Cali., Date of Calibration, Calibration Date - Convert to YYYY-MM-DD",
  "due_date": "Look for: Due Date of Cali., Suggested Due Date, Next Due Date, Valid Until - Convert to YYYY-MM-DD",
  "inspector": "Look for: Calibrated By (person name), Tested By, Technician name at bottom of certificate",
  "calibration_frequency": "Calculate from dates or look for validity period (usually 1 Year)",
  "calibration_standards": "Look for: Calibration Procedure (e.g., WI-03,05E) or Reference Standards used"
}}

SPECIFIC RULES FOR ACUMEN CERTIFICATES:
1. Certificate No format: AMCS/YY/XXXX (e.g., AMCS/25/0487)
2. Inst. Id No is the Instrument ID (e.g., GSPL/MINS/002)
3. User Name is the CUSTOMER, not relevant for instrument data
4. Date format in certificate: DD.MM.YYYY - convert to YYYY-MM-DD
5. calibration_agency should be "ACUMEN MEASUREMENT & CALIBRATION SERVICES" (or full name from header)
6. Look for "Calibrated By" section at bottom for inspector name (usually AMIT RAI or similar)

DATE CONVERSION (CRITICAL):
- 03.02.2025 → 2025-02-03
- 02.02.2026 → 2026-02-02
- 01/02/2025 → 2025-02-01

Return ONLY valid JSON - no markdown, no explanation, no extra text."""
        
        try:
            groq_response = requests.post(
                GROQ_API_URL,
                headers={
                    'Authorization': f'Bearer {GROQ_API_KEY}',
                    'Content-Type': 'application/json'
                },
                json={
                    'model': 'llama-3.3-70b-versatile',
                    'messages': [
                        {'role': 'user', 'content': extraction_prompt}
                    ],
                    'max_tokens': 1500,
                    'temperature': 0.1
                },
                timeout=60
            )
            
            if groq_response.status_code == 200:
                result = groq_response.json()
                ai_response = result['choices'][0]['message']['content']
                
                # Parse JSON from response
                json_text = ai_response
                if '```json' in ai_response:
                    json_text = ai_response.split('```json')[1].split('```')[0]
                elif '```' in ai_response:
                    json_text = ai_response.split('```')[1].split('```')[0]
                
                # Try to find JSON object in response
                json_text = json_text.strip()
                if not json_text.startswith('{'):
                    # Find first { and last }
                    start = json_text.find('{')
                    end = json_text.rfind('}')
                    if start != -1 and end != -1:
                        json_text = json_text[start:end+1]
                
                extracted_data = json.loads(json_text)
                
                # Clean up null values and normalize data
                cleaned_data = {}
                for key, value in extracted_data.items():
                    if value and value != 'null' and str(value).lower() not in ['none', 'n/a', 'na', 'not found', 'not available', 'null', '-']:
                        clean_value = str(value).strip()
                        # Remove any surrounding quotes that might have been included
                        if clean_value.startswith('"') and clean_value.endswith('"'):
                            clean_value = clean_value[1:-1]
                        cleaned_data[key] = clean_value
                
                # Count extracted fields
                fields_found = len(cleaned_data)
                
                return jsonify({
                    'success': True,
                    'message': f'Certificate scanned! {fields_found} fields extracted.',
                    'data': cleaned_data,
                    'fields_count': fields_found,
                    'ocr_text': extracted_text[:800],
                    'method': 'azure_ocr_groq_ai'
                }), 200
            else:
                error_msg = groq_response.text[:200] if groq_response.text else 'Unknown error'
                return jsonify({
                    'success': False,
                    'message': f'AI processing error (Status: {groq_response.status_code})',
                    'error_detail': error_msg,
                    'ocr_text': extracted_text[:500]
                }), 500
                
        except json.JSONDecodeError:
            return jsonify({
                'success': True,
                'message': 'OCR done, but AI parsing failed. Manual review needed.',
                'data': {},
                'ocr_text': extracted_text[:1000],
                'method': 'azure_ocr_only'
            }), 200
        except Exception as ai_error:
            return jsonify({
                'success': True,
                'message': f'OCR done, AI error: {str(ai_error)}',
                'data': {},
                'ocr_text': extracted_text[:1000]
            }), 200
        
    except Exception as e:
        traceback.print_exc()
        return jsonify({'success': False, 'message': str(e)}), 500


@calibration_bp.route('/upload-image/<int:instrument_id>', methods=['POST'])
def upload_instrument_image(instrument_id):
    """Upload image/certificate for an instrument"""
    try:
        instrument = CalibrationInstrument.query.get(instrument_id)
        if not instrument:
            return jsonify({'success': False, 'message': 'Instrument not found'}), 404
        
        if 'image' not in request.files:
            return jsonify({'success': False, 'message': 'No image file provided'}), 400
        
        file = request.files['image']
        if file.filename == '':
            return jsonify({'success': False, 'message': 'No file selected'}), 400
        
        if not allowed_file(file.filename):
            return jsonify({'success': False, 'message': 'Invalid file type. Allowed: PNG, JPG, JPEG, GIF, PDF, WEBP'}), 400
        
        # Generate unique filename
        ext = file.filename.rsplit('.', 1)[1].lower()
        filename = f"cal_{instrument_id}_{uuid.uuid4().hex[:8]}.{ext}"
        
        upload_folder = get_upload_folder()
        filepath = os.path.join(upload_folder, filename)
        
        # Delete old image if exists
        if instrument.image_path:
            old_path = os.path.join(current_app.config.get('UPLOAD_FOLDER', 'uploads'), instrument.image_path)
            if os.path.exists(old_path):
                try:
                    os.remove(old_path)
                except:
                    pass
        
        # Save new image
        file.save(filepath)
        
        # Update instrument record
        instrument.image_path = f"calibration_images/{filename}"
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': 'Image uploaded successfully',
            'image_path': instrument.image_path
        }), 200
        
    except Exception as e:
        traceback.print_exc()
        return jsonify({'success': False, 'message': str(e)}), 500


@calibration_bp.route('/delete-image/<int:instrument_id>', methods=['DELETE'])
def delete_instrument_image(instrument_id):
    """Delete image for an instrument"""
    try:
        instrument = CalibrationInstrument.query.get(instrument_id)
        if not instrument:
            return jsonify({'success': False, 'message': 'Instrument not found'}), 404
        
        if instrument.image_path:
            filepath = os.path.join(current_app.config.get('UPLOAD_FOLDER', 'uploads'), instrument.image_path)
            if os.path.exists(filepath):
                os.remove(filepath)
            
            instrument.image_path = None
            db.session.commit()
        
        return jsonify({'success': True, 'message': 'Image deleted successfully'}), 200
        
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@calibration_bp.route('/instruments', methods=['GET'])
def get_all_instruments():
    """Get all calibration instruments"""
    try:
        # Get filter parameters
        status_filter = request.args.get('status', None)
        location_filter = request.args.get('location', None)
        search = request.args.get('search', None)
        
        query = CalibrationInstrument.query
        
        # Apply filters
        if status_filter and status_filter != 'all':
            query = query.filter(CalibrationInstrument.status == status_filter)
        
        if location_filter and location_filter != 'all':
            query = query.filter(CalibrationInstrument.location == location_filter)
        
        if search:
            search_term = f'%{search}%'
            query = query.filter(
                db.or_(
                    CalibrationInstrument.instrument_id.ilike(search_term),
                    CalibrationInstrument.machine_name.ilike(search_term),
                    CalibrationInstrument.make.ilike(search_term),
                    CalibrationInstrument.certificate_no.ilike(search_term)
                )
            )
        
        instruments = query.order_by(CalibrationInstrument.sr_no).all()
        
        # Update statuses
        for instrument in instruments:
            instrument.update_status()
        db.session.commit()
        
        # Get summary statistics
        total = len(instruments)
        valid_count = sum(1 for i in instruments if i.status == 'valid')
        due_soon_count = sum(1 for i in instruments if i.status == 'due_soon')
        overdue_count = sum(1 for i in instruments if i.status == 'overdue')
        
        # Get unique locations
        locations = list(set(i.location for i in instruments if i.location))
        
        return jsonify({
            'success': True,
            'data': [i.to_dict() for i in instruments],
            'count': total,
            'summary': {
                'total': total,
                'valid': valid_count,
                'due_soon': due_soon_count,
                'overdue': overdue_count
            },
            'locations': sorted(locations)
        }), 200
        
    except Exception as e:
        traceback.print_exc()
        return jsonify({
            'success': False,
            'message': str(e)
        }), 500


@calibration_bp.route('/instruments/<int:instrument_id>', methods=['GET'])
def get_instrument(instrument_id):
    """Get single calibration instrument"""
    try:
        instrument = CalibrationInstrument.query.get(instrument_id)
        
        if not instrument:
            return jsonify({
                'success': False,
                'message': 'Instrument not found'
            }), 404
        
        instrument.update_status()
        db.session.commit()
        
        return jsonify({
            'success': True,
            'data': instrument.to_dict()
        }), 200
        
    except Exception as e:
        return jsonify({
            'success': False,
            'message': str(e)
        }), 500


@calibration_bp.route('/instruments', methods=['POST'])
def create_instrument():
    """Create new calibration instrument"""
    try:
        data = request.get_json()
        
        # Validate required fields
        if not data.get('instrument_id') or not data.get('machine_name'):
            return jsonify({
                'success': False,
                'message': 'Instrument ID and Machine Name are required'
            }), 400
        
        # Check for duplicate instrument_id
        existing = CalibrationInstrument.query.filter_by(instrument_id=data['instrument_id']).first()
        if existing:
            return jsonify({
                'success': False,
                'message': f'Instrument ID {data["instrument_id"]} already exists'
            }), 400
        
        instrument = CalibrationInstrument(
            sr_no=data.get('sr_no'),
            instrument_id=data['instrument_id'],
            machine_name=data['machine_name'],
            make=data.get('make'),
            model_name=data.get('model_name'),
            item_sr_no=data.get('item_sr_no'),
            range_capacity=data.get('range_capacity'),
            least_count=data.get('least_count'),
            location=data.get('location'),
            calibration_agency=data.get('calibration_agency'),
            date_of_calibration=parse_date(data.get('date_of_calibration')),
            due_date=parse_date(data.get('due_date')),
            inspector=data.get('inspector'),
            calibration_frequency=data.get('calibration_frequency'),
            calibration_standards=data.get('calibration_standards'),
            certificate_no=data.get('certificate_no'),
            notes=data.get('notes')
        )
        
        instrument.update_status()
        
        db.session.add(instrument)
        db.session.commit()
        
        # Log history
        history = CalibrationHistory(
            instrument_id=instrument.id,
            action='created',
            new_values=json.dumps(instrument.to_dict()),
            changed_by=data.get('changed_by', 'system')
        )
        db.session.add(history)
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': 'Instrument created successfully',
            'data': instrument.to_dict()
        }), 201
        
    except Exception as e:
        db.session.rollback()
        traceback.print_exc()
        return jsonify({
            'success': False,
            'message': str(e)
        }), 500


@calibration_bp.route('/instruments/<int:instrument_id>', methods=['PUT'])
def update_instrument(instrument_id):
    """Update calibration instrument"""
    try:
        instrument = CalibrationInstrument.query.get(instrument_id)
        
        if not instrument:
            return jsonify({
                'success': False,
                'message': 'Instrument not found'
            }), 404
        
        data = request.get_json()
        old_values = instrument.to_dict()
        
        # Update fields
        if 'sr_no' in data:
            instrument.sr_no = data['sr_no']
        if 'instrument_id' in data:
            instrument.instrument_id = data['instrument_id']
        if 'machine_name' in data:
            instrument.machine_name = data['machine_name']
        if 'make' in data:
            instrument.make = data['make']
        if 'model_name' in data:
            instrument.model_name = data['model_name']
        if 'item_sr_no' in data:
            instrument.item_sr_no = data['item_sr_no']
        if 'range_capacity' in data:
            instrument.range_capacity = data['range_capacity']
        if 'least_count' in data:
            instrument.least_count = data['least_count']
        if 'location' in data:
            instrument.location = data['location']
        if 'calibration_agency' in data:
            instrument.calibration_agency = data['calibration_agency']
        if 'date_of_calibration' in data:
            instrument.date_of_calibration = parse_date(data['date_of_calibration'])
        if 'due_date' in data:
            instrument.due_date = parse_date(data['due_date'])
        if 'inspector' in data:
            instrument.inspector = data['inspector']
        if 'calibration_frequency' in data:
            instrument.calibration_frequency = data['calibration_frequency']
        if 'calibration_standards' in data:
            instrument.calibration_standards = data['calibration_standards']
        if 'certificate_no' in data:
            instrument.certificate_no = data['certificate_no']
        if 'notes' in data:
            instrument.notes = data['notes']
        
        instrument.update_status()
        instrument.updated_at = datetime.utcnow()
        
        # Log history
        history = CalibrationHistory(
            instrument_id=instrument.id,
            action='updated',
            old_values=json.dumps(old_values),
            new_values=json.dumps(instrument.to_dict()),
            changed_by=data.get('changed_by', 'system')
        )
        db.session.add(history)
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': 'Instrument updated successfully',
            'data': instrument.to_dict()
        }), 200
        
    except Exception as e:
        db.session.rollback()
        traceback.print_exc()
        return jsonify({
            'success': False,
            'message': str(e)
        }), 500


@calibration_bp.route('/instruments/<int:instrument_id>', methods=['DELETE'])
def delete_instrument(instrument_id):
    """Delete calibration instrument"""
    try:
        instrument = CalibrationInstrument.query.get(instrument_id)
        
        if not instrument:
            return jsonify({
                'success': False,
                'message': 'Instrument not found'
            }), 404
        
        # Delete history records first
        CalibrationHistory.query.filter_by(instrument_id=instrument_id).delete()
        
        db.session.delete(instrument)
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': 'Instrument deleted successfully'
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({
            'success': False,
            'message': str(e)
        }), 500


@calibration_bp.route('/upload-excel', methods=['POST'])
def upload_excel():
    """Upload Excel file with calibration data"""
    try:
        if 'file' not in request.files:
            return jsonify({
                'success': False,
                'message': 'No file uploaded'
            }), 400
        
        file = request.files['file']
        
        if file.filename == '':
            return jsonify({
                'success': False,
                'message': 'No file selected'
            }), 400
        
        # Check file extension
        if not file.filename.endswith(('.xlsx', '.xls', '.csv')):
            return jsonify({
                'success': False,
                'message': 'Invalid file format. Please upload Excel (.xlsx, .xls) or CSV file'
            }), 400
        
        import pandas as pd
        import io
        
        # Read the file
        if file.filename.endswith('.csv'):
            df = pd.read_csv(io.BytesIO(file.read()))
        else:
            df = pd.read_excel(io.BytesIO(file.read()))
        
        print(f"📤 Uploaded file columns: {df.columns.tolist()}")
        print(f"📤 Total rows: {len(df)}")
        
        # Column mapping - flexible matching
        column_map = {
            'sr_no': ['Sr. No.', 'Sr.No.', 'Sr No', 'SrNo', 'Serial No', 'S.No', 'S. No.'],
            'instrument_id': ['Instrument ID', 'InstrumentID', 'Instrument_ID', 'ID'],
            'machine_name': ['Machine Name', 'MachineName', 'Machine_Name', 'Name', 'Equipment'],
            'make': ['Make', 'Brand', 'Manufacturer'],
            'model_name': ['Model Name', 'ModelName', 'Model_Name', 'Model'],
            'item_sr_no': ['Item Sr. No.', 'ItemSrNo', 'Item_Sr_No', 'Item Serial', 'Equipment Sr. No.'],
            'range_capacity': ['Range / Capacity', 'Range/Capacity', 'Range', 'Capacity'],
            'least_count': ['Least Count', 'LeastCount', 'Least_Count', 'LC'],
            'location': ['Location', 'Dept', 'Department'],
            'calibration_agency': ['Calibration Agency', 'CalibrationAgency', 'Agency', 'Lab'],
            'date_of_calibration': ['Date of Cali.', 'DateOfCali', 'Calibration Date', 'Cal Date', 'Date of Calibration'],
            'due_date': ['Due Date', 'DueDate', 'Due_Date', 'Next Due', 'Expiry Date'],
            'inspector': ['Inspector', 'Calibrated By', 'Engineer', 'Technician'],
            'calibration_frequency': ['Cali.  Fre.', 'CaliFre', 'Frequency', 'Cal Frequency', 'Cali. Fre.'],
            'calibration_standards': ['Calibration Standards', 'Standards', 'Reference', 'Ref. Standards'],
            'certificate_no': ['Certificate No.', 'CertificateNo', 'Cert No', 'Certificate', 'Cert. No.']
        }
        
        # Find matching columns
        def find_column(target_names):
            for col in df.columns:
                col_clean = str(col).strip()
                for target in target_names:
                    if col_clean.lower() == target.lower():
                        return col
            return None
        
        mapped_columns = {}
        for field, names in column_map.items():
            found_col = find_column(names)
            if found_col:
                mapped_columns[field] = found_col
        
        print(f"📤 Mapped columns: {mapped_columns}")
        
        # Process each row
        created_count = 0
        updated_count = 0
        skipped_count = 0
        errors = []
        
        for idx, row in df.iterrows():
            try:
                # Get instrument_id - required field
                instrument_id_col = mapped_columns.get('instrument_id')
                if not instrument_id_col or pd.isna(row.get(instrument_id_col)):
                    skipped_count += 1
                    continue
                
                instrument_id = str(row[instrument_id_col]).strip()
                if not instrument_id or instrument_id in ['nan', 'None', '']:
                    skipped_count += 1
                    continue
                
                # Get machine_name - required field
                machine_name_col = mapped_columns.get('machine_name')
                machine_name = str(row.get(machine_name_col, '')).strip() if machine_name_col else ''
                if not machine_name or machine_name in ['nan', 'None']:
                    machine_name = 'Unknown Equipment'
                
                # Check if instrument exists
                existing = CalibrationInstrument.query.filter_by(instrument_id=instrument_id).first()
                
                # Prepare data
                def get_value(field):
                    col = mapped_columns.get(field)
                    if col and col in row:
                        val = row[col]
                        if pd.isna(val):
                            return None
                        return str(val).strip() if val else None
                    return None
                
                sr_no_val = get_value('sr_no')
                sr_no = int(float(sr_no_val)) if sr_no_val and sr_no_val not in ['nan', 'None'] else None
                
                data = {
                    'sr_no': sr_no,
                    'instrument_id': instrument_id,
                    'machine_name': machine_name,
                    'make': get_value('make'),
                    'model_name': get_value('model_name'),
                    'item_sr_no': get_value('item_sr_no'),
                    'range_capacity': get_value('range_capacity'),
                    'least_count': get_value('least_count'),
                    'location': get_value('location'),
                    'calibration_agency': get_value('calibration_agency'),
                    'date_of_calibration': parse_date(get_value('date_of_calibration')),
                    'due_date': parse_date(get_value('due_date')),
                    'inspector': get_value('inspector'),
                    'calibration_frequency': get_value('calibration_frequency'),
                    'calibration_standards': get_value('calibration_standards'),
                    'certificate_no': get_value('certificate_no')
                }
                
                if existing:
                    # Update existing record
                    for key, value in data.items():
                        if value is not None:
                            setattr(existing, key, value)
                    existing.update_status()
                    updated_count += 1
                else:
                    # Create new record
                    instrument = CalibrationInstrument(**data)
                    instrument.update_status()
                    db.session.add(instrument)
                    created_count += 1
                
            except Exception as row_error:
                errors.append(f"Row {idx + 2}: {str(row_error)}")
                continue
        
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': f'Upload completed! Created: {created_count}, Updated: {updated_count}, Skipped: {skipped_count}',
            'details': {
                'created': created_count,
                'updated': updated_count,
                'skipped': skipped_count,
                'errors': errors[:10]  # Return first 10 errors
            }
        }), 200
        
    except Exception as e:
        db.session.rollback()
        traceback.print_exc()
        return jsonify({
            'success': False,
            'message': f'Upload failed: {str(e)}'
        }), 500


@calibration_bp.route('/export', methods=['GET'])
def export_to_excel():
    """Export calibration data to Excel"""
    try:
        import pandas as pd
        from io import BytesIO
        from flask import send_file
        
        instruments = CalibrationInstrument.query.order_by(CalibrationInstrument.sr_no).all()
        
        data = []
        for inst in instruments:
            data.append({
                'Sr. No.': inst.sr_no,
                'Instrument ID': inst.instrument_id,
                'Machine Name': inst.machine_name,
                'Make': inst.make,
                'Model Name': inst.model_name,
                'Item Sr. No.': inst.item_sr_no,
                'Range / Capacity': inst.range_capacity,
                'Least Count': inst.least_count,
                'Location': inst.location,
                'Calibration Agency': inst.calibration_agency,
                'Date of Cali.': inst.date_of_calibration.strftime('%d/%b/%Y') if inst.date_of_calibration else '',
                'Due Date': inst.due_date.strftime('%d/%b/%Y') if inst.due_date else '',
                'Inspector': inst.inspector,
                'Cali. Fre.': inst.calibration_frequency,
                'Calibration Standards': inst.calibration_standards,
                'Certificate No.': inst.certificate_no,
                'Status': inst.status,
                'Days Until Due': inst.get_days_until_due()
            })
        
        df = pd.DataFrame(data)
        
        output = BytesIO()
        with pd.ExcelWriter(output, engine='openpyxl') as writer:
            df.to_excel(writer, index=False, sheet_name='Calibration Data')
        output.seek(0)
        
        filename = f'Calibration_Data_{datetime.now().strftime("%Y%m%d_%H%M%S")}.xlsx'
        
        return send_file(
            output,
            mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            as_attachment=True,
            download_name=filename
        )
        
    except Exception as e:
        traceback.print_exc()
        return jsonify({
            'success': False,
            'message': str(e)
        }), 500


@calibration_bp.route('/dashboard-stats', methods=['GET'])
def get_dashboard_stats():
    """Get dashboard statistics"""
    try:
        instruments = CalibrationInstrument.query.all()
        
        # Update all statuses
        for inst in instruments:
            inst.update_status()
        db.session.commit()
        
        total = len(instruments)
        valid = sum(1 for i in instruments if i.status == 'valid')
        due_soon = sum(1 for i in instruments if i.status == 'due_soon')
        overdue = sum(1 for i in instruments if i.status == 'overdue')
        
        # Get instruments due in next 30 days
        upcoming = [i.to_dict() for i in instruments if i.status == 'due_soon']
        overdue_list = [i.to_dict() for i in instruments if i.status == 'overdue']
        
        # Group by location
        location_stats = {}
        for inst in instruments:
            loc = inst.location or 'Unknown'
            if loc not in location_stats:
                location_stats[loc] = {'total': 0, 'valid': 0, 'due_soon': 0, 'overdue': 0}
            location_stats[loc]['total'] += 1
            location_stats[loc][inst.status] = location_stats[loc].get(inst.status, 0) + 1
        
        # Group by agency
        agency_stats = {}
        for inst in instruments:
            agency = inst.calibration_agency or 'Unknown'
            if agency not in agency_stats:
                agency_stats[agency] = 0
            agency_stats[agency] += 1
        
        return jsonify({
            'success': True,
            'stats': {
                'total': total,
                'valid': valid,
                'due_soon': due_soon,
                'overdue': overdue,
                'valid_percentage': round((valid / total * 100) if total > 0 else 0, 1)
            },
            'upcoming_calibrations': upcoming[:10],
            'overdue_calibrations': overdue_list,
            'location_stats': location_stats,
            'agency_stats': agency_stats
        }), 200
        
    except Exception as e:
        traceback.print_exc()
        return jsonify({
            'success': False,
            'message': str(e)
        }), 500


@calibration_bp.route('/history/<int:instrument_id>', methods=['GET'])
def get_instrument_history(instrument_id):
    """Get calibration history for an instrument"""
    try:
        history = CalibrationHistory.query.filter_by(instrument_id=instrument_id)\
            .order_by(CalibrationHistory.created_at.desc()).all()
        
        return jsonify({
            'success': True,
            'data': [h.to_dict() for h in history]
        }), 200
        
    except Exception as e:
        return jsonify({
            'success': False,
            'message': str(e)
        }), 500

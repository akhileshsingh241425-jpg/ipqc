"""
Peel Test Routes
API endpoints for Peel Test Report management
"""

from flask import Blueprint, request, jsonify, send_file
from app.models.database import db
from app.models.peel_test_data import PeelTestReport, PeelTestResult
from app.services.peel_test_pdf_generator import generate_peel_test_pdf
from app.services.peel_test_excel_generator import generate_peel_test_excel
from datetime import datetime
import os
import zipfile

peel_test_bp = Blueprint('peel_test', __name__, url_prefix='/api/peel-test')


@peel_test_bp.route('/data', methods=['GET'])
def get_peel_test_data():
    """Get all peel test data"""
    try:
        reports = PeelTestReport.query.order_by(PeelTestReport.report_date.desc()).limit(100).all()
        
        return jsonify({
            "success": True,
            "data": [report.to_dict() for report in reports],
            "count": len(reports)
        }), 200
        
    except Exception as e:
        return jsonify({
            "success": False,
            "message": str(e),
            "data": []
        }), 200


@peel_test_bp.route('/reports', methods=['POST'])
def create_peel_test_report():
    """Create a new peel test report"""
    try:
        data = request.get_json()
        
        # Create report
        report = PeelTestReport(
            company_id=data.get('company_id'),
            report_date=datetime.strptime(data.get('report_date'), '%Y-%m-%d').date(),
            shift=data.get('shift'),
            operator_name=data.get('operator_name'),
            supervisor_name=data.get('supervisor_name'),
            equipment_id=data.get('equipment_id'),
            calibration_date=datetime.strptime(data.get('calibration_date'), '%Y-%m-%d').date() if data.get('calibration_date') else None
        )
        
        db.session.add(report)
        db.session.flush()  # Get report.id
        
        # Add test results
        for result_data in data.get('test_results', []):
            result = PeelTestResult(
                report_id=report.id,
                sample_id=result_data.get('sample_id'),
                batch_number=result_data.get('batch_number'),
                test_time=result_data.get('test_time'),
                test_type=result_data.get('test_type'),
                temperature=result_data.get('temperature'),
                humidity=result_data.get('humidity'),
                peel_speed=result_data.get('peel_speed'),
                peel_angle=result_data.get('peel_angle'),
                peel_strength=result_data.get('peel_strength'),
                unit=result_data.get('unit', 'N/cm'),
                min_requirement=result_data.get('min_requirement'),
                max_requirement=result_data.get('max_requirement'),
                result_status=result_data.get('result_status'),
                failure_mode=result_data.get('failure_mode'),
                remarks=result_data.get('remarks')
            )
            db.session.add(result)
        
        db.session.commit()
        
        return jsonify({
            'message': 'Peel test report created successfully',
            'report_id': report.id,
            'report': report.to_dict()
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@peel_test_bp.route('/reports', methods=['GET'])
def get_peel_test_reports():
    """Get all peel test reports"""
    try:
        company_id = request.args.get('company_id', type=int)
        
        query = PeelTestReport.query
        if company_id:
            query = query.filter_by(company_id=company_id)
        
        reports = query.order_by(PeelTestReport.report_date.desc()).all()
        
        return jsonify({
            'reports': [report.to_dict() for report in reports]
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@peel_test_bp.route('/reports/<int:report_id>', methods=['GET'])
def get_peel_test_report(report_id):
    """Get a specific peel test report"""
    try:
        report = PeelTestReport.query.get_or_404(report_id)
        return jsonify(report.to_dict()), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@peel_test_bp.route('/reports/<int:report_id>', methods=['PUT'])
def update_peel_test_report(report_id):
    """Update a peel test report"""
    try:
        report = PeelTestReport.query.get_or_404(report_id)
        data = request.get_json()
        
        # Update report fields
        if 'report_date' in data:
            report.report_date = datetime.strptime(data['report_date'], '%Y-%m-%d').date()
        if 'shift' in data:
            report.shift = data['shift']
        if 'operator_name' in data:
            report.operator_name = data['operator_name']
        if 'supervisor_name' in data:
            report.supervisor_name = data['supervisor_name']
        if 'equipment_id' in data:
            report.equipment_id = data['equipment_id']
        if 'calibration_date' in data:
            report.calibration_date = datetime.strptime(data['calibration_date'], '%Y-%m-%d').date()
        
        # Update test results if provided
        if 'test_results' in data:
            # Delete existing results
            PeelTestResult.query.filter_by(report_id=report_id).delete()
            
            # Add new results
            for result_data in data['test_results']:
                result = PeelTestResult(
                    report_id=report.id,
                    sample_id=result_data.get('sample_id'),
                    batch_number=result_data.get('batch_number'),
                    test_time=result_data.get('test_time'),
                    test_type=result_data.get('test_type'),
                    temperature=result_data.get('temperature'),
                    humidity=result_data.get('humidity'),
                    peel_speed=result_data.get('peel_speed'),
                    peel_angle=result_data.get('peel_angle'),
                    peel_strength=result_data.get('peel_strength'),
                    unit=result_data.get('unit', 'N/cm'),
                    min_requirement=result_data.get('min_requirement'),
                    max_requirement=result_data.get('max_requirement'),
                    result_status=result_data.get('result_status'),
                    failure_mode=result_data.get('failure_mode'),
                    remarks=result_data.get('remarks')
                )
                db.session.add(result)
        
        report.updated_at = datetime.utcnow()
        db.session.commit()
        
        return jsonify({
            'message': 'Peel test report updated successfully',
            'report': report.to_dict()
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@peel_test_bp.route('/reports/<int:report_id>', methods=['DELETE'])
def delete_peel_test_report(report_id):
    """Delete a peel test report"""
    try:
        report = PeelTestReport.query.get_or_404(report_id)
        db.session.delete(report)
        db.session.commit()
        
        return jsonify({'message': 'Peel test report deleted successfully'}), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@peel_test_bp.route('/reports/<int:report_id>/pdf', methods=['GET'])
def download_peel_test_pdf(report_id):
    """Generate and download PDF report"""
    try:
        report = PeelTestReport.query.get_or_404(report_id)
        
        # Generate PDF
        pdf_path = generate_peel_test_pdf(report)
        
        return send_file(
            pdf_path,
            mimetype='application/pdf',
            as_attachment=True,
            download_name=f'peel_test_report_{report_id}.pdf'
        )
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@peel_test_bp.route('/test-types', methods=['GET'])
def get_test_types():
    """Get available test types"""
    test_types = [
        'EVA to Glass',
        'EVA to Backsheet',
        'Cell to EVA',
        'Ribbon to Busbar',
        'Backsheet to Frame',
        'Junction Box Adhesion',
        'Encapsulant Adhesion'
    ]
    return jsonify({'test_types': test_types}), 200


@peel_test_bp.route('/failure-modes', methods=['GET'])
def get_failure_modes():
    """Get available failure modes"""
    failure_modes = [
        'Adhesive failure at interface',
        'Cohesive failure in EVA',
        'Cohesive failure in adhesive',
        'Interfacial failure',
        'Mixed mode failure',
        'Delamination',
        'No failure (passed)'
    ]
    return jsonify({'failure_modes': failure_modes}), 200


@peel_test_bp.route('/generate-excel', methods=['POST'])
def generate_peel_test_excel_report():
    """Generate Excel reports for peel test based on number of stringers"""
    try:
        data = request.get_json()
        
        date_str = data.get('date')
        stringer_count = int(data.get('stringer_count', 1))
        side_type = data.get('side_type', 'Back')  # Front or Back
        
        # Parse date
        if date_str:
            report_date = datetime.strptime(date_str, '%Y-%m-%d')
        else:
            report_date = datetime.now()
        
        # Ensure output folder exists (use temp directory to avoid watchdog reload)
        import tempfile
        output_folder = os.path.join(tempfile.gettempdir(), 'peel_test_reports')
        if not os.path.exists(output_folder):
            os.makedirs(output_folder)
        
        generated_files = []
        
        # Generate one Excel file per line (each file has 12 sheets)
        for line_num in range(1, stringer_count + 1):
            excel_file = generate_peel_test_excel(line_num, report_date, output_folder)
            generated_files.append(excel_file)
        
        # Verify all files exist
        for file_path in generated_files:
            if not os.path.exists(file_path):
                return jsonify({'error': f'Failed to generate file: {os.path.basename(file_path)}'}), 500
        
        # If only 1 stringer, return single file
        if len(generated_files) == 1:
            return send_file(
                generated_files[0],
                mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                as_attachment=True,
                download_name=os.path.basename(generated_files[0])
            )
        
        # If multiple stringers, create a ZIP
        zip_filename = f'PeelTest_Reports_{report_date.strftime("%Y%m%d")}.zip'
        zip_path = os.path.join(output_folder, zip_filename)
        
        with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
            for file_path in generated_files:
                zipf.write(file_path, os.path.basename(file_path))
        
        # Verify ZIP was created
        if not os.path.exists(zip_path):
            return jsonify({'error': 'Failed to create ZIP file'}), 500
        
        response = send_file(
            zip_path,
            mimetype='application/zip',
            as_attachment=True,
            download_name=zip_filename
        )
        
        # Clean up old files (keep only last 10)
        try:
            import glob
            all_files = glob.glob(os.path.join(output_folder, '*'))
            all_files = sorted(all_files, key=os.path.getmtime)
            if len(all_files) > 20:
                for old_file in all_files[:-20]:
                    try:
                        os.remove(old_file)
                    except:
                        pass
        except:
            pass
        
        return response
        
    except Exception as e:
        return jsonify({'error': str(e), 'message': 'Failed to generate Excel report'}), 500

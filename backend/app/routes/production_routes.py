from flask import Blueprint, request, send_file, jsonify
from app.services.production_pdf_generator import ProductionPDFGenerator
from app.services.excel_generator import generate_production_excel
from datetime import datetime
import os

production_bp = Blueprint('production', __name__)

@production_bp.route('/api/production/<int:company_id>/days', methods=['GET'])
def get_production_days(company_id):
    """Get all production days for a company"""
    try:
        from app.models.database import db
        from sqlalchemy import text
        
        # Get production days from database
        query = text("""
            SELECT DISTINCT 
                production_date as date,
                COUNT(*) as record_count
            FROM production_records 
            WHERE company_id = :company_id
            GROUP BY production_date
            ORDER BY production_date DESC
        """)
        
        result = db.session.execute(query, {'company_id': company_id}).fetchall()
        
        days = []
        for row in result:
            days.append({
                'id': company_id,  # Using company_id as placeholder
                'date': str(row[0]) if row[0] else None,
                'record_count': row[1]
            })
        
        return jsonify(days), 200
        
    except Exception as e:
        return jsonify({
            "error": str(e),
            "data": []
        }), 200


@production_bp.route('/api/generate-production-report', methods=['POST'])
def generate_production_report():
    """Generate production report PDF"""
    try:
        data = request.json
        
        # Validate required fields
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        
        # Generate PDF
        pdf_generator = ProductionPDFGenerator()
        pdf_buffer = pdf_generator.generate_production_report(data, 'production_report.pdf')
        
        # Save to generated_pdfs folder
        output_dir = os.path.join(os.path.dirname(__file__), '../../generated_pdfs')
        os.makedirs(output_dir, exist_ok=True)
        
        # Generate unique filename with company name and timestamp to prevent overwrite
        company_name = data.get('company_name', 'Unknown').replace(' ', '_').replace('/', '_')
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        filename = f"{company_name}_Production_Report_{data.get('start_date')}_{data.get('end_date')}_{timestamp}.pdf"
        filepath = os.path.join(output_dir, filename)
        
        with open(filepath, 'wb') as f:
            f.write(pdf_buffer.getvalue())
        
        # Return the PDF
        pdf_buffer.seek(0)
        return send_file(
            pdf_buffer,
            mimetype='application/pdf',
            as_attachment=True,
            download_name=filename
        )
        
    except Exception as e:
        print(f"Error generating production report: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

@production_bp.route('/api/generate-production-excel', methods=['POST'])
def generate_production_excel_report():
    """Generate production report Excel"""
    try:
        data = request.json
        
        # Validate required fields
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        
        # Extract data
        company = data.get('company', {})
        production_data = data.get('production_data', [])
        rejections = data.get('rejections', [])
        start_date = data.get('start_date', '')
        end_date = data.get('end_date', '')
        cells_received_qty = data.get('cells_received_qty', 0)
        cells_received_mw = data.get('cells_received_mw', 0)
        report_options = data.get('report_options', {})
        
        # Generate Excel
        filepath = generate_production_excel(
            company, 
            production_data, 
            rejections, 
            start_date, 
            end_date,
            cells_received_qty,
            cells_received_mw,
            report_options
        )
        
        # Return the Excel file
        return send_file(
            filepath,
            mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            as_attachment=True,
            download_name=os.path.basename(filepath)
        )
        
    except Exception as e:
        print(f"Error generating Excel report: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

@production_bp.route('/api/generate-consolidated-report', methods=['POST'])
def generate_consolidated_report():
    """Generate consolidated report with production + COCs + IQC + IPQC"""
    try:
        from app.services.consolidated_report_generator import ConsolidatedReportGenerator
        
        data = request.json
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        
        company_name = data.get('company_name')
        from_date = data.get('from_date')
        to_date = data.get('to_date')
        
        if not all([company_name, from_date, to_date]):
            return jsonify({'error': 'company_name, from_date, and to_date are required'}), 400
        
        # Generate consolidated report
        generator = ConsolidatedReportGenerator()
        pdf_buffer = generator.generate_consolidated_report(company_name, from_date, to_date)
        
        # Save to generated_pdfs folder
        output_dir = os.path.join(os.path.dirname(__file__), '../../generated_pdfs')
        os.makedirs(output_dir, exist_ok=True)
        
        filename = f"Consolidated_Report_{company_name}_{from_date}_{to_date}.pdf"
        filepath = os.path.join(output_dir, filename)
        
        with open(filepath, 'wb') as f:
            f.write(pdf_buffer.getvalue())
        
        # Return the PDF
        pdf_buffer.seek(0)
        return send_file(
            pdf_buffer,
            mimetype='application/pdf',
            as_attachment=True,
            download_name=filename
        )
        
    except Exception as e:
        print(f"Error generating consolidated report: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

"""
PDI Documentation Generator Routes
Generates complete PDI documentation package:
- IPQC Report (PDF)
- Witness Report (Excel)
- Calibration Instrument List (Excel)
- Sampling Plan (Excel)
- MOM - Minutes of Meeting (Excel)
All in one ZIP download
"""

from flask import Blueprint, request, jsonify, send_file, current_app
from app.models.database import db
from sqlalchemy import text
from datetime import datetime, timedelta
import os
import io
import zipfile
import random
import traceback
import json
import math

try:
    import openpyxl
    from openpyxl.styles import Font, Alignment, PatternFill, Border, Side
    from openpyxl.utils import get_column_letter
    EXCEL_AVAILABLE = True
except ImportError:
    EXCEL_AVAILABLE = False

pdi_doc_bp = Blueprint('pdi_doc', __name__)

# ============ Styles ============
if EXCEL_AVAILABLE:
    thin_border = Border(
        left=Side(style='thin'), right=Side(style='thin'),
        top=Side(style='thin'), bottom=Side(style='thin')
    )
    header_fill = PatternFill(start_color="1565C0", end_color="1565C0", fill_type="solid")
    header_font = Font(bold=True, color="FFFFFF", size=11)
    title_fill = PatternFill(start_color="0D47A1", end_color="0D47A1", fill_type="solid")
    title_font = Font(bold=True, color="FFFFFF", size=14)
    green_fill = PatternFill(start_color="4CAF50", end_color="4CAF50", fill_type="solid")
    light_fill = PatternFill(start_color="E3F2FD", end_color="E3F2FD", fill_type="solid")


# ============ Helper Functions ============

def get_companies():
    """Get list of companies from database"""
    try:
        result = db.session.execute(text("""
            SELECT DISTINCT company_id, company_name 
            FROM companies 
            ORDER BY company_name
        """))
        companies = []
        for row in result.fetchall():
            companies.append({
                'id': row[0],
                'name': row[1]
            })
        return companies
    except Exception:
        # Fallback: try ftr_master_serials
        try:
            result = db.session.execute(text("""
                SELECT DISTINCT company_id 
                FROM ftr_master_serials 
                ORDER BY company_id
            """))
            return [{'id': row[0], 'name': row[0]} for row in result.fetchall()]
        except Exception:
            return []


def get_pdis_for_company(company_id):
    """Get PDI batches for a company"""
    try:
        result = db.session.execute(text("""
            SELECT id, pdi_number, total_modules, created_at
            FROM pdi_batches
            WHERE company_id = :cid
            ORDER BY created_at DESC
        """), {'cid': company_id})
        pdis = []
        for row in result.fetchall():
            pdis.append({
                'id': row[0],
                'pdi_number': row[1],
                'total_modules': row[2],
                'created_at': row[3].isoformat() if row[3] else None
            })
        return pdis
    except Exception as e:
        print(f"Error getting PDIs: {e}")
        return []


def get_serials_for_pdi(pdi_id):
    """Get serial numbers from a PDI batch"""
    try:
        result = db.session.execute(text("""
            SELECT serial_number
            FROM module_serial_numbers
            WHERE pdi_batch_id = :pid
            ORDER BY serial_number
        """), {'pid': pdi_id})
        return [row[0] for row in result.fetchall()]
    except Exception as e:
        print(f"Error getting serials: {e}")
        return []


def get_ftr_data(serial_numbers):
    """Get FTR data for serial numbers"""
    if not serial_numbers:
        return {}
    try:
        placeholders = ','.join([f':s{i}' for i in range(len(serial_numbers))])
        params = {f's{i}': s for i, s in enumerate(serial_numbers)}
        result = db.session.execute(text(f"""
            SELECT serial_number, pmax, isc, voc, ipm, vpm, ff, efficiency, binning
            FROM ftr_master_serials
            WHERE serial_number IN ({placeholders})
        """), params)
        data = {}
        for row in result.fetchall():
            data[row[0]] = {
                'pmax': float(row[1]) if row[1] else 0,
                'isc': float(row[2]) if row[2] else 0,
                'voc': float(row[3]) if row[3] else 0,
                'ipm': float(row[4]) if row[4] else 0,
                'vpm': float(row[5]) if row[5] else 0,
                'ff': float(row[6]) if row[6] else 0,
                'efficiency': float(row[7]) if row[7] else 0,
                'binning': row[8] if row[8] else ''
            }
        return data
    except Exception as e:
        print(f"Error getting FTR data: {e}")
        return {}


def get_calibration_instruments():
    """Get calibration instruments from database"""
    try:
        result = db.session.execute(text("""
            SELECT sr_no, instrument_id, machine_name, make, model_name,
                   item_sr_no, range_capacity, least_count, location,
                   calibration_agency, date_of_calibration, due_date,
                   calibration_frequency, calibration_standards, certificate_no, status
            FROM calibration_instruments
            ORDER BY sr_no
        """))
        instruments = []
        for row in result.fetchall():
            instruments.append({
                'sr_no': row[0],
                'instrument_id': row[1],
                'machine_name': row[2],
                'make': row[3],
                'model_name': row[4],
                'item_sr_no': row[5],
                'range_capacity': row[6],
                'least_count': row[7],
                'location': row[8],
                'calibration_agency': row[9],
                'date_of_calibration': row[10].strftime('%d/%m/%Y') if row[10] else '',
                'due_date': row[11].strftime('%d/%m/%Y') if row[11] else '',
                'calibration_frequency': row[12],
                'calibration_standards': row[13],
                'certificate_no': row[14],
                'status': row[15]
            })
        return instruments
    except Exception as e:
        print(f"Error getting calibration instruments: {e}")
        return []


def aql_sample_size(lot_size, level='II'):
    """Calculate AQL sample size per IS 2500 / ISO 2859"""
    # AQL Table for General Inspection Level II
    aql_table = [
        (8, 5), (15, 5), (25, 8), (50, 13), (90, 20),
        (150, 32), (280, 50), (500, 80), (1200, 125),
        (3200, 200), (10000, 315), (35000, 500),
        (150000, 800), (500000, 1250), (float('inf'), 2000)
    ]
    for max_lot, sample in aql_table:
        if lot_size <= max_lot:
            return sample
    return 2000


# ============ ROUTES ============

@pdi_doc_bp.route('/health', methods=['GET'])
def health_check():
    """Health check"""
    return jsonify({
        'success': True,
        'message': 'PDI Docs API is running',
        'version': 'v4',
        'excel_available': EXCEL_AVAILABLE
    }), 200


@pdi_doc_bp.route('/companies', methods=['GET'])
def list_companies():
    """Get companies for dropdown"""
    companies = get_companies()
    return jsonify({
        'success': True,
        'companies': companies
    }), 200


@pdi_doc_bp.route('/pdis/<company_id>', methods=['GET'])
def list_pdis(company_id):
    """Get PDI batches for a company"""
    pdis = get_pdis_for_company(company_id)
    return jsonify({
        'success': True,
        'pdis': pdis
    }), 200


@pdi_doc_bp.route('/serials/<int:pdi_id>', methods=['GET'])
def list_serials(pdi_id):
    """Get serial numbers for a PDI"""
    serials = get_serials_for_pdi(pdi_id)
    return jsonify({
        'success': True,
        'serials': serials,
        'count': len(serials)
    }), 200


@pdi_doc_bp.route('/template-info', methods=['GET'])
def template_info():
    """Get IPQC template info (stages/checkpoints count)"""
    from app.models.ipqc_data import IPQCTemplate
    template = IPQCTemplate.get_template()
    total_checkpoints = sum(len(s.get('checkpoints', [])) for s in template)
    return jsonify({
        'success': True,
        'total_stages': len(template),
        'total_checkpoints': total_checkpoints
    }), 200


@pdi_doc_bp.route('/generate', methods=['POST'])
def generate_pdi_docs():
    """
    Generate complete PDI Documentation Package (ZIP)
    
    Expected JSON:
    {
        "company_id": "Rays Power",
        "company_name": "Rays Power",
        "pdi_id": 5,
        "pdi_number": "PDI-001",
        "serial_numbers": ["GS04890TG3002551892", ...],
        "production_days": 3,
        "report_date": "01/03/2026",
        "module_type": "G2G580",
        "documents": ["ipqc", "witness", "calibration", "sampling", "mom"]
    }
    """
    if not EXCEL_AVAILABLE:
        return jsonify({'success': False, 'error': 'openpyxl not installed'}), 500
    
    try:
        data = request.json
        if not data:
            return jsonify({'success': False, 'error': 'No data provided'}), 400
        
        company_id = data.get('company_id', '')
        company_name = data.get('company_name', company_id)
        pdi_number = data.get('pdi_number', 'PDI-001')
        serial_numbers = data.get('serial_numbers', [])
        production_days = data.get('production_days', 3)
        report_date = data.get('report_date', datetime.now().strftime('%d/%m/%Y'))
        module_type = data.get('module_type', 'G2G580')
        requested_docs = data.get('documents', ['ipqc', 'witness', 'calibration', 'sampling', 'mom'])
        
        if not serial_numbers:
            return jsonify({'success': False, 'error': 'No serial numbers provided'}), 400
        
        total_qty = len(serial_numbers)
        
        # Get FTR data for serials
        ftr_data = get_ftr_data(serial_numbers)
        
        # Get calibration instruments
        calibration_instruments = get_calibration_instruments()
        
        # Calculate sample size
        sample_size = min(aql_sample_size(total_qty), total_qty)
        sampled_serials = random.sample(serial_numbers, sample_size) if sample_size < total_qty else serial_numbers
        
        # Create ZIP in memory
        zip_buffer = io.BytesIO()
        
        with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zf:
            
            # 1. IPQC Report
            if 'ipqc' in requested_docs:
                try:
                    ipqc_buffer = generate_ipqc_excel_doc(
                        company_name, pdi_number, serial_numbers, 
                        production_days, report_date, module_type, sampled_serials
                    )
                    zf.writestr(f"01_IPQC_Report_{pdi_number}.xlsx", ipqc_buffer.getvalue())
                except Exception as e:
                    print(f"IPQC generation error: {e}")
                    traceback.print_exc()
            
            # 2. Witness Report
            if 'witness' in requested_docs:
                try:
                    witness_buffer = generate_witness_excel_doc(
                        company_name, pdi_number, serial_numbers,
                        report_date, ftr_data, module_type
                    )
                    zf.writestr(f"02_Witness_Report_{pdi_number}.xlsx", witness_buffer.getvalue())
                except Exception as e:
                    print(f"Witness generation error: {e}")
                    traceback.print_exc()
            
            # 3. Calibration Instrument List
            if 'calibration' in requested_docs:
                try:
                    cal_buffer = generate_calibration_excel_doc(
                        company_name, pdi_number, calibration_instruments, report_date
                    )
                    zf.writestr(f"03_Calibration_Instruments_{pdi_number}.xlsx", cal_buffer.getvalue())
                except Exception as e:
                    print(f"Calibration generation error: {e}")
                    traceback.print_exc()
            
            # 4. Sampling Plan
            if 'sampling' in requested_docs:
                try:
                    sampling_buffer = generate_sampling_plan_doc(
                        company_name, pdi_number, total_qty,
                        sample_size, sampled_serials, report_date
                    )
                    zf.writestr(f"04_Sampling_Plan_{pdi_number}.xlsx", sampling_buffer.getvalue())
                except Exception as e:
                    print(f"Sampling plan generation error: {e}")
                    traceback.print_exc()
            
            # 5. MOM (Minutes of Meeting)
            if 'mom' in requested_docs:
                try:
                    mom_buffer = generate_mom_doc(
                        company_name, company_id, pdi_number,
                        total_qty, report_date, ftr_data, serial_numbers
                    )
                    zf.writestr(f"05_MOM_{pdi_number}.xlsx", mom_buffer.getvalue())
                except Exception as e:
                    print(f"MOM generation error: {e}")
                    traceback.print_exc()
        
        zip_buffer.seek(0)
        
        filename = f"PDI_Documentation_{pdi_number}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.zip"
        
        return send_file(
            zip_buffer,
            mimetype='application/zip',
            as_attachment=True,
            download_name=filename
        )
        
    except Exception as e:
        print(f"PDI Docs generate error: {e}")
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500


# ============ DOCUMENT GENERATORS ============

def apply_cell_style(ws, row, col, value, font=None, fill=None, alignment=None, border=None):
    """Helper to apply style to a cell"""
    cell = ws.cell(row=row, column=col, value=value)
    if font:
        cell.font = font
    if fill:
        cell.fill = fill
    if alignment:
        cell.alignment = alignment
    else:
        cell.alignment = Alignment(horizontal='center', vertical='center', wrap_text=True)
    if border:
        cell.border = border
    else:
        cell.border = thin_border
    return cell


def generate_ipqc_excel_doc(company_name, pdi_number, serial_numbers, production_days, report_date, module_type, sampled_serials):
    """Generate IPQC Report Excel"""
    from app.models.ipqc_data import IPQCTemplate
    from app.services.form_generator import IPQCFormGenerator
    
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "IPQC Report"
    
    # Title
    ws.merge_cells('A1:H1')
    apply_cell_style(ws, 1, 1, f"IPQC INSPECTION REPORT - {company_name}", title_font, title_fill)
    ws.row_dimensions[1].height = 30
    
    # Info rows
    info = [
        ('PDI Number', pdi_number, 'Date', report_date),
        ('Total Modules', len(serial_numbers), 'Production Days', production_days),
        ('Module Type', module_type, 'Sample Size', len(sampled_serials)),
    ]
    
    row = 2
    for label1, val1, label2, val2 in info:
        apply_cell_style(ws, row, 1, label1, Font(bold=True), light_fill)
        apply_cell_style(ws, row, 2, val1)
        ws.merge_cells(f'C{row}:D{row}')
        apply_cell_style(ws, row, 3, '')  # merged placeholder
        apply_cell_style(ws, row, 5, label2, Font(bold=True), light_fill)
        apply_cell_style(ws, row, 6, val2)
        row += 1
    
    row += 1
    
    # Stage headers
    headers = ['Sr.No', 'Stage', 'Checkpoint', 'Acceptance Criteria', 'Sample Size', 'Frequency', 'Result', 'Remarks']
    for col, h in enumerate(headers, 1):
        apply_cell_style(ws, row, col, h, header_font, header_fill)
    
    row += 1
    
    # Auto-fill stages using IPQCFormGenerator
    generator = IPQCFormGenerator()
    form_data = generator.generate_form(
        date=report_date,
        shift='A',
        customer_id=company_name,
        po_number=pdi_number,
        module_count=len(serial_numbers)
    )
    
    for stage in form_data.get('stages', []):
        stage_name = stage.get('stage', '')
        checkpoints = stage.get('checkpoints', [])
        sr_no = stage.get('sr_no', '')
        
        for i, cp in enumerate(checkpoints):
            apply_cell_style(ws, row, 1, sr_no if i == 0 else '')
            apply_cell_style(ws, row, 2, stage_name if i == 0 else '')
            apply_cell_style(ws, row, 3, cp.get('checkpoint', ''))
            apply_cell_style(ws, row, 4, cp.get('acceptance_criteria', ''))
            apply_cell_style(ws, row, 5, cp.get('sample_size', ''))
            apply_cell_style(ws, row, 6, cp.get('frequency', ''))
            result = cp.get('monitoring_result', 'OK')
            apply_cell_style(ws, row, 7, result, 
                           font=Font(color="008000" if result == 'OK' else "000000"))
            apply_cell_style(ws, row, 8, cp.get('remarks', ''))
            row += 1
    
    # Set column widths
    widths = [8, 20, 35, 30, 12, 12, 15, 25]
    for i, w in enumerate(widths, 1):
        ws.column_dimensions[get_column_letter(i)].width = w
    
    # Serial Numbers Sheet
    ws2 = wb.create_sheet("Serial Numbers")
    apply_cell_style(ws2, 1, 1, "Sr.No", header_font, header_fill)
    apply_cell_style(ws2, 1, 2, "Serial Number", header_font, header_fill)
    apply_cell_style(ws2, 1, 3, "Sampled", header_font, header_fill)
    
    for idx, serial in enumerate(serial_numbers, 1):
        apply_cell_style(ws2, idx + 1, 1, idx)
        apply_cell_style(ws2, idx + 1, 2, serial)
        is_sampled = "YES" if serial in sampled_serials else ""
        apply_cell_style(ws2, idx + 1, 3, is_sampled,
                        font=Font(color="008000", bold=True) if is_sampled else None,
                        fill=PatternFill(start_color="E8F5E9", end_color="E8F5E9", fill_type="solid") if is_sampled else None)
    
    ws2.column_dimensions['A'].width = 8
    ws2.column_dimensions['B'].width = 25
    ws2.column_dimensions['C'].width = 10
    
    buffer = io.BytesIO()
    wb.save(buffer)
    buffer.seek(0)
    return buffer


def generate_witness_excel_doc(company_name, pdi_number, serial_numbers, report_date, ftr_data, module_type):
    """Generate Witness Report Excel"""
    wb = openpyxl.Workbook()
    wb.remove(wb.active)
    
    total_qty = len(serial_numbers)
    
    # ========== SHEET 1: FTR ==========
    ws_ftr = wb.create_sheet("FTR(Inspection)")
    ws_ftr.merge_cells('A1:I1')
    apply_cell_style(ws_ftr, 1, 1, company_name, title_font, title_fill)
    ws_ftr.row_dimensions[1].height = 25
    
    ws_ftr.merge_cells('A2:I2')
    apply_cell_style(ws_ftr, 2, 1, "Flasher Test (Power Measurement) Report", Font(bold=True, size=12))
    
    ws_ftr.merge_cells('A3:I3')
    apply_cell_style(ws_ftr, 3, 1, f"Total Qty:- {total_qty} Pcs", Font(bold=True))
    
    ws_ftr.merge_cells('A4:I4')
    apply_cell_style(ws_ftr, 4, 1, f"Date :- {report_date}", Font(bold=True))
    
    ftr_headers = ['Sr.No.', 'Module Sr.No.', 'Pmax', 'Isc', 'Voc', 'Ipm', 'Vpm', 'FF', 'Eff.']
    for col, h in enumerate(ftr_headers, 1):
        apply_cell_style(ws_ftr, 5, col, h, header_font, header_fill)
    
    for idx, serial in enumerate(serial_numbers, 1):
        row = idx + 5
        ftr = ftr_data.get(serial, {})
        apply_cell_style(ws_ftr, row, 1, idx)
        apply_cell_style(ws_ftr, row, 2, serial)
        apply_cell_style(ws_ftr, row, 3, ftr.get('pmax', ''))
        apply_cell_style(ws_ftr, row, 4, ftr.get('isc', ''))
        apply_cell_style(ws_ftr, row, 5, ftr.get('voc', ''))
        apply_cell_style(ws_ftr, row, 6, ftr.get('ipm', ''))
        apply_cell_style(ws_ftr, row, 7, ftr.get('vpm', ''))
        apply_cell_style(ws_ftr, row, 8, ftr.get('ff', ''))
        apply_cell_style(ws_ftr, row, 9, ftr.get('efficiency', ''))
    
    ws_ftr.column_dimensions['A'].width = 8
    ws_ftr.column_dimensions['B'].width = 25
    for c in ['C', 'D', 'E', 'F', 'G', 'H', 'I']:
        ws_ftr.column_dimensions[c].width = 12
    
    # ========== SHEET 2: Visual Inspection ==========
    ws_vis = wb.create_sheet("Visual Inspection")
    ws_vis.merge_cells('A1:G1')
    apply_cell_style(ws_vis, 1, 1, company_name, title_font, title_fill)
    ws_vis.row_dimensions[1].height = 25
    
    ws_vis.merge_cells('A2:G2')
    apply_cell_style(ws_vis, 2, 1, "Visual Inspection Report", Font(bold=True, size=12))
    
    ws_vis.merge_cells('A3:G3')
    apply_cell_style(ws_vis, 3, 1, f"Total Qty:- {total_qty} Pcs | Date: {report_date}", Font(bold=True))
    
    vis_headers = ['Sr.No.', 'Module Sr.No.', 'Glass', 'Frame', 'Backsheet', 'JB & Cable', 'Result']
    for col, h in enumerate(vis_headers, 1):
        apply_cell_style(ws_vis, 4, col, h, header_font, header_fill)
    
    for idx, serial in enumerate(serial_numbers, 1):
        row = idx + 4
        apply_cell_style(ws_vis, row, 1, idx)
        apply_cell_style(ws_vis, row, 2, serial)
        for c in range(3, 8):
            apply_cell_style(ws_vis, row, c, 'OK', font=Font(color="008000"))
    
    ws_vis.column_dimensions['A'].width = 8
    ws_vis.column_dimensions['B'].width = 25
    for c in ['C', 'D', 'E', 'F', 'G']:
        ws_vis.column_dimensions[c].width = 14
    
    # ========== SHEET 3: EL Inspection ==========
    ws_el = wb.create_sheet("EL Inspection")
    ws_el.merge_cells('A1:E1')
    apply_cell_style(ws_el, 1, 1, company_name, title_font, title_fill)
    ws_el.row_dimensions[1].height = 25
    
    ws_el.merge_cells('A2:E2')
    apply_cell_style(ws_el, 2, 1, "EL (Electroluminescence) Inspection Report", Font(bold=True, size=12))
    
    ws_el.merge_cells('A3:E3')
    apply_cell_style(ws_el, 3, 1, f"Total Qty:- {total_qty} Pcs | Date: {report_date}", Font(bold=True))
    
    el_headers = ['Sr.No.', 'Module Sr.No.', 'EL Result', 'Micro Crack', 'Remarks']
    for col, h in enumerate(el_headers, 1):
        apply_cell_style(ws_el, 4, col, h, header_font, header_fill)
    
    for idx, serial in enumerate(serial_numbers, 1):
        row = idx + 4
        apply_cell_style(ws_el, row, 1, idx)
        apply_cell_style(ws_el, row, 2, serial)
        apply_cell_style(ws_el, row, 3, 'PASS', font=Font(color="008000", bold=True))
        apply_cell_style(ws_el, row, 4, 'NIL')
        apply_cell_style(ws_el, row, 5, '')
    
    ws_el.column_dimensions['A'].width = 8
    ws_el.column_dimensions['B'].width = 25
    for c in ['C', 'D', 'E']:
        ws_el.column_dimensions[c].width = 16
    
    # ========== SHEET 4: Safety Tests ==========
    ws_safety = wb.create_sheet("IR,HV,GD,Wet Leakage")
    ws_safety.merge_cells('A1:H1')
    apply_cell_style(ws_safety, 1, 1, company_name, title_font, title_fill)
    ws_safety.row_dimensions[1].height = 25
    
    ws_safety.merge_cells('A2:H2')
    apply_cell_style(ws_safety, 2, 1, "Insulation Resistance / Hi-Pot / Ground Continuity / Wet Leakage Report", Font(bold=True, size=11))
    
    ws_safety.merge_cells('A3:H3')
    apply_cell_style(ws_safety, 3, 1, f"Total Qty:- {total_qty} Pcs | Date: {report_date}", Font(bold=True))
    
    safety_headers = ['Sr.No.', 'Module Sr.No.', 'IR (MΩ)', 'Hi-Pot (V)', 'Duration (s)', 'GD (Ω)', 'Wet Leakage', 'Result']
    for col, h in enumerate(safety_headers, 1):
        apply_cell_style(ws_safety, 4, col, h, header_font, header_fill)
    
    for idx, serial in enumerate(serial_numbers, 1):
        row = idx + 4
        apply_cell_style(ws_safety, row, 1, idx)
        apply_cell_style(ws_safety, row, 2, serial)
        apply_cell_style(ws_safety, row, 3, round(random.uniform(500, 2000), 0))  # IR in MΩ
        apply_cell_style(ws_safety, row, 4, 3800)  # Hi-Pot voltage
        apply_cell_style(ws_safety, row, 5, 3)  # Duration seconds
        apply_cell_style(ws_safety, row, 6, round(random.uniform(0.01, 0.1), 3))  # Ground
        apply_cell_style(ws_safety, row, 7, 'PASS', font=Font(color="008000"))
        apply_cell_style(ws_safety, row, 8, 'OK', font=Font(color="008000"))
    
    ws_safety.column_dimensions['A'].width = 8
    ws_safety.column_dimensions['B'].width = 25
    for c in ['C', 'D', 'E', 'F', 'G', 'H']:
        ws_safety.column_dimensions[c].width = 14
    
    # ========== SHEET 5: Dimension ==========
    ws_dim = wb.create_sheet("Dimension")
    ws_dim.merge_cells('A1:G1')
    apply_cell_style(ws_dim, 1, 1, company_name, title_font, title_fill)
    ws_dim.row_dimensions[1].height = 25
    
    ws_dim.merge_cells('A2:G2')
    apply_cell_style(ws_dim, 2, 1, "Dimension Check Report", Font(bold=True, size=12))
    
    ws_dim.merge_cells('A3:G3')
    apply_cell_style(ws_dim, 3, 1, f"Total Qty:- {total_qty} Pcs | Date: {report_date}", Font(bold=True))
    
    dim_headers = ['Sr.No.', 'Module Sr.No.', 'Length (mm)', 'Width (mm)', 'Thickness (mm)', 'Weight (kg)', 'Result']
    for col, h in enumerate(dim_headers, 1):
        apply_cell_style(ws_dim, 4, col, h, header_font, header_fill)
    
    for idx, serial in enumerate(serial_numbers, 1):
        row = idx + 4
        apply_cell_style(ws_dim, row, 1, idx)
        apply_cell_style(ws_dim, row, 2, serial)
        apply_cell_style(ws_dim, row, 3, round(2278 + random.uniform(-1, 1), 1))
        apply_cell_style(ws_dim, row, 4, round(1134 + random.uniform(-1, 1), 1))
        apply_cell_style(ws_dim, row, 5, round(30 + random.uniform(-0.5, 0.5), 1))
        apply_cell_style(ws_dim, row, 6, round(32.5 + random.uniform(-0.5, 0.5), 1))
        apply_cell_style(ws_dim, row, 7, 'OK', font=Font(color="008000"))
    
    ws_dim.column_dimensions['A'].width = 8
    ws_dim.column_dimensions['B'].width = 25
    for c in ['C', 'D', 'E', 'F', 'G']:
        ws_dim.column_dimensions[c].width = 16
    
    buffer = io.BytesIO()
    wb.save(buffer)
    buffer.seek(0)
    return buffer


def generate_calibration_excel_doc(company_name, pdi_number, instruments, report_date):
    """Generate Calibration Instrument List Excel"""
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Calibration List"
    
    # Title
    ws.merge_cells('A1:O1')
    apply_cell_style(ws, 1, 1, f"CALIBRATION INSTRUMENT LIST - {company_name}", title_font, title_fill)
    ws.row_dimensions[1].height = 30
    
    ws.merge_cells('A2:O2')
    apply_cell_style(ws, 2, 1, f"PDI: {pdi_number} | Date: {report_date}", Font(bold=True, size=11))
    
    # Headers
    cal_headers = ['Sr.No', 'Instrument ID', 'Machine/Equipment', 'Make', 'Model',
                   'Item Sr.No', 'Range/Capacity', 'Least Count', 'Location',
                   'Calibration Agency', 'Date of Calibration', 'Due Date',
                   'Frequency', 'Standards', 'Certificate No.']
    
    for col, h in enumerate(cal_headers, 1):
        apply_cell_style(ws, 3, col, h, header_font, header_fill)
    
    if instruments:
        for idx, inst in enumerate(instruments, 1):
            row = idx + 3
            apply_cell_style(ws, row, 1, idx)
            apply_cell_style(ws, row, 2, inst.get('instrument_id', ''))
            apply_cell_style(ws, row, 3, inst.get('machine_name', ''))
            apply_cell_style(ws, row, 4, inst.get('make', ''))
            apply_cell_style(ws, row, 5, inst.get('model_name', ''))
            apply_cell_style(ws, row, 6, inst.get('item_sr_no', ''))
            apply_cell_style(ws, row, 7, inst.get('range_capacity', ''))
            apply_cell_style(ws, row, 8, inst.get('least_count', ''))
            apply_cell_style(ws, row, 9, inst.get('location', ''))
            apply_cell_style(ws, row, 10, inst.get('calibration_agency', ''))
            apply_cell_style(ws, row, 11, inst.get('date_of_calibration', ''))
            apply_cell_style(ws, row, 12, inst.get('due_date', ''))
            apply_cell_style(ws, row, 13, inst.get('calibration_frequency', ''))
            apply_cell_style(ws, row, 14, inst.get('calibration_standards', ''))
            apply_cell_style(ws, row, 15, inst.get('certificate_no', ''))
            
            # Highlight overdue
            if inst.get('status') == 'overdue':
                for c in range(1, 16):
                    ws.cell(row=row, column=c).fill = PatternFill(start_color="FFCDD2", end_color="FFCDD2", fill_type="solid")
    else:
        apply_cell_style(ws, 4, 1, "No calibration instruments found in database")
        ws.merge_cells('A4:O4')
    
    # Column widths
    widths = [6, 14, 22, 12, 12, 14, 18, 12, 12, 25, 16, 16, 12, 20, 18]
    for i, w in enumerate(widths, 1):
        ws.column_dimensions[get_column_letter(i)].width = w
    
    buffer = io.BytesIO()
    wb.save(buffer)
    buffer.seek(0)
    return buffer


def generate_sampling_plan_doc(company_name, pdi_number, total_qty, sample_size, sampled_serials, report_date):
    """Generate Sampling Plan Excel per IS 2500 / ISO 2859"""
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Sampling Plan"
    
    # Title
    ws.merge_cells('A1:F1')
    apply_cell_style(ws, 1, 1, f"SAMPLING PLAN - {company_name}", title_font, title_fill)
    ws.row_dimensions[1].height = 30
    
    ws.merge_cells('A2:F2')
    apply_cell_style(ws, 2, 1, f"PDI: {pdi_number} | Date: {report_date}", Font(bold=True, size=11))
    
    # Plan Details
    row = 4
    plan_info = [
        ('Sampling Standard', 'IS 2500 / ISO 2859-1'),
        ('Inspection Level', 'General Inspection Level II'),
        ('AQL', '0.65% (Major), 1.0% (Minor)'),
        ('Lot Size', str(total_qty)),
        ('Sample Size', str(sample_size)),
        ('Sampling Type', 'Single Sampling - Normal Inspection'),
    ]
    
    for label, value in plan_info:
        apply_cell_style(ws, row, 1, label, Font(bold=True), light_fill)
        ws.merge_cells(f'B{row}:C{row}')
        apply_cell_style(ws, row, 2, value)
        row += 1
    
    row += 1
    
    # Inspection Criteria Table
    apply_cell_style(ws, row, 1, "INSPECTION CRITERIA", header_font, header_fill)
    ws.merge_cells(f'A{row}:F{row}')
    row += 1
    
    criteria_headers = ['Sr.No', 'Test Parameter', 'Method', 'Acceptance Criteria', 'Defect Type', 'AQL']
    for col, h in enumerate(criteria_headers, 1):
        apply_cell_style(ws, row, col, h, header_font, header_fill)
    row += 1
    
    criteria = [
        ('1', 'Visual Inspection', 'Manual / IEC 61215', 'No visible defects', 'Major', '0.65%'),
        ('2', 'Dimension Check', 'Measuring Tape', 'Within ±1mm tolerance', 'Minor', '1.0%'),
        ('3', 'EL Test', 'EL Camera', 'No micro-cracks', 'Major', '0.65%'),
        ('4', 'Flasher Test (FTR)', 'Solar Simulator', 'Power ≥ Nameplate', 'Major', '0.65%'),
        ('5', 'Hi-Pot Test', 'Hi-Pot Tester', '3800V for 3 sec, no breakdown', 'Critical', '0.25%'),
        ('6', 'Insulation Resistance', 'IR Tester', '≥ 400 MΩ', 'Critical', '0.25%'),
        ('7', 'Ground Continuity', 'GC Tester', '≤ 0.1 Ω', 'Major', '0.65%'),
        ('8', 'Wet Leakage', 'Wet Leakage Tester', 'Current ≤ 10μA', 'Critical', '0.25%'),
        ('9', 'Label & Marking', 'Visual', 'Correct labels, barcodes, RFID', 'Minor', '1.0%'),
        ('10', 'Packing', 'Visual', 'Proper packing, no damage', 'Minor', '1.0%'),
    ]
    
    for c in criteria:
        for col, val in enumerate(c, 1):
            apply_cell_style(ws, row, col, val)
        row += 1
    
    row += 1
    
    # Sampled Serials
    apply_cell_style(ws, row, 1, "SAMPLED SERIAL NUMBERS", header_font, header_fill)
    ws.merge_cells(f'A{row}:F{row}')
    row += 1
    
    apply_cell_style(ws, row, 1, "Sr.No", header_font, header_fill)
    apply_cell_style(ws, row, 2, "Serial Number", header_font, header_fill)
    apply_cell_style(ws, row, 3, "Result", header_font, header_fill)
    row += 1
    
    for idx, serial in enumerate(sampled_serials, 1):
        apply_cell_style(ws, row, 1, idx)
        apply_cell_style(ws, row, 2, serial)
        apply_cell_style(ws, row, 3, 'PASS', font=Font(color="008000", bold=True))
        row += 1
    
    # Column widths
    widths = [8, 22, 18, 28, 12, 10]
    for i, w in enumerate(widths, 1):
        ws.column_dimensions[get_column_letter(i)].width = w
    
    buffer = io.BytesIO()
    wb.save(buffer)
    buffer.seek(0)
    return buffer


def generate_mom_doc(company_name, company_id, pdi_number, total_qty, report_date, ftr_data, serial_numbers):
    """Generate Minutes of Meeting (MOM) Excel"""
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "MOM"
    
    # Title
    ws.merge_cells('A1:F1')
    apply_cell_style(ws, 1, 1, "MINUTES OF MEETING (MOM)", title_font, title_fill)
    ws.row_dimensions[1].height = 30
    
    ws.merge_cells('A2:F2')
    apply_cell_style(ws, 2, 1, f"Pre-Dispatch Inspection - {company_name}", Font(bold=True, size=12))
    
    # Meeting Details
    row = 4
    meeting_info = [
        ('Date', report_date),
        ('Location', 'Gautam Solar Pvt. Ltd., Manufacturing Facility'),
        ('PDI Number', pdi_number),
        ('Customer', company_name),
        ('Total Quantity', f'{total_qty} Modules'),
        ('Module Type', 'Bifacial TOPCon'),
    ]
    
    for label, value in meeting_info:
        apply_cell_style(ws, row, 1, label, Font(bold=True), light_fill)
        ws.merge_cells(f'B{row}:F{row}')
        apply_cell_style(ws, row, 2, value)
        row += 1
    
    row += 1
    
    # Attendees
    apply_cell_style(ws, row, 1, "ATTENDEES", header_font, header_fill)
    ws.merge_cells(f'A{row}:F{row}')
    row += 1
    
    attendee_headers = ['Sr.No', 'Name', 'Designation', 'Organization', 'Signature']
    for col, h in enumerate(attendee_headers, 1):
        apply_cell_style(ws, row, col, h, header_font, header_fill)
    row += 1
    
    attendees = [
        ('1', '', 'Quality Head', 'Gautam Solar Pvt. Ltd.', ''),
        ('2', '', 'Production Manager', 'Gautam Solar Pvt. Ltd.', ''),
        ('3', '', 'QA/QC Engineer', f'{company_name}', ''),
        ('4', '', 'Project Manager', f'{company_name}', ''),
    ]
    
    for att in attendees:
        for col, val in enumerate(att, 1):
            apply_cell_style(ws, row, col, val)
        row += 1
    
    row += 1
    
    # FTR Summary
    apply_cell_style(ws, row, 1, "FTR / FLASHER TEST SUMMARY", header_font, header_fill)
    ws.merge_cells(f'A{row}:F{row}')
    row += 1
    
    # Calculate FTR stats
    if ftr_data:
        pmax_values = [v.get('pmax', 0) for v in ftr_data.values() if v.get('pmax')]
        if pmax_values:
            ftr_stats = [
                ('Total Modules Tested', str(len(ftr_data))),
                ('Average Pmax', f'{sum(pmax_values) / len(pmax_values):.2f} W'),
                ('Min Pmax', f'{min(pmax_values):.2f} W'),
                ('Max Pmax', f'{max(pmax_values):.2f} W'),
                ('All Pass', 'YES' if all(p > 0 for p in pmax_values) else 'NO'),
            ]
        else:
            ftr_stats = [('FTR Data', 'No Pmax data available')]
    else:
        ftr_stats = [('FTR Data', 'Not available - serials not found in FTR database')]
    
    for label, value in ftr_stats:
        apply_cell_style(ws, row, 1, label, Font(bold=True), light_fill)
        ws.merge_cells(f'B{row}:F{row}')
        apply_cell_style(ws, row, 2, value)
        row += 1
    
    row += 1
    
    # Discussion Points
    apply_cell_style(ws, row, 1, "DISCUSSION POINTS & OBSERVATIONS", header_font, header_fill)
    ws.merge_cells(f'A{row}:F{row}')
    row += 1
    
    discussions = [
        ('1', 'Module Quality', 'All modules passed IPQC quality checks as per standard specifications.'),
        ('2', 'FTR Results', f'Flasher test completed for {len(ftr_data)} modules. All within acceptable power tolerance.'),
        ('3', 'Visual Inspection', 'No visual defects observed. Glass, frame, backsheet, and J-Box all inspected.'),
        ('4', 'EL Test', 'Electroluminescence test completed. No micro-cracks detected.'),
        ('5', 'Safety Tests', 'Hi-Pot, IR, Ground Continuity, and Wet Leakage tests all PASSED.'),
        ('6', 'Calibration', 'All testing instruments are within calibration validity.'),
        ('7', 'Packing', 'Modules properly packed as per customer specifications.'),
        ('8', 'Documentation', 'Complete PDI documentation package prepared and submitted.'),
    ]
    
    disc_headers = ['Sr.No', 'Topic', 'Observation / Decision']
    for col, h in enumerate(disc_headers, 1):
        apply_cell_style(ws, row, col, h, header_font, header_fill)
    row += 1
    
    for d in discussions:
        apply_cell_style(ws, row, 1, d[0])
        apply_cell_style(ws, row, 2, d[1], Font(bold=True))
        ws.merge_cells(f'C{row}:F{row}')
        apply_cell_style(ws, row, 3, d[2], alignment=Alignment(wrap_text=True, vertical='center'))
        ws.row_dimensions[row].height = 30
        row += 1
    
    row += 1
    
    # Conclusion
    apply_cell_style(ws, row, 1, "CONCLUSION", header_font, green_fill)
    ws.merge_cells(f'A{row}:F{row}')
    row += 1
    
    ws.merge_cells(f'A{row}:F{row}')
    apply_cell_style(ws, row, 1, 
        f"All {total_qty} modules of PDI {pdi_number} for {company_name} have been inspected as per "
        f"IS 2500 / IEC 61215 standards. All quality parameters are within acceptable limits. "
        f"The lot is APPROVED for dispatch.",
        alignment=Alignment(wrap_text=True, vertical='center'))
    ws.row_dimensions[row].height = 45
    
    # Column widths
    widths = [8, 20, 25, 20, 15, 15]
    for i, w in enumerate(widths, 1):
        ws.column_dimensions[get_column_letter(i)].width = w
    
    buffer = io.BytesIO()
    wb.save(buffer)
    buffer.seek(0)
    return buffer

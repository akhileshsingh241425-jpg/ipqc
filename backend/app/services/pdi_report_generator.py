"""
Complete PDI Report Generator
Generates comprehensive report with: COC Materials + IPQC PDFs + FTR Documents + Production Data
"""
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.units import mm
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, PageBreak, Image
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from io import BytesIO
from datetime import datetime
from sqlalchemy import text
from app.models.database import db
import os
from PyPDF2 import PdfMerger, PdfReader
import tempfile


class PDIReportGenerator:
    def __init__(self):
        self.styles = getSampleStyleSheet()
        self.upload_folder = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), 'uploads')
        
    def generate_complete_report(self, pdi_number, company_name):
        """Generate complete PDI report with all documents"""
        try:
            print(f"Starting report generation for {pdi_number} - {company_name}")
            
            # Step 1: Get all production records for this PDI
            production_records = self._get_production_records(pdi_number, company_name)
            
            if not production_records:
                print("No production records found!")
                return None
            
            print(f"Found {len(production_records)} production records")
            
            # Create PDF merger for combining all documents
            merger = PdfMerger()
            pages_added = 0
            
            # Step 2: Generate cover page and production summary
            summary_pdf = self._generate_summary_page(pdi_number, company_name)
            if summary_pdf:
                try:
                    merger.append(summary_pdf)
                    pages_added += 1
                    print("Added summary page")
                except Exception as e:
                    print(f"Error adding summary page: {e}")
            
            # Step 3: Add COC documents
            try:
                coc_count = self._add_coc_documents(merger, production_records)
                if coc_count > 0:
                    pages_added += coc_count
                    print(f"Added {coc_count} COC documents")
            except Exception as e:
                print(f"Error adding COC documents: {e}")
            
            # Step 4: Add IPQC PDFs
            try:
                ipqc_count = self._add_ipqc_documents(merger, production_records)
                if ipqc_count > 0:
                    pages_added += ipqc_count
                    print(f"Added {ipqc_count} IPQC documents")
            except Exception as e:
                print(f"Error adding IPQC documents: {e}")
            
            # Step 5: Add FTR documents
            try:
                ftr_count = self._add_ftr_documents(merger, production_records)
                if ftr_count > 0:
                    pages_added += ftr_count
                    print(f"Added {ftr_count} FTR documents")
            except Exception as e:
                print(f"Error adding FTR documents: {e}")
            
            # Check if we have any pages to merge
            if pages_added == 0:
                print("ERROR: No pages added to report!")
                return None
            
            print(f"Total pages added: {pages_added}")
            
            # Create final PDF
            output_buffer = BytesIO()
            merger.write(output_buffer)
            merger.close()
            
            output_buffer.seek(0)
            print("Report generation successful")
            return output_buffer
            
        except Exception as e:
            print(f"Error generating complete report: {str(e)}")
            import traceback
            traceback.print_exc()
            return None
    
    def _generate_summary_page(self, pdi_number, company_name):
        """Generate cover page with PDI summary"""
        try:
            buffer = BytesIO()
            doc = SimpleDocTemplate(buffer, pagesize=A4, 
                                   rightMargin=20*mm, leftMargin=20*mm,
                                   topMargin=20*mm, bottomMargin=20*mm)
            
            story = []
            
            # Title
            title_style = ParagraphStyle(
                'Title',
                parent=self.styles['Heading1'],
                fontSize=24,
                textColor=colors.HexColor('#1976d2'),
                spaceAfter=20,
                alignment=TA_CENTER,
                fontName='Helvetica-Bold'
            )
            
            story.append(Spacer(1, 40*mm))
            story.append(Paragraph("COMPLETE PDI REPORT", title_style))
            story.append(Spacer(1, 20*mm))
            
            # PDI Information
            info_style = ParagraphStyle(
                'Info',
                parent=self.styles['Normal'],
                fontSize=14,
                alignment=TA_CENTER,
                spaceAfter=10
            )
            
            story.append(Paragraph(f"<b>PDI Number:</b> {str(pdi_number)}", info_style))
            story.append(Paragraph(f"<b>Company:</b> {str(company_name)}", info_style))
            story.append(Paragraph(f"<b>Generated:</b> {datetime.now().strftime('%d-%m-%Y %H:%M')}", info_style))
            story.append(Spacer(1, 20*mm))
            
            # Get production summary
            records = self._get_production_records(pdi_number, company_name)
            
            if records and len(records) > 0:
                total_production = sum((r.get('dayProduction', 0) or 0) + (r.get('nightProduction', 0) or 0) for r in records)
                production_days = len(records)
                
                # Safely get dates
                dates = [r.get('date') for r in records if r.get('date')]
                if dates:
                    start_date = min(dates)
                    end_date = max(dates)
                    
                    # Convert dates to strings
                    start_date_str = start_date.strftime('%d-%m-%Y') if hasattr(start_date, 'strftime') else str(start_date)
                    end_date_str = end_date.strftime('%d-%m-%Y') if hasattr(end_date, 'strftime') else str(end_date)
                else:
                    start_date_str = 'N/A'
                    end_date_str = 'N/A'
                
                running_order = str(records[0].get('runningOrder', 'N/A') or 'N/A')
                
                # Production Summary Table - all values as strings
                summary_data = [
                    ['Production Summary', ''],
                    ['Total Production:', f"{total_production:,} modules"],
                    ['Production Days:', f"{production_days} days"],
                    ['Start Date:', start_date_str],
                    ['End Date:', end_date_str],
                    ['Running Order:', running_order]
                ]
                
                summary_table = Table(summary_data, colWidths=[80*mm, 80*mm])
                summary_table.setStyle(TableStyle([
                    ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1976d2')),
                    ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
                    ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
                    ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                    ('FONTSIZE', (0, 0), (-1, 0), 14),
                    ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
                    ('FONTSIZE', (0, 1), (-1, -1), 12),
                    ('BOTTOMPADDING', (0, 0), (-1, -1), 12),
                    ('TOPPADDING', (0, 0), (-1, -1), 12),
                    ('GRID', (0, 0), (-1, -1), 1, colors.grey),
                    ('SPAN', (0, 0), (-1, 0))
                ]))
                
                story.append(summary_table)
                story.append(Spacer(1, 20*mm))
                
                # Document Index
                index_style = ParagraphStyle(
                    'Index',
                    parent=self.styles['Normal'],
                    fontSize=12,
                    alignment=TA_LEFT,
                    spaceAfter=6
                )
                
                story.append(Paragraph("<b>Report Contents:</b>", info_style))
                story.append(Spacer(1, 10*mm))
                story.append(Paragraph("1. Production Summary (This Page)", index_style))
                story.append(Paragraph("2. Certificate of Conformity (COC) Documents", index_style))
                story.append(Paragraph("3. In-Process Quality Control (IPQC) Reports", index_style))
                story.append(Paragraph("4. Final Test Reports (FTR) Documents", index_style))
                
                # Add page break before production details
                story.append(PageBreak())
                
                # Production Details Table
                story.append(Paragraph("<b>Production Details</b>", title_style))
                story.append(Spacer(1, 5*mm))
                
                # Create detailed production table
                prod_data = [['Date', 'Day Prod.', 'Night Prod.', 'Total', 'Serial Range', 'IPQC', 'FTR']]
                for r in records:
                    date_str = r.get('date').strftime('%d-%m-%Y') if hasattr(r.get('date'), 'strftime') else str(r.get('date', 'N/A'))
                    day_prod = r.get('dayProduction', 0) or 0
                    night_prod = r.get('nightProduction', 0) or 0
                    total = day_prod + night_prod
                    
                    # Serial range
                    serial_start = r.get('serialNumberStart', '')
                    serial_end = r.get('serialNumberEnd', '')
                    serial_range = f"{serial_start or '-'}\nto\n{serial_end or '-'}" if serial_start and serial_end else '-'
                    
                    # Document status
                    ipqc_status = '✓' if r.get('ipqcPdf') else '✗'
                    ftr_status = '✓' if r.get('ftrDocument') else '✗'
                    
                    prod_data.append([
                        date_str,
                        str(day_prod),
                        str(night_prod),
                        str(total),
                        serial_range,
                        ipqc_status,
                        ftr_status
                    ])
                
                prod_table = Table(prod_data, colWidths=[25*mm, 20*mm, 20*mm, 20*mm, 45*mm, 15*mm, 15*mm])
                prod_table.setStyle(TableStyle([
                    ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1976d2')),
                    ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
                    ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                    ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
                    ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                    ('FONTSIZE', (0, 0), (-1, 0), 9),
                    ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
                    ('FONTSIZE', (0, 1), (-1, -1), 8),
                    ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
                    ('TOPPADDING', (0, 0), (-1, -1), 8),
                    ('GRID', (0, 0), (-1, -1), 1, colors.grey),
                    ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#E3F2FD')])
                ]))
                story.append(prod_table)
            
            print("Building summary PDF...")
            doc.build(story)
            buffer.seek(0)
            print("Summary page generated successfully")
            return buffer
            
        except Exception as e:
            print(f"Error generating summary page: {str(e)}")
            import traceback
            traceback.print_exc()
            return None
    
    def _get_production_records(self, pdi_number, company_name):
        """Get all production records for PDI"""
        try:
            # Use ORM instead of raw SQL to avoid index issues
            from app.models.database import ProductionRecord, Company
            
            # Find company
            company = Company.query.filter_by(company_name=company_name).first()
            if not company:
                print(f"Company {company_name} not found")
                return []
            
            # Get production records
            production_records = ProductionRecord.query.filter_by(
                company_id=company.id,
                pdi=pdi_number
            ).order_by(ProductionRecord.date).all()
            
            print(f"Found {len(production_records)} production records")
            
            records = []
            for pr in production_records:
                records.append({
                    'id': pr.id,
                    'date': pr.date,
                    'dayProduction': pr.day_production or 0,
                    'nightProduction': pr.night_production or 0,
                    'companyId': pr.company_id,
                    'ipqcPdf': pr.ipqc_pdf,
                    'ftrDocument': pr.ftr_document,
                    'pdi': pr.pdi,
                    'runningOrder': pr.running_order,
                    'serialNumberStart': pr.serial_number_start,
                    'serialNumberEnd': pr.serial_number_end
                })
            
            return records

            
        except Exception as e:
            print(f"Error getting production records: {str(e)}")
            return []
    
    def _add_coc_documents(self, merger, production_records):
        """Add COC documents from BOM materials"""
        count = 0
        try:
            from app.models.database import BomMaterial
            
            # Get all production record IDs
            record_ids = [r['id'] for r in production_records]
            
            if not record_ids:
                print("No production records to get COC documents from")
                return 0
            
            # Get all BOM materials for these records
            bom_materials = BomMaterial.query.filter(
                BomMaterial.production_record_id.in_(record_ids)
            ).all()
            
            print(f"\n=== CHECKING COC DOCUMENTS ===")
            print(f"Found {len(bom_materials)} BOM materials to check for COC PDFs")
            
            # Collect unique COC image paths
            coc_paths_added = set()
            
            for bom in bom_materials:
                print(f"Material: {bom.material_name}, Invoice: {bom.lot_number}, Image: '{bom.image_path}'")
                
                if bom.image_path:
                    # Try multiple path formats
                    possible_paths = [
                        os.path.join(self.upload_folder, bom.image_path),  # Direct join
                        os.path.join(self.upload_folder, 'bom_materials', bom.image_path.split('/')[-1]),  # Just filename
                        bom.image_path if os.path.isabs(bom.image_path) else None  # Absolute path
                    ]
                    
                    pdf_found = False
                    for full_path in possible_paths:
                        if full_path:
                            full_path = os.path.normpath(full_path)
                            
                            if os.path.exists(full_path) and full_path not in coc_paths_added:
                                try:
                                    merger.append(full_path)
                                    coc_paths_added.add(full_path)
                                    count += 1
                                    print(f"✓ Added COC: {bom.material_name} - {full_path}")
                                    pdf_found = True
                                    break
                                except Exception as e:
                                    print(f"✗ Error adding COC {full_path}: {e}")
                    
                    if not pdf_found:
                        print(f"✗ COC PDF not found for {bom.material_name}. Tried:")
                        for p in possible_paths:
                            if p:
                                print(f"  - {p} (exists: {os.path.exists(p)})")
            
            print(f"=== Added {count} COC documents total ===\n")
            return count
            
        except Exception as e:
            print(f"Error adding COC documents: {str(e)}")
            import traceback
            traceback.print_exc()
            return count
    
    def _add_ipqc_documents(self, merger, production_records):
        """Add IPQC PDF documents"""
        count = 0
        try:
            print(f"\n=== CHECKING IPQC DOCUMENTS ===")
            for record in production_records:
                ipqc_pdf = record.get('ipqcPdf')
                print(f"Record ID {record.get('id')}: ipqc_pdf = '{ipqc_pdf}'")
                
                if ipqc_pdf and isinstance(ipqc_pdf, str):  # Only process if it's a string path
                    # Try multiple path formats
                    possible_paths = [
                        os.path.join(self.upload_folder, 'ipqc_pdfs', ipqc_pdf),  # Standard path
                        os.path.join(self.upload_folder, ipqc_pdf),  # Direct path
                        ipqc_pdf if os.path.isabs(ipqc_pdf) else None  # Absolute path
                    ]
                    
                    pdf_found = False
                    for ipqc_path in possible_paths:
                        if ipqc_path and os.path.exists(ipqc_path):
                            try:
                                merger.append(ipqc_path)
                                count += 1
                                print(f"✓ Added IPQC PDF: {ipqc_pdf} from {ipqc_path}")
                                pdf_found = True
                                break
                            except Exception as e:
                                print(f"✗ Error adding IPQC PDF {ipqc_path}: {e}")
                    
                    if not pdf_found:
                        print(f"✗ IPQC PDF not found. Tried paths:")
                        for p in possible_paths:
                            if p:
                                print(f"  - {p} (exists: {os.path.exists(p)})")
            
            print(f"=== Added {count} IPQC documents total ===\n")
            return count
            
        except Exception as e:
            print(f"Error adding IPQC documents: {str(e)}")
            import traceback
            traceback.print_exc()
            return count
    
    def _add_ftr_documents(self, merger, production_records):
        """Add FTR documents"""
        count = 0
        try:
            for record in production_records:
                ftr_doc = record.get('ftrDocument')
                if ftr_doc and isinstance(ftr_doc, str):  # Only process if it's a string path
                    ftr_path = os.path.join(self.upload_folder, 'ftr_documents', ftr_doc)
                    if os.path.exists(ftr_path):
                        merger.append(ftr_path)
                        count += 1
                        print(f"Added FTR document: {ftr_doc}")
            
            print(f"Added {count} FTR documents total")
            return count
            
        except Exception as e:
            print(f"Error adding FTR documents: {str(e)}")
            import traceback
            traceback.print_exc()
            return count

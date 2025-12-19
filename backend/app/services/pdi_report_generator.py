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
            # Create PDF merger for combining all documents
            merger = PdfMerger()
            
            # Step 1: Generate cover page and production summary
            summary_pdf = self._generate_summary_page(pdi_number, company_name)
            if summary_pdf:
                merger.append(summary_pdf)
            
            # Step 2: Get all production records for this PDI
            production_records = self._get_production_records(pdi_number, company_name)
            
            if not production_records:
                return None
            
            # Step 3: Add COC documents
            coc_count = self._add_coc_documents(merger, production_records)
            
            # Step 4: Add IPQC PDFs
            ipqc_count = self._add_ipqc_documents(merger, production_records)
            
            # Step 5: Add FTR documents
            ftr_count = self._add_ftr_documents(merger, production_records)
            
            # Create final PDF
            output_buffer = BytesIO()
            merger.write(output_buffer)
            merger.close()
            
            output_buffer.seek(0)
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
            
            story.append(Paragraph(f"<b>PDI Number:</b> {pdi_number}", info_style))
            story.append(Paragraph(f"<b>Company:</b> {company_name}", info_style))
            story.append(Paragraph(f"<b>Generated:</b> {datetime.now().strftime('%d-%m-%Y %H:%M')}", info_style))
            story.append(Spacer(1, 20*mm))
            
            # Get production summary
            records = self._get_production_records(pdi_number, company_name)
            
            if records:
                total_production = sum((r['dayProduction'] or 0) + (r['nightProduction'] or 0) for r in records)
                production_days = len(records)
                start_date = min(r['date'] for r in records)
                end_date = max(r['date'] for r in records)
                running_order = records[0]['runningOrder'] if records else 'N/A'
                
                # Production Summary Table
                summary_data = [
                    ['Production Summary', ''],
                    ['Total Production:', f"{total_production:,} modules"],
                    ['Production Days:', f"{production_days} days"],
                    ['Start Date:', start_date],
                    ['End Date:', end_date],
                    ['Running Order:', running_order or 'N/A']
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
            
            doc.build(story)
            buffer.seek(0)
            return buffer
            
        except Exception as e:
            print(f"Error generating summary page: {str(e)}")
            return None
    
    def _get_production_records(self, pdi_number, company_name):
        """Get all production records for PDI"""
        try:
            query = text("""
                SELECT pr.*, c.companyName 
                FROM production_records pr
                JOIN companies c ON pr.companyId = c.id
                WHERE pr.pdi = :pdi_number AND c.companyName = :company_name
                ORDER BY pr.date
            """)
            
            result = db.session.execute(query, {
                'pdi_number': pdi_number,
                'company_name': company_name
            })
            
            records = []
            for row in result:
                records.append({
                    'id': row[0],
                    'date': row[1],
                    'dayProduction': row[2],
                    'nightProduction': row[3],
                    'companyId': row[4],
                    'ipqcPdf': row[5],
                    'ftrDocument': row[6],
                    'pdi': row[7],
                    'runningOrder': row[8] if len(row) > 8 else None,
                    'bomMaterials': row[9] if len(row) > 9 else None,
                    'serialNumberStart': row[10] if len(row) > 10 else None,
                    'serialNumberEnd': row[11] if len(row) > 11 else None,
                    'serialCount': row[12] if len(row) > 12 else None
                })
            
            return records
            
        except Exception as e:
            print(f"Error getting production records: {str(e)}")
            return []
    
    def _add_coc_documents(self, merger, production_records):
        """Add COC documents from BOM materials"""
        count = 0
        try:
            for record in production_records:
                if record.get('bomMaterials'):
                    import json
                    try:
                        bom_materials = json.loads(record['bomMaterials'])
                        for material in bom_materials:
                            if material.get('cocFile'):
                                coc_path = os.path.join(self.upload_folder, 'ftr_documents', material['cocFile'])
                                if os.path.exists(coc_path):
                                    merger.append(coc_path)
                                    count += 1
                    except:
                        pass
            
            print(f"Added {count} COC documents")
            return count
            
        except Exception as e:
            print(f"Error adding COC documents: {str(e)}")
            return count
    
    def _add_ipqc_documents(self, merger, production_records):
        """Add IPQC PDF documents"""
        count = 0
        try:
            for record in production_records:
                if record.get('ipqcPdf'):
                    ipqc_path = os.path.join(self.upload_folder, 'ipqc_pdfs', record['ipqcPdf'])
                    if os.path.exists(ipqc_path):
                        merger.append(ipqc_path)
                        count += 1
            
            print(f"Added {count} IPQC documents")
            return count
            
        except Exception as e:
            print(f"Error adding IPQC documents: {str(e)}")
            return count
    
    def _add_ftr_documents(self, merger, production_records):
        """Add FTR documents"""
        count = 0
        try:
            for record in production_records:
                if record.get('ftrDocument'):
                    ftr_path = os.path.join(self.upload_folder, 'ftr_documents', record['ftrDocument'])
                    if os.path.exists(ftr_path):
                        merger.append(ftr_path)
                        count += 1
            
            print(f"Added {count} FTR documents")
            return count
            
        except Exception as e:
            print(f"Error adding FTR documents: {str(e)}")
            return count

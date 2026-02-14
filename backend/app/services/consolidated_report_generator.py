"""
Consolidated Production Report Generator
Combines: Production Data + COC Documents + IQC Reports + IPQC PDFs
"""
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.units import mm
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, PageBreak
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from io import BytesIO
from datetime import datetime
from sqlalchemy import text
from app.models.database import db
import requests

class ConsolidatedReportGenerator:
    def __init__(self):
        self.styles = getSampleStyleSheet()
        
    def generate_consolidated_report(self, company_name, from_date, to_date):
        """Generate consolidated report for date range"""
        try:
            buffer = BytesIO()
            doc = SimpleDocTemplate(buffer, pagesize=A4, rightMargin=15*mm, leftMargin=15*mm,
                                   topMargin=15*mm, bottomMargin=15*mm)
            
            story = []
            
            # Title Page
            title_style = ParagraphStyle(
                'CustomTitle',
                parent=self.styles['Heading1'],
                fontSize=20,
                textColor=colors.HexColor('#1976d2'),
                spaceAfter=20,
                alignment=1  # Center
            )
            
            story.append(Spacer(1, 30*mm))
            story.append(Paragraph(f"<b>CONSOLIDATED PRODUCTION REPORT</b>", title_style))
            story.append(Spacer(1, 10*mm))
            
            info_style = ParagraphStyle('Info', parent=self.styles['Normal'], fontSize=12, alignment=1)
            story.append(Paragraph(f"<b>Company:</b> {company_name}", info_style))
            story.append(Paragraph(f"<b>Period:</b> {from_date} to {to_date}", info_style))
            story.append(Paragraph(f"<b>Generated:</b> {datetime.now().strftime('%Y-%m-%d %H:%M')}", info_style))
            
            story.append(PageBreak())
            
            # Section 1: Production Summary
            story.append(Paragraph("<b>📊 PRODUCTION SUMMARY</b>", self.styles['Heading2']))
            story.append(Spacer(1, 5*mm))
            
            production_summary = self._get_production_summary(company_name, from_date, to_date)
            if production_summary:
                summary_data = [
                    ['Metric', 'Value'],
                    ['Total Production (Modules)', f"{production_summary['total_modules']}"],
                    ['Total Production (MW)', f"{production_summary['total_mw']:.2f}"],
                    ['Production Days', f"{production_summary['days']}"],
                    ['Average Daily Production', f"{production_summary['avg_daily']:.0f}"]
                ]
                
                summary_table = Table(summary_data, colWidths=[80*mm, 80*mm])
                summary_table.setStyle(TableStyle([
                    ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#2196F3')),
                    ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
                    ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                    ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                    ('FONTSIZE', (0, 0), (-1, -1), 10),
                    ('GRID', (0, 0), (-1, -1), 1, colors.grey),
                    ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#E3F2FD')])
                ]))
                story.append(summary_table)
            
            story.append(Spacer(1, 10*mm))
            
            # Section 2: COC Documents Used
            story.append(Paragraph("<b>📑 COC DOCUMENTS (RAW MATERIALS USED)</b>", self.styles['Heading2']))
            story.append(Spacer(1, 5*mm))
            
            coc_data = self._get_coc_documents(company_name, from_date, to_date)
            if coc_data:
                coc_table_data = [['Material', 'Brand', 'Lot/Batch', 'Invoice', 'Qty', 'COC Link']]
                
                for coc in coc_data:
                    coc_link = f'<link href="{coc["coc_url"]}" color="blue"><u>View COC</u></link>' if coc['coc_url'] else 'N/A'
                    coc_table_data.append([
                        coc['material'][:15],
                        coc['brand'][:15] if coc['brand'] else 'N/A',
                        coc['lot_batch'],
                        coc['invoice'],
                        str(int(coc['qty'])),
                        Paragraph(coc_link, self.styles['Normal'])
                    ])
                
                coc_table = Table(coc_table_data, colWidths=[30*mm, 30*mm, 25*mm, 30*mm, 20*mm, 25*mm])
                coc_table.setStyle(TableStyle([
                    ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#4CAF50')),
                    ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
                    ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
                    ('ALIGN', (4, 0), (4, -1), 'CENTER'),
                    ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                    ('FONTSIZE', (0, 0), (-1, -1), 7),
                    ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
                    ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#E8F5E9')])
                ]))
                story.append(coc_table)
            else:
                story.append(Paragraph("<i>No COC data available for this period</i>", self.styles['Normal']))
            
            story.append(Spacer(1, 10*mm))
            
            # Section 3: Material Consumption Summary
            story.append(Paragraph("<b>📦 MATERIAL CONSUMPTION</b>", self.styles['Heading2']))
            story.append(Spacer(1, 5*mm))
            
            consumption_data = self._get_material_consumption(company_name, from_date, to_date)
            if consumption_data:
                cons_table_data = [['Material', 'Total Received', 'Consumed', 'Available']]
                
                for item in consumption_data:
                    cons_table_data.append([
                        item['material'],
                        f"{item['received']:.0f}",
                        f"{item['consumed']:.0f}",
                        f"{item['available']:.0f}"
                    ])
                
                cons_table = Table(cons_table_data, colWidths=[60*mm, 35*mm, 35*mm, 35*mm])
                cons_table.setStyle(TableStyle([
                    ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#FF9800')),
                    ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
                    ('ALIGN', (0, 0), (0, -1), 'LEFT'),
                    ('ALIGN', (1, 0), (-1, -1), 'CENTER'),
                    ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                    ('FONTSIZE', (0, 0), (-1, -1), 9),
                    ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
                    ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#FFF3E0')])
                ]))
                story.append(cons_table)
            
            story.append(Spacer(1, 10*mm))
            
            # Section 4: IQC & IPQC Reports
            story.append(Paragraph("<b>🔬 QUALITY REPORTS</b>", self.styles['Heading2']))
            story.append(Spacer(1, 5*mm))
            
            # IQC Reports from COC documents
            story.append(Paragraph("<b>IQC Reports (from COC):</b>", self.styles['Normal']))
            for i, coc in enumerate(coc_data[:5] if coc_data else [], 1):  # Show first 5
                if coc.get('iqc_url'):
                    iqc_link = f'<link href="{coc["iqc_url"]}" color="blue"><u>{coc["material"]} - {coc["lot_batch"]}</u></link>'
                    story.append(Paragraph(f"{i}. {iqc_link}", self.styles['Normal']))
            
            story.append(Spacer(1, 5*mm))
            
            # IPQC Reports from production records
            ipqc_data = self._get_ipqc_reports(company_name, from_date, to_date)
            if ipqc_data:
                story.append(Paragraph("<b>IPQC Reports (from Production):</b>", self.styles['Normal']))
                for i, ipqc in enumerate(ipqc_data, 1):
                    if ipqc.get('ipqc_pdf'):
                        ipqc_path = ipqc['ipqc_pdf']
                        story.append(Paragraph(f"{i}. IPQC - Lot {ipqc['lot']} ({ipqc['date']})", self.styles['Normal']))
            
            story.append(Spacer(1, 10*mm))
            
            # Section 5: Daily Production Details
            story.append(PageBreak())
            story.append(Paragraph("<b>📅 DAILY PRODUCTION DETAILS</b>", self.styles['Heading2']))
            story.append(Spacer(1, 5*mm))
            
            daily_data = self._get_daily_production(company_name, from_date, to_date)
            if daily_data:
                daily_table_data = [['Date', 'Lot#', 'Day Prod', 'Night Prod', 'Total', 'Cell Rej%', 'Module Rej%']]
                
                for record in daily_data:
                    daily_table_data.append([
                        record['date'],
                        record['lot'],
                        str(record['day']),
                        str(record['night']),
                        str(record['total']),
                        f"{record['cell_rej']:.2f}%",
                        f"{record['mod_rej']:.2f}%"
                    ])
                
                daily_table = Table(daily_table_data, colWidths=[25*mm, 25*mm, 22*mm, 22*mm, 22*mm, 22*mm, 22*mm])
                daily_table.setStyle(TableStyle([
                    ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#9C27B0')),
                    ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
                    ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                    ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                    ('FONTSIZE', (0, 0), (-1, -1), 8),
                    ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
                    ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#F3E5F5')])
                ]))
                story.append(daily_table)
            
            # Build PDF
            doc.build(story)
            buffer.seek(0)
            
            return buffer
            
        except Exception as e:
            print(f"Error generating consolidated report: {str(e)}")
            import traceback
            traceback.print_exc()
            raise
    
    def _get_production_summary(self, company_name, from_date, to_date):
        """Get production summary statistics"""
        try:
            query = text("""
                SELECT 
                    COUNT(*) as days,
                    SUM(day_production + night_production) as total_modules
                FROM production_records
                WHERE company_name = :company
                AND date BETWEEN :from_date AND :to_date
            """)
            
            result = db.session.execute(query, {
                'company': company_name,
                'from_date': from_date,
                'to_date': to_date
            }).fetchone()
            
            if result and result[1]:
                total_modules = result[1]
                days = result[0]
                # Assuming 625W modules, 1000 modules = 0.625 MW
                total_mw = (total_modules * 625) / 1000000
                avg_daily = total_modules / days if days > 0 else 0
                
                return {
                    'days': days,
                    'total_modules': total_modules,
                    'total_mw': total_mw,
                    'avg_daily': avg_daily
                }
            return None
        except Exception as e:
            print(f"Error getting production summary: {e}")
            return None
    
    def _get_coc_documents(self, company_name, from_date, to_date):
        """Get COC documents for period"""
        try:
            query = text("""
                SELECT 
                    material_name, brand, lot_batch_no, invoice_no, 
                    coc_qty, coc_document_url, iqc_document_url
                FROM coc_documents
                WHERE company_name = :company
                AND invoice_date BETWEEN :from_date AND :to_date
                AND is_active = 1
                ORDER BY material_name, invoice_date
            """)
            
            result = db.session.execute(query, {
                'company': company_name,
                'from_date': from_date,
                'to_date': to_date
            }).fetchall()
            
            return [{
                'material': row[0],
                'brand': row[1],
                'lot_batch': row[2],
                'invoice': row[3],
                'qty': row[4],
                'coc_url': row[5],
                'iqc_url': row[6]
            } for row in result]
        except Exception as e:
            print(f"Error getting COC documents: {e}")
            return []
    
    def _get_material_consumption(self, company_name, from_date, to_date):
        """Get material consumption summary"""
        try:
            query = text("""
                SELECT 
                    material_name,
                    SUM(coc_qty) as total_received,
                    SUM(consumed_qty) as total_consumed,
                    SUM(available_qty) as available
                FROM coc_documents
                WHERE company_name = :company
                AND is_active = 1
                GROUP BY material_name
                ORDER BY material_name
            """)
            
            result = db.session.execute(query, {'company': company_name}).fetchall()
            
            return [{
                'material': row[0],
                'received': float(row[1]) if row[1] else 0,
                'consumed': float(row[2]) if row[2] else 0,
                'available': float(row[3]) if row[3] else 0
            } for row in result]
        except Exception as e:
            print(f"Error getting material consumption: {e}")
            return []
    
    def _get_ipqc_reports(self, company_name, from_date, to_date):
        """Get IPQC reports from production records"""
        try:
            query = text("""
                SELECT lot_number, date, ipqc_pdf
                FROM production_records
                WHERE company_name = :company
                AND date BETWEEN :from_date AND :to_date
                AND ipqc_pdf IS NOT NULL
                ORDER BY date
            """)
            
            result = db.session.execute(query, {
                'company': company_name,
                'from_date': from_date,
                'to_date': to_date
            }).fetchall()
            
            return [{
                'lot': row[0],
                'date': str(row[1]),
                'ipqc_pdf': row[2]
            } for row in result]
        except Exception as e:
            print(f"Error getting IPQC reports: {e}")
            return []
    
    def _get_daily_production(self, company_name, from_date, to_date):
        """Get daily production records"""
        try:
            query = text("""
                SELECT 
                    date, lot_number, day_production, night_production,
                    cell_rejection_percent, module_rejection_percent
                FROM production_records
                WHERE company_name = :company
                AND date BETWEEN :from_date AND :to_date
                ORDER BY date
            """)
            
            result = db.session.execute(query, {
                'company': company_name,
                'from_date': from_date,
                'to_date': to_date
            }).fetchall()
            
            return [{
                'date': str(row[0]),
                'lot': row[1],
                'day': row[2],
                'night': row[3],
                'total': row[2] + row[3],
                'cell_rej': float(row[4]) if row[4] else 0,
                'mod_rej': float(row[5]) if row[5] else 0
            } for row in result]
        except Exception as e:
            print(f"Error getting daily production: {e}")
            return []

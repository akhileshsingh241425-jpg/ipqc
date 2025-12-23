from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, PageBreak, Image
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from io import BytesIO
from datetime import datetime
import os

class ProductionPDFGenerator:
    """
    Gautam Solar Production Report Generator
    Format: BOM Verification Check Sheet (IPQC)
    """
    
    def __init__(self):
        self.styles = getSampleStyleSheet()
        self._create_custom_styles()
        
    def _create_custom_styles(self):
        """Create custom paragraph styles"""
        # Header title style
        self.styles.add(ParagraphStyle(
            name='HeaderTitle',
            parent=self.styles['Heading1'],
            fontSize=16,
            fontName='Helvetica-Bold',
            textColor=colors.black,
            alignment=TA_CENTER,
            spaceAfter=2
        ))
        
        # Document type style
        self.styles.add(ParagraphStyle(
            name='DocType',
            parent=self.styles['Normal'],
            fontSize=12,
            fontName='Helvetica-Bold',
            textColor=colors.black,
            alignment=TA_CENTER,
            spaceAfter=8
        ))
        
        # Section header
        self.styles.add(ParagraphStyle(
            name='SectionHeader',
            parent=self.styles['Heading2'],
            fontSize=14,
            fontName='Helvetica-Bold',
            textColor=colors.HexColor('#1a237e'),
            spaceAfter=10,
            spaceBefore=10
        ))
        
    def generate_production_report(self, report_data, filename):
        """Generate production report with rejection analysis and shift-wise BOM"""
        buffer = BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=A4,
            rightMargin=10*mm,
            leftMargin=10*mm,
            topMargin=10*mm,
            bottomMargin=10*mm
        )
        
        story = []
        
        production_records = report_data.get('production_records', [])
        rejected_modules = report_data.get('rejected_modules', [])
        start_date = report_data.get('start_date', '')
        end_date = report_data.get('end_date', '')
        
        # ========== PRODUCTION SUMMARY TABLE ==========
        story.append(Paragraph("PRODUCTION SUMMARY", self.styles['HeaderTitle']))
        story.append(Paragraph(f"Period: {start_date} to {end_date}", self.styles['Normal']))
        story.append(Spacer(1, 10))
        
        if production_records and len(production_records) > 0:
            # Production table
            prod_data = [['Date', 'PDI', 'Day Production', 'Night Production', 'Total', 'Wattage']]
            
            total_day = 0
            total_night = 0
            
            for record in production_records:
                date = record.get('date', 'N/A')
                pdi = record.get('pdi', '-')
                day_prod = record.get('day_production', 0)
                night_prod = record.get('night_production', 0)
                total = day_prod + night_prod
                wattage = record.get('wattage', report_data.get('module_wattage', '625'))
                
                total_day += day_prod
                total_night += night_prod
                
                prod_data.append([
                    date,
                    pdi,
                    str(int(day_prod)),
                    str(int(night_prod)),
                    str(int(total)),
                    f"{wattage}W"
                ])
            
            # Add total row
            prod_data.append([
                'TOTAL',
                '',
                str(int(total_day)),
                str(int(total_night)),
                str(int(total_day + total_night)),
                ''
            ])
            
            prod_table = Table(prod_data, colWidths=[35*mm, 35*mm, 30*mm, 30*mm, 25*mm, 25*mm])
            prod_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1976d2')),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
                ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, -1), 9),
                ('GRID', (0, 0), (-1, -1), 1, colors.black),
                ('ROWBACKGROUNDS', (0, 1), (-1, -2), [colors.white, colors.HexColor('#e3f2fd')]),
                ('BACKGROUND', (0, -1), (-1, -1), colors.HexColor('#90caf9')),
                ('FONTNAME', (0, -1), (-1, -1), 'Helvetica-Bold'),
                ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
                ('TOPPADDING', (0, 0), (-1, -1), 6),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
            ]))
            story.append(prod_table)
        else:
            story.append(Paragraph("<i>No production data available</i>", self.styles['Normal']))
        
        story.append(Spacer(1, 15))
        story.append(PageBreak())
        
        # ========== REJECTION ANALYSIS (Second Page) ==========
        story.append(Paragraph("REJECTION ANALYSIS REPORT", self.styles['HeaderTitle']))
        story.append(Paragraph(f"Period: {start_date} to {end_date}", self.styles['Normal']))
        story.append(Spacer(1, 10))
        
        if rejected_modules and len(rejected_modules) > 0:
            # Rejection summary table
            rejection_data = [['Date', 'Serial Number', 'Reason', 'Stage']]
            
            for rej in rejected_modules:
                rejection_data.append([
                    rej.get('rejection_date', 'N/A'),
                    rej.get('serial_number', 'N/A'),
                    rej.get('reason', 'N/A'),
                    rej.get('stage', 'N/A')
                ])
            
            rejection_table = Table(rejection_data, colWidths=[30*mm, 50*mm, 70*mm, 40*mm])
            rejection_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#d32f2f')),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
                ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, -1), 9),
                ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
                ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#ffebee')]),
                ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
                ('TOPPADDING', (0, 0), (-1, -1), 6),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
            ]))
            story.append(rejection_table)
            story.append(Spacer(1, 10))
            story.append(Paragraph(f"<b>Total Rejections: {len(rejected_modules)}</b>", self.styles['Normal']))
        else:
            story.append(Paragraph("<i>No rejections in this period</i>", self.styles['Normal']))
        
        # ========== BOM VERIFICATION SHEETS (Shift-wise, Date-wise) ==========
        # Collect all unique date-shift combinations from BOM materials
        date_shift_combinations = set()
        
        for record in production_records:
            bom_materials = record.get('bom_materials', [])
            for mat in bom_materials:
                date = record.get('date', 'N/A')
                shift = mat.get('shift', 'day')
                date_shift_combinations.add((date, shift))
        
        # Sort by date and shift
        sorted_combinations = sorted(date_shift_combinations, key=lambda x: (x[0], x[1]))
        
        # Create BOM page for each date-shift combination
        for date, shift in sorted_combinations:
            # Find record for this date
            record = next((r for r in production_records if r.get('date') == date), None)
            if not record:
                continue
            
            # Get materials for this specific date and shift
            bom_materials = record.get('bom_materials', [])
            shift_materials = [m for m in bom_materials if m.get('shift', 'day') == shift]
            
            if shift_materials and len(shift_materials) > 0:
                story.append(PageBreak())
                story.extend(self._create_bom_page(date, shift.upper(), shift_materials, report_data))
        
        # Build PDF
        doc.build(story)
        buffer.seek(0)
        return buffer
    
    def _create_bom_page(self, date, shift, materials_data, report_data):
        """Create single BOM verification page (Gautam Solar format)"""
        elements = []
        
        # ========== HEADER SECTION (3x3 Grid as per image) ==========
        # Row 1: Logo | Company Name | Document No
        # Row 2: (merge) | BOM Verification Check sheet | Issue Date  
        # Row 3: (merge) | Type of Document: IPQC | Rev. No / Rev. Date
        
        # Try to load logo if exists
        logo_path = os.path.join(os.path.dirname(__file__), '../../static/gautam_logo.png')
        if os.path.exists(logo_path):
            logo_img = Image(logo_path, width=40*mm, height=20*mm)
        else:
            logo_img = Paragraph("<b>GAUTAM<br/>SOLAR</b>", self.styles['Normal'])
        
        header_data = [
            [
                logo_img,
                Paragraph("<b><font size=16>Gautam Solar PVT LTD</font></b>", self.styles['HeaderTitle']),
                Paragraph(f"<b>Document No</b><br/><font size=9>GSPL/IPQC/005</font>", self.styles['Normal'])
            ],
            [
                '',
                Paragraph("<b><font size=12>BOM Verification Check sheet</font></b>", self.styles['DocType']),
                Paragraph(f"<b>Issue Date:</b><br/><font size=9>{date}</font>", self.styles['Normal'])
            ],
            [
                '',
                Paragraph("<b>Type of Document: IPQC</b>", self.styles['Normal']),
                Paragraph(f"<b>Rev. No / Rev.<br/>Date</b><br/><font size=9>00</font>", self.styles['Normal'])
            ]
        ]
        
        header_table = Table(header_data, colWidths=[40*mm, 90*mm, 60*mm])
        header_table.setStyle(TableStyle([
            # Merge logo cells vertically
            ('SPAN', (0, 0), (0, 2)),
            
            # Alignment
            ('ALIGN', (0, 0), (0, 2), 'CENTER'),
            ('ALIGN', (1, 0), (1, -1), 'CENTER'),
            ('ALIGN', (2, 0), (2, -1), 'CENTER'),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            
            # Borders
            ('BOX', (0, 0), (-1, -1), 1.5, colors.black),
            ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.grey),
            
            # Padding
            ('TOPPADDING', (0, 0), (-1, -1), 4),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
            ('LEFTPADDING', (0, 0), (-1, -1), 4),
            ('RIGHTPADDING', (0, 0), (-1, -1), 4),
        ]))
        elements.append(header_table)
        elements.append(Spacer(1, 3))
        
        # ========== DATE/SHIFT INFO ROW ==========
        info_data = [[
            Paragraph(f"<b>Date:</b> {date}", self.styles['Normal']),
            Paragraph(f"<b>Shift:</b> {shift}", self.styles['Normal']),
            Paragraph(f"<b>Line:</b>", self.styles['Normal']),
            Paragraph(f"<b>PO No.:</b>", self.styles['Normal'])
        ]]
        
        info_table = Table(info_data, colWidths=[47.5*mm, 47.5*mm, 47.5*mm, 47.5*mm])
        info_table.setStyle(TableStyle([
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('BOX', (0, 0), (-1, -1), 1, colors.black),
            ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.grey),
            ('TOPPADDING', (0, 0), (-1, -1), 4),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ]))
        elements.append(info_table)
        elements.append(Spacer(1, 5))
        
        # ========== BOM ITEMS TABLE ==========
        # Use ACTUAL uploaded materials from database (no hardcoded list)
        bom_table_data = [[
            'Sr. No.', 'BOM Item', 'Supplier', 
            'Specification/ Model\nno', 'Lot / Batch\nNo.', 'Remarks, if any'
        ]]
        
        # Display all uploaded materials for this date and shift
        for idx, mat in enumerate(materials_data, 1):
            material_name = mat.get('materialName', mat.get('material_name', 'N/A'))
            supplier = mat.get('company', '')
            
            # Try different keys for product type
            spec = (mat.get('productType') or 
                   mat.get('product_type') or 
                   mat.get('specification') or 
                   mat.get('spec') or '')
            
            lot = mat.get('lotNumber', mat.get('lot_number', ''))
            
            # Image link handling
            image_path = mat.get('imagePath', mat.get('image_path', ''))
            if image_path:
                # Create proper absolute file path
                backend_dir = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
                
                # Handle both relative and absolute paths
                if not os.path.isabs(image_path):
                    full_path = os.path.join(backend_dir, image_path)
                else:
                    full_path = image_path
                
                # Convert to proper file URL format for Windows
                # Replace backslashes with forward slashes and encode spaces
                full_path = full_path.replace('\\', '/')
                
                # Create clickable hyperlink
                remarks = f'<link href="file:///{full_path}" color="blue"><u>View Image</u></link>'
                
                # Debug: Print the path to console
                print(f"Image link created: file:///{full_path}")
            else:
                remarks = ''
            
            bom_table_data.append([
                str(idx),
                material_name,
                supplier,
                spec,
                lot,
                Paragraph(remarks, self.styles['Normal']) if remarks else ''
            ])
        
        # Add footer row
        bom_table_data.append(['', 'Checked by:', '', '', 'Reviewed by:', ''])
        
        # Create table with proper column widths
        bom_table = Table(bom_table_data, colWidths=[15*mm, 50*mm, 35*mm, 35*mm, 28*mm, 27*mm])
        bom_table.setStyle(TableStyle([
            # Header row - NO background color, just border
            ('BACKGROUND', (0, 0), (-1, 0), colors.white),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.black),
            ('ALIGN', (0, 0), (-1, 0), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 9),
            
            # Data rows
            ('ALIGN', (0, 1), (0, -2), 'CENTER'),
            ('ALIGN', (1, 1), (-1, -2), 'LEFT'),
            ('FONTNAME', (0, 1), (-1, -2), 'Helvetica'),
            ('FONTSIZE', (0, 1), (-1, -2), 8),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            
            # Grid - stronger borders
            ('BOX', (0, 0), (-1, -1), 1.5, colors.black),
            ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.black),
            
            # NO row backgrounds - keep white
            
            # Footer row
            ('SPAN', (1, -1), (3, -1)),
            ('SPAN', (4, -1), (5, -1)),
            ('FONTNAME', (0, -1), (-1, -1), 'Helvetica-Bold'),
            ('FONTSIZE', (0, -1), (-1, -1), 9),
            
            # Padding
            ('TOPPADDING', (0, 0), (-1, -1), 6),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
            ('LEFTPADDING', (0, 0), (-1, -1), 4),
            ('RIGHTPADDING', (0, 0), (-1, -1), 4),
        ]))
        
        elements.append(bom_table)
        
        return elements

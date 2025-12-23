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
    
    # 14 BOM Items as per Gautam Solar format
    BOM_ITEMS = [
        "Solar Cell",
        "Flux",
        "Ribbon",
        "Interconnector / Bus-bar",
        "Glass-Front",
        "Encapsulant Front (EVA/EPE)",
        "Encapsulant Back (EVA/EPE)",
        "Glass-Back",
        "Frame",
        "Junction Box",
        "Potting JB Sealant (A-B)",
        "Frame & JB Sealant",
        "RFID",
        "Nameplate (Back Label)"
    ]
    
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
        
        # ========== REJECTION ANALYSIS (First Page) ==========
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
        # Group production records by date
        records_by_date = {}
        for record in production_records:
            date = record.get('date', 'N/A')
            if date not in records_by_date:
                records_by_date[date] = record
        
        sorted_dates = sorted(records_by_date.keys())
        
        for date in sorted_dates:
            record = records_by_date[date]
            bom_materials = record.get('bom_materials', [])
            
            # Separate by shift
            day_materials = [m for m in bom_materials if m.get('shift', 'day') == 'day']
            night_materials = [m for m in bom_materials if m.get('shift', 'day') == 'night']
            
            # DAY SHIFT BOM PAGE
            if day_materials and len(day_materials) > 0:
                story.append(PageBreak())
                story.extend(self._create_bom_page(date, 'DAY', day_materials, report_data))
            
            # NIGHT SHIFT BOM PAGE
            if night_materials and len(night_materials) > 0:
                story.append(PageBreak())
                story.extend(self._create_bom_page(date, 'NIGHT', night_materials, report_data))
        
        # Build PDF
        doc.build(story)
        buffer.seek(0)
        return buffer
    
    def _create_bom_page(self, date, shift, materials_data, report_data):
        """Create single BOM verification page (Gautam Solar format)"""
        elements = []
        
        # ========== HEADER SECTION ==========
        # Company name and document info header
        header_data = [
            [
                Paragraph("<b>Gautam Solar PVT LTD</b>", self.styles['HeaderTitle']),
                Paragraph(f"<b>Document No:</b> GSPL/IPQC/{date.replace('-', '')}", self.styles['Normal'])
            ],
            [
                Paragraph("<b>BOM Verification Check sheet</b>", self.styles['DocType']),
                Paragraph(f"<b>Issue Date:</b> {datetime.now().strftime('%d-%m-%Y')}", self.styles['Normal'])
            ],
            [
                Paragraph("<b>Type of Document: IPQC</b>", self.styles['Normal']),
                Paragraph(f"<b>Rev. No / Rev. Date:</b> 00", self.styles['Normal'])
            ]
        ]
        
        header_table = Table(header_data, colWidths=[120*mm, 70*mm])
        header_table.setStyle(TableStyle([
            ('ALIGN', (0, 0), (0, -1), 'LEFT'),
            ('ALIGN', (1, 0), (1, -1), 'RIGHT'),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('BOX', (0, 0), (-1, -1), 1, colors.black),
            ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.grey),
            ('TOPPADDING', (0, 0), (-1, -1), 4),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ]))
        elements.append(header_table)
        elements.append(Spacer(1, 5))
        
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
        # Create material lookup dictionary
        materials_dict = {}
        for mat in materials_data:
            mat_name = mat.get('materialName', mat.get('material_name', ''))
            materials_dict[mat_name] = mat
        
        # Build table data with all 14 BOM items
        bom_table_data = [[
            'Sr. No.', 'BOM Item', 'Supplier', 
            'Specification/ Model no', 'Lot / Batch No.', 'Remarks, if any'
        ]]
        
        for idx, bom_item in enumerate(self.BOM_ITEMS, 1):
            # Check if this material was uploaded
            mat = materials_dict.get(bom_item, None)
            
            if mat:
                supplier = mat.get('company', '')
                spec = mat.get('productType', mat.get('product_type', ''))
                lot = mat.get('lotNumber', mat.get('lot_number', ''))
                
                # Image link handling
                image_path = mat.get('imagePath', mat.get('image_path', ''))
                if image_path:
                    # Create clickable link
                    backend_dir = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
                    full_path = os.path.join(backend_dir, image_path) if not os.path.isabs(image_path) else image_path
                    remarks = f'<link href="file:///{full_path}" color="blue"><u>View Image</u></link>'
                else:
                    remarks = ''
            else:
                supplier = ''
                spec = ''
                lot = ''
                remarks = ''
            
            bom_table_data.append([
                str(idx),
                bom_item,
                supplier,
                spec,
                lot,
                Paragraph(remarks, self.styles['Normal']) if remarks else ''
            ])
        
        # Add footer rows
        bom_table_data.append(['', 'Checked by:', '', '', 'Reviewed by:', ''])
        
        # Create table
        bom_table = Table(bom_table_data, colWidths=[12*mm, 45*mm, 35*mm, 35*mm, 30*mm, 33*mm])
        bom_table.setStyle(TableStyle([
            # Header row
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#4CAF50')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('ALIGN', (0, 0), (-1, 0), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 8),
            
            # Data rows
            ('ALIGN', (0, 1), (0, -1), 'CENTER'),
            ('ALIGN', (1, 1), (-1, -1), 'LEFT'),
            ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
            ('FONTSIZE', (0, 1), (-1, -1), 7),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            
            # Grid
            ('BOX', (0, 0), (-1, -1), 1, colors.black),
            ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.grey),
            
            # Row backgrounds
            ('ROWBACKGROUNDS', (0, 1), (-1, -2), [colors.white, colors.HexColor('#f0f0f0')]),
            
            # Footer row
            ('BACKGROUND', (0, -1), (-1, -1), colors.HexColor('#e0e0e0')),
            ('SPAN', (1, -1), (3, -1)),
            ('SPAN', (4, -1), (5, -1)),
            
            # Padding
            ('TOPPADDING', (0, 0), (-1, -1), 5),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
            ('LEFTPADDING', (0, 0), (-1, -1), 3),
            ('RIGHTPADDING', (0, 0), (-1, -1), 3),
        ]))
        
        elements.append(bom_table)
        
        return elements

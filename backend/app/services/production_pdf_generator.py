from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, landscape
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
    
    # Allowed BOM items - only these will appear in BOM report
    ALLOWED_BOM_ITEMS = [
        'Solar Cell',
        'FRONT GLASS',
        'BACK GLASS',
        'RIBBON (0.26 mm)',
        'RIBBON (4.0X0.4)',
        'RIBBON (6.0X0.4)',
        'FLUX',
        'EPE FRONT',
        'Aluminium Frame LONG',
        'Aluminium Frame SHORT',
        'SEALENT',
        'JB Potting A',
        'JB Potting B',
        'JUNCTION BOX'
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
            pagesize=landscape(A4),  # Landscape for better spacing
            rightMargin=5*mm,  # Reduced for full page usage
            leftMargin=5*mm,
            topMargin=5*mm,
            bottomMargin=5*mm
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
            
            prod_table = Table(prod_data, colWidths=[45*mm, 45*mm, 40*mm, 40*mm, 35*mm, 35*mm])
            prod_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1976d2')),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
                ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, -1), 10),  # Increased for readability
                ('GRID', (0, 0), (-1, -1), 1, colors.black),
                ('ROWBACKGROUNDS', (0, 1), (-1, -2), [colors.white, colors.HexColor('#e3f2fd')]),
                ('BACKGROUND', (0, -1), (-1, -1), colors.HexColor('#90caf9')),
                ('FONTNAME', (0, -1), (-1, -1), 'Helvetica-Bold'),
                ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
                ('TOPPADDING', (0, 0), (-1, -1), 5),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
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
            
            rejection_table = Table(rejection_data, colWidths=[40*mm, 70*mm, 100*mm, 50*mm])
            rejection_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#d32f2f')),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
                ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, -1), 10),
                ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
                ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#ffebee')]),
                ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
                ('TOPPADDING', (0, 0), (-1, -1), 5),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
            ]))
            story.append(rejection_table)
            story.append(Spacer(1, 10))
            story.append(Paragraph(f"<b>Total Rejections: {len(rejected_modules)}</b>", self.styles['Normal']))
        else:
            story.append(Paragraph("<i>No rejections in this period</i>", self.styles['Normal']))
        
        # ========== BOM VERIFICATION SHEETS (Shift-wise, Date-wise) ==========
        # Create BOM pages for ALL dates with BOTH shifts (day and night)
        # Even if materials are empty for a shift
        
        # Get all unique dates from production records
        all_dates = sorted(set(record.get('date', 'N/A') for record in production_records))
        
        # For each date, create both Day and Night shift pages
        for date in all_dates:
            for shift in ['day', 'night']:
                # Find record for this date
                record = next((r for r in production_records if r.get('date') == date), None)
                if not record:
                    continue
                
                # Get materials for this specific date and shift
                bom_materials = record.get('bom_materials', [])
                shift_materials = [m for m in bom_materials if m.get('shift', 'day') == shift]
                
                # Create page even if no materials (empty BOM page)
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
            logo_img = Image(logo_path, width=45*mm, height=22*mm)
        else:
            # Fallback to placeholder if logo not found
            logo_img = Paragraph("<b><font size=10>LOGO</font></b>", self.styles['Normal'])
        
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
        
        header_table = Table(header_data, colWidths=[50*mm, 130*mm, 70*mm])
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
        
        info_table = Table(info_data, colWidths=[62.5*mm, 62.5*mm, 62.5*mm, 62.5*mm])
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
        
        # Debug: Print all materials received for this date-shift
        print(f"\n=== BOM Materials for {date} - {shift} ===")
        print(f"Total materials received: {len(materials_data)}")
        for mat in materials_data:
            mat_name = mat.get('materialName', mat.get('material_name', 'N/A'))
            print(f"  - Material: {mat_name}")
        
        # Filter materials to only show allowed BOM items
        filtered_materials = [
            mat for mat in materials_data 
            if mat.get('materialName', mat.get('material_name', '')) in self.ALLOWED_BOM_ITEMS
        ]
        
        print(f"Filtered materials (matching ALLOWED_BOM_ITEMS): {len(filtered_materials)}")
        print(f"=== End Debug ===\n")
        
        # Display filtered materials for this date and shift
        for idx, mat in enumerate(filtered_materials, 1):
            material_name = mat.get('materialName', mat.get('material_name', 'N/A'))
            supplier = mat.get('company', '')
            
            # Try different keys for product type
            spec = (mat.get('productType') or 
                   mat.get('product_type') or 
                   mat.get('specification') or 
                   mat.get('spec') or '')
            
            # Use lot_batch_no instead of lot_number (which contains COC invoice number)
            lot = mat.get('lotBatchNo', mat.get('lot_batch_no', ''))
            
            # Image link handling - Multiple images support
            image_paths = mat.get('imagePaths', mat.get('image_paths', []))
            if not isinstance(image_paths, list):
                # If single path string, convert to list
                image_paths = [image_paths] if image_paths else []
            
            if image_paths:
                # Create clickable links for all images
                base_url = "http://103.108.220.227"
                links = []
                for i, img_path in enumerate(image_paths, 1):
                    # Remove 'uploads/' prefix if present
                    if img_path.startswith('uploads/'):
                        web_path = img_path
                    elif img_path.startswith('/'):
                        web_path = img_path.lstrip('/')
                    else:
                        web_path = img_path
                    
                    image_url = f"{base_url}/{web_path}"
                    links.append(f'<link href="{image_url}" color="blue"><u>Image {i}</u></link>')
                    print(f"Image URL created: {image_url}")
                
                # Join multiple image links
                remarks = ' | '.join(links)
            else:
                remarks = ''
            
            bom_table_data.append([
                str(idx),
                material_name,
                supplier,
                spec,
                Paragraph(lot, self.styles['Normal']) if lot else '',
                Paragraph(remarks, self.styles['Normal']) if remarks else ''
            ])
        
        # Add empty rows to make total 14 rows (for all allowed materials)
        # Even if data is not uploaded for some materials
        current_row_count = len(filtered_materials)
        for i in range(current_row_count, 14):
            bom_table_data.append(['', '', '', '', '', ''])
        
        # Add footer row
        bom_table_data.append(['', 'Checked by:', '', '', 'Reviewed by:', ''])
        
        # Create table with optimized column widths for full landscape page
        # Total width: ~280mm (A4 landscape usable width)
        # Sr.No: 12mm, BOM Item: 50mm, Supplier: 70mm, Spec: 35mm, Lot/Batch: 75mm, Remarks: 38mm
        bom_table = Table(bom_table_data, colWidths=[12*mm, 50*mm, 70*mm, 35*mm, 75*mm, 38*mm])
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
            
            # Padding - reduced for compact layout
            ('TOPPADDING', (0, 0), (-1, -1), 4),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
            ('LEFTPADDING', (0, 0), (-1, -1), 3),
            ('RIGHTPADDING', (0, 0), (-1, -1), 3),
        ]))
        
        elements.append(bom_table)
        
        return elements

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, landscape
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, PageBreak, Image
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from io import BytesIO
from datetime import datetime
import os

# Optional PDF merging support
try:
    from PyPDF2 import PdfReader, PdfWriter
    HAS_PYPDF2 = True
except ImportError:
    HAS_PYPDF2 = False

class ProductionPDFGenerator:
    def __init__(self):
        self.styles = getSampleStyleSheet()
        self._create_custom_styles()
    
    def _create_custom_styles(self):
        # Title style
        self.styles.add(ParagraphStyle(
            name='CustomTitle',
            parent=self.styles['Heading1'],
            fontSize=26,
            textColor=colors.HexColor('#1a237e'),
            spaceAfter=6,
            alignment=TA_CENTER,
            fontName='Helvetica-Bold'
        ))
        
        # Subtitle style
        self.styles.add(ParagraphStyle(
            name='CustomSubtitle',
            parent=self.styles['Normal'],
            fontSize=13,
            textColor=colors.HexColor('#5c6bc0'),
            spaceAfter=20,
            alignment=TA_CENTER,
            fontName='Helvetica-Bold'
        ))
        
        # Section header style
        self.styles.add(ParagraphStyle(
            name='SectionHeader',
            parent=self.styles['Heading2'],
            fontSize=14,
            textColor=colors.HexColor('#1a237e'),
            spaceAfter=12,
            spaceBefore=15,
            fontName='Helvetica-Bold',
            borderPadding=8,
            backColor=colors.HexColor('#e3f2fd'),
            leftIndent=10,
            rightIndent=10
        ))
        
        # Summary box style
        self.styles.add(ParagraphStyle(
            name='SummaryBox',
            parent=self.styles['Normal'],
            fontSize=11,
            textColor=colors.HexColor('#1a237e'),
            spaceAfter=8,
            spaceBefore=8,
            fontName='Helvetica',
            leftIndent=15,
            backColor=colors.HexColor('#e3f2fd'),
            borderPadding=8
        ))
        
        # Day summary style
        self.styles.add(ParagraphStyle(
            name='DaySummary',
            parent=self.styles['Normal'],
            fontSize=10,
            textColor=colors.HexColor('#424242'),
            spaceAfter=4,
            fontName='Helvetica',
            leftIndent=20,
            bulletIndent=10
        ))

    def generate_production_report(self, report_data, filename):
        """Generate production report PDF"""
        buffer = BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=landscape(A4),
            rightMargin=15*mm,
            leftMargin=15*mm,
            topMargin=15*mm,
            bottomMargin=15*mm
        )
        
        story = []
        
        # Header with company branding - Compact
        story.append(Paragraph("🔆 GAUTAM SOLAR PVT. LTD.", self.styles['CustomTitle']))
        story.append(Paragraph("📊 Daily Production & Quality Report", self.styles['CustomSubtitle']))
        story.append(Spacer(1, 6))
        
        # Report Info - Enhanced design
        info_data = [
            ['📅 Report Period:', f"{report_data.get('start_date', '')} to {report_data.get('end_date', '')}"],
            ['🕐 Generated On:', datetime.now().strftime('%d-%m-%Y %H:%M:%S')],
            ['⚡ Module Type:', f"{report_data.get('module_wattage', '625')}W {report_data.get('module_type', 'Topcon')}"],
            ['🏭 Company:', report_data.get('company_name', 'N/A')],
        ]
        
        info_table = Table(info_data, colWidths=[60*mm, 120*mm])
        info_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (0, -1), colors.HexColor('#90caf9')),
            ('BACKGROUND', (1, 0), (1, -1), colors.HexColor('#e3f2fd')),
            ('TEXTCOLOR', (0, 0), (0, -1), colors.HexColor('#1a237e')),
            ('TEXTCOLOR', (1, 0), (1, -1), colors.HexColor('#1a237e')),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
            ('FONTNAME', (1, 0), (1, -1), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 9),
            ('GRID', (0, 0), (-1, -1), 1, colors.HexColor('#64b5f6')),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('LEFTPADDING', (0, 0), (-1, -1), 6),
            ('RIGHTPADDING', (0, 0), (-1, -1), 6),
            ('TOPPADDING', (0, 0), (-1, -1), 4),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ]))
        story.append(info_table)
        story.append(Spacer(1, 8))
        
        # Get report options
        report_options = report_data.get('report_options', {
            'includeProductionDetails': True,
            'includeCellInventory': True,
            'includeKPIMetrics': True,
            'includeDayWiseSummary': True,
            'includeRejections': True
        })
        
        # Debug: Print received options
        print("📊 Report Options Received:", report_options)
        
        # Production Summary Section
        if report_options.get('includeProductionDetails', True):
            story.append(Paragraph("📈 PRODUCTION & REJECTION ANALYSIS", self.styles['SectionHeader']))
            story.append(Spacer(1, 4))
        
        production_records = report_data.get('production_records', [])
        rejected_modules_list = report_data.get('rejected_modules', [])
        cells_per_module = report_data.get('cells_per_module', 132)
        
        # Get date range for filtering
        start_date = report_data.get('start_date', '')
        end_date = report_data.get('end_date', '')
        
        # Filter rejections by date range
        filtered_rejections = []
        for module in rejected_modules_list:
            rej_date = module.get('rejection_date', '') or module.get('rejectionDate', '')
            if start_date <= rej_date <= end_date:
                filtered_rejections.append(module)
        
        # Cell inventory calculations - Always calculate for internal use
        cells_received_qty = report_data.get('cells_received_qty', 0)
        cells_received_mw = report_data.get('cells_received_mw', 0)
        
        # Convert MW to cell count if needed (cells_received_qty might be in MW format)
        try:
            cells_received_qty = float(cells_received_qty)
            # If value is less than 10000, it's probably MW, convert to cells
            # Formula: 50 MW = 5,160,960 cells (as per customer specification)
            # This means: MW * 103,219.2 cells per MW
            if cells_received_qty < 10000:  # Likely in MW
                # Direct conversion: 1 MW = 103,219.2 cells
                cells_received_qty = int(cells_received_qty * 103219.2)
        except (ValueError, TypeError):
            cells_received_qty = 0
        
        # Calculate totals - needed for other sections
        total_produced = 0
        total_cells_used = 0
        total_cells_rejected = 0
        total_modules_rejected = 0
        
        for record in production_records:
            day_prod = record.get('day_production', 0)
            night_prod = record.get('night_production', 0)
            daily_total = day_prod + night_prod
            cells_used_today = daily_total * cells_per_module
            cell_rej_percent = record.get('cell_rejection_percent', 0)
            cells_rejected_today = int((cells_used_today * cell_rej_percent) / 100)
            module_rej_percent = record.get('module_rejection_percent', 0)
            modules_rejected_today = int((daily_total * module_rej_percent) / 100)
            
            total_produced += daily_total
            total_cells_used += cells_used_today
            total_cells_rejected += cells_rejected_today
            total_modules_rejected += modules_rejected_today
        
        if production_records and report_options.get('includeProductionDetails', True):
            # Detailed production table - without cell calculations
            prod_data = [['Date', 'Day', 'Night', 'Total\nProduced', 'Module\nRej %', 'Modules\nRejected']]
            
            for record in production_records:
                date_str = record.get('date', '')
                day_prod = record.get('day_production', 0)
                night_prod = record.get('night_production', 0)
                daily_total = day_prod + night_prod
                
                # Module rejection percentage and count
                module_rej_percent = record.get('module_rejection_percent', 0)
                modules_rejected_today = int((daily_total * module_rej_percent) / 100)
                
                # Count actual rejected modules from filtered list for this date
                actual_rejected = len([m for m in filtered_rejections if m.get('rejectionDate') == date_str or m.get('rejection_date') == date_str])
                
                # Use actual count if available, otherwise use calculated
                if actual_rejected > 0:
                    modules_rejected_today = actual_rejected
                
                prod_data.append([
                    date_str,
                    str(int(day_prod)),
                    str(int(night_prod)),
                    str(int(daily_total)),
                    f"{module_rej_percent:.1f}%",
                    str(int(modules_rejected_today))
                ])
            
            # Add totals row
            prod_data.append([
                'TOTAL',
                '',
                '',
                str(int(total_produced)),
                '',
                str(int(total_modules_rejected))
            ])
            prod_table = Table(prod_data, colWidths=[50*mm, 30*mm, 30*mm, 35*mm, 30*mm, 35*mm])
            prod_table.setStyle(TableStyle([
                # Header row - Enhanced
                ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#64b5f6')),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.HexColor('#1a237e')),
                ('ALIGN', (0, 0), (-1, 0), 'CENTER'),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, 0), 8),
                ('BOTTOMPADDING', (0, 0), (-1, 0), 6),
                ('TOPPADDING', (0, 0), (-1, 0), 6),
                ('VALIGN', (0, 0), (-1, 0), 'MIDDLE'),
                
                # Data rows
                ('ALIGN', (0, 1), (0, -2), 'CENTER'),
                ('ALIGN', (1, 1), (-1, -1), 'CENTER'),
                ('FONTNAME', (0, 1), (-1, -2), 'Helvetica'),
                ('FONTSIZE', (0, 1), (-1, -2), 8),
                ('ROWBACKGROUNDS', (0, 1), (-1, -2), [colors.HexColor('#ffffff'), colors.HexColor('#e3f2fd')]),
                ('GRID', (0, 0), (-1, -2), 1, colors.HexColor('#bbdefb')),
                
                # Highlight rejection columns
                ('BACKGROUND', (5, 1), (5, -2), colors.HexColor('#fff9c4')),
                ('BACKGROUND', (7, 1), (7, -2), colors.HexColor('#ffccbc')),
                ('BACKGROUND', (8, 1), (8, -2), colors.HexColor('#ffcdd2')),
                
                # Total row - Bold and highlighted
                ('BACKGROUND', (0, -1), (-1, -1), colors.HexColor('#90caf9')),
                ('TEXTCOLOR', (0, -1), (-1, -1), colors.HexColor('#1a237e')),
                ('FONTNAME', (0, -1), (-1, -1), 'Helvetica-Bold'),
                ('FONTSIZE', (0, -1), (-1, -1), 10),
                ('GRID', (0, -1), (-1, -1), 2, colors.HexColor('#64b5f6')),
                
                ('TOPPADDING', (0, 0), (-1, -1), 4),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
                ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ]))
            story.append(prod_table)
        
        story.append(Spacer(1, 10))
        
        # Key Performance Metrics - Enhanced Cards
        if report_options.get('includeKPIMetrics', True):
            story.append(Paragraph("📊 KEY METRICS", self.styles['SectionHeader']))
            story.append(Spacer(1, 4))
        
        total_mw = report_data.get('total_mw', 0)
        cell_rejection = report_data.get('cell_rejection_percent', 0)
        module_rejection = report_data.get('module_rejection_percent', 0)
        cell_stock = report_data.get('cell_stock', 0)
        
        # Convert to float if string
        try:
            total_mw = float(total_mw) if total_mw else 0
            cell_rejection = float(cell_rejection) if cell_rejection else 0
            module_rejection = float(module_rejection) if module_rejection else 0
            efficiency_rate = 100 - module_rejection if module_rejection else 100
        except (ValueError, TypeError):
            total_mw = 0
            cell_rejection = 0
            module_rejection = 0
            efficiency_rate = 100
        
        summary_data = [
            ['🏭 Total Production', '⚡ Total Power', '🔴 Cell Rejection', '❌ Module Rejection', '✅ Efficiency'],
            [
                f"{total_produced} units",
                f"{total_mw:.2f} MW",
                f"{cell_rejection:.1f}%",
                f"{module_rejection:.1f}%",
                f"{efficiency_rate:.1f}%"
            ]
        ]
        
        summary_table = Table(summary_data, colWidths=[37*mm] * 5)
        summary_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#7e57c2')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTNAME', (0, 1), (-1, 1), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 9),
            ('FONTSIZE', (0, 1), (-1, 1), 12),
            ('BACKGROUND', (0, 1), (0, 1), colors.HexColor('#c8e6c9')),
            ('BACKGROUND', (1, 1), (1, 1), colors.HexColor('#bbdefb')),
            ('BACKGROUND', (2, 1), (2, 1), colors.HexColor('#fff9c4')),
            ('BACKGROUND', (3, 1), (3, 1), colors.HexColor('#ffccbc')),
            ('BACKGROUND', (4, 1), (4, 1), colors.HexColor('#c5e1a5')),
            ('TEXTCOLOR', (0, 1), (-1, 1), colors.HexColor('#1a237e')),
            ('GRID', (0, 0), (-1, -1), 1.5, colors.HexColor('#7e57c2')),
            ('TOPPADDING', (0, 0), (-1, -1), 8),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ]))
        if report_options.get('includeKPIMetrics', True):
            story.append(summary_table)
        
        # Rejected Modules Section - START FROM NEW PAGE
        if filtered_rejections and report_options.get('includeRejections', True):
            story.append(PageBreak())
            story.append(Paragraph("🔍 REJECTION ANALYSIS", self.styles['SectionHeader']))
            story.append(Spacer(1, 4))
            
            # Group rejections by date
            rejections_by_date = {}
            for module in filtered_rejections:
                date = module.get('rejection_date', 'Unknown')
                if date not in rejections_by_date:
                    rejections_by_date[date] = []
                rejections_by_date[date].append(module)
            
            # Enhanced summary with visual appeal
            total_rejections = len(filtered_rejections)
            total_dates = len(rejections_by_date)
            summary_text = f"<b><font size=12 color='#d32f2f'>⚠️ Total Rejected in Period: {total_rejections} modules</font></b> | <b><font size=11 color='#1a237e'>Across {total_dates} days</font></b>"
            story.append(Paragraph(summary_text, self.styles['SummaryBox']))
            story.append(Spacer(1, 12))
            
            # Day-wise Summary Box - MOVED TO TOP
            if report_options.get('includeDayWiseSummary', True):
                story.append(Paragraph("<b>📅 Day-wise Rejection Breakdown:</b>", self.styles['Normal']))
                story.append(Spacer(1, 6))
            
            sorted_dates = sorted(rejections_by_date.keys())
            
            # Create a nice table for day-wise summary
            day_summary_data = [['Date', 'Rejected Modules', 'Visual Status']]
            for date in sorted_dates:
                count = len(rejections_by_date[date])
                # Visual indicator based on rejection count
                if count > 50:
                    status = '🔴 Critical'
                    status_color = colors.HexColor('#d32f2f')
                elif count > 20:
                    status = '🟠 High'
                    status_color = colors.HexColor('#f57c00')
                elif count > 10:
                    status = '🟡 Medium'
                    status_color = colors.HexColor('#fbc02d')
                else:
                    status = '🟢 Low'
                    status_color = colors.HexColor('#388e3c')
                
                day_summary_data.append([date, f"{count} modules", status])
            
            day_summary_table = Table(day_summary_data, colWidths=[45*mm, 45*mm, 45*mm])
            day_summary_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#ef5350')),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
                ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
                ('FONTSIZE', (0, 0), (-1, 0), 10),
                ('FONTSIZE', (0, 1), (-1, -1), 9),
                ('GRID', (0, 0), (-1, -1), 1.5, colors.HexColor('#ef5350')),
                ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.HexColor('#ffebee'), colors.HexColor('#ffffff')]),
                ('TOPPADDING', (0, 0), (-1, -1), 8),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
                ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ]))
            if report_options.get('includeDayWiseSummary', True):
                story.append(day_summary_table)
                story.append(Spacer(1, 15))
            
            # Page break if rejection list is very long
            if total_rejections > 30:
                story.append(PageBreak())
            
            # Detailed rejection table with grouping - 2 Column Layout for better space usage
            story.append(Paragraph("<b>📋 Complete Rejection Details (Date & Serial Number wise):</b>", self.styles['Normal']))
            story.append(Spacer(1, 8))
            
            # Create 3-column layout for rejection details - Maximum space efficiency
            serial_no = 1
            all_rejections = []
            
            # Process rejections date by date
            for date in sorted_dates:
                modules = rejections_by_date[date]
                modules_sorted = sorted(modules, key=lambda x: x.get('serial_number', ''))
                
                for module in modules_sorted:
                    all_rejections.append({
                        'no': serial_no,
                        'date': date,
                        'serial': module.get('serial_number', ''),
                        'reason': module.get('reason', 'Quality Issue'),
                        'stage': module.get('stage', 'N/A')
                    })
                    serial_no += 1
            
            # Break into pages - max 15 rows per column (45 total in 3 columns)
            # This ensures tables fit within page height (498 points)
            rows_per_page = 15
            
            for page_start in range(0, len(all_rejections), rows_per_page * 3):
                if page_start > 0:
                    story.append(PageBreak())
                    story.append(Paragraph("<b>📋 Rejection Details (Continued):</b>", self.styles['Normal']))
                    story.append(Spacer(1, 6))
                
                page_end = min(page_start + rows_per_page * 3, len(all_rejections))
                page_rejections = all_rejections[page_start:page_end]
                
                # Split current page data into 3 columns
                third = len(page_rejections) // 3
                col1_page = page_rejections[:third]
                col2_page = page_rejections[third:third*2]
                col3_page = page_rejections[third*2:]
                
                # Create 3 side-by-side tables for current page
                col1_data = [['No', 'Date', 'Serial', 'Reason']]
                for rej in col1_page:
                    # Truncate only if really necessary
                    serial_short = rej['serial'][:18] + '..' if len(rej['serial']) > 18 else rej['serial']
                    reason_short = rej['reason'][:22] + '..' if len(rej['reason']) > 22 else rej['reason']
                    col1_data.append([
                        str(rej['no']),
                        rej['date'],
                        serial_short,
                        reason_short
                    ])
                
                col2_data = [['No', 'Date', 'Serial', 'Reason']]
                for rej in col2_page:
                    serial_short = rej['serial'][:18] + '..' if len(rej['serial']) > 18 else rej['serial']
                    reason_short = rej['reason'][:22] + '..' if len(rej['reason']) > 22 else rej['reason']
                    col2_data.append([
                        str(rej['no']),
                        rej['date'],
                        serial_short,
                        reason_short
                    ])
                
                col3_data = [['No', 'Date', 'Serial', 'Reason']]
                for rej in col3_page:
                    serial_short = rej['serial'][:18] + '..' if len(rej['serial']) > 18 else rej['serial']
                    reason_short = rej['reason'][:22] + '..' if len(rej['reason']) > 22 else rej['reason']
                    col3_data.append([
                        str(rej['no']),
                        rej['date'],
                        serial_short,
                        reason_short
                    ])
                
                # Create 3 tables with wider column widths for better readability
                col1_table = Table(col1_data, colWidths=[7*mm, 20*mm, 30*mm, 30*mm])
                col2_table = Table(col2_data, colWidths=[7*mm, 20*mm, 30*mm, 30*mm])
                col3_table = Table(col3_data, colWidths=[7*mm, 20*mm, 30*mm, 30*mm])
                
                # Style for individual column tables with new color scheme
                table_style_common = TableStyle([
                    # Header styling - Orange and White combination
                    ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#ff6f00')),
                    ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
                    ('ALIGN', (0, 0), (-1, 0), 'CENTER'),
                    ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                    ('FONTSIZE', (0, 0), (-1, 0), 8),
                    ('TOPPADDING', (0, 0), (-1, 0), 6),
                    ('BOTTOMPADDING', (0, 0), (-1, 0), 6),
                    
                    # Data styling
                    ('ALIGN', (0, 1), (1, -1), 'CENTER'),
                    ('ALIGN', (2, 1), (-1, -1), 'LEFT'),
                    ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
                    ('FONTSIZE', (0, 1), (-1, -1), 7),
                    ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#ffb74d')),
                    ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.HexColor('#fff3e0'), colors.HexColor('#ffffff')]),
                    ('TOPPADDING', (0, 1), (-1, -1), 4),
                    ('BOTTOMPADDING', (0, 1), (-1, -1), 4),
                    ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
                    ('LEFTPADDING', (0, 0), (-1, -1), 3),
                    ('RIGHTPADDING', (0, 0), (-1, -1), 3),
                ])
                
                col1_table.setStyle(table_style_common)
                col2_table.setStyle(table_style_common)
                col3_table.setStyle(table_style_common)
                
                # Combine 3 tables side by side with proper spacing
                combined_data = [[col1_table, col2_table, col3_table]]
                reject_table = Table(combined_data, colWidths=[87*mm, 87*mm, 87*mm])
                reject_table.setStyle(TableStyle([
                    ('VALIGN', (0, 0), (-1, -1), 'TOP'),
                    ('LEFTPADDING', (0, 0), (-1, -1), 2),
                    ('RIGHTPADDING', (0, 0), (-1, -1), 2),
                ]))
                
                story.append(reject_table)
                story.append(Spacer(1, 10))
        
        # BOM Materials & Documents Section - SEPARATE PAGE with Day/Night Shift Tables
        if report_options.get('includeBomMaterials', True):
            story.append(PageBreak())
            story.append(Paragraph("📦 BOM MATERIALS SUMMARY (Day & Night Shift)", self.styles['SectionHeader']))
            story.append(Spacer(1, 8))
            
            # Collect all BOM materials grouped by shift
            day_shift_materials = []
            night_shift_materials = []
            
            for record in production_records:
                if start_date and end_date:
                    if not (start_date <= record.get('date', '') <= end_date):
                        continue
                
                date = record.get('date', 'N/A')
                bom_materials = record.get('bom_materials', [])
                
                for bom in bom_materials:
                    material_name = bom.get('materialName', bom.get('material_name', 'N/A'))
                    material_company = bom.get('company', '-')
                    material_lot = bom.get('lotNumber', bom.get('lot_number', '-'))
                    shift = bom.get('shift', 'day')  # Default to day if not specified
                    
                    material_row = [date, material_name, material_company, material_lot]
                    
                    if shift == 'night':
                        night_shift_materials.append(material_row)
                    else:
                        day_shift_materials.append(material_row)
            
            # Create Day Shift Table
            if day_shift_materials:
                story.append(Paragraph("🌞 DAY SHIFT BOM MATERIALS", self.styles['Normal']))
                story.append(Spacer(1, 4))
                
                day_data = [['Date', 'Material Name', 'Company', 'Lot Number']] + day_shift_materials
                day_table = Table(day_data, colWidths=[30*mm, 60*mm, 50*mm, 40*mm])
                day_table.setStyle(TableStyle([
                    ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#FF9800')),
                    ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
                    ('ALIGN', (0, 0), (-1, 0), 'CENTER'),
                    ('ALIGN', (0, 1), (-1, -1), 'LEFT'),
                    ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                    ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
                    ('FONTSIZE', (0, 0), (-1, -1), 8),
                    ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
                    ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#FFF3E0')]),
                    ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
                    ('TOPPADDING', (0, 0), (-1, -1), 4),
                    ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
                    ('LEFTPADDING', (0, 0), (-1, -1), 4),
                    ('RIGHTPADDING', (0, 0), (-1, -1), 4),
                ]))
                story.append(day_table)
                story.append(Spacer(1, 15))
            else:
                story.append(Paragraph("🌞 DAY SHIFT: <i>No BOM materials uploaded</i>", self.styles['Normal']))
                story.append(Spacer(1, 15))
            
            # Create Night Shift Table
            if night_shift_materials:
                story.append(Paragraph("🌙 NIGHT SHIFT BOM MATERIALS", self.styles['Normal']))
                story.append(Spacer(1, 4))
                
                night_data = [['Date', 'Material Name', 'Company', 'Lot Number']] + night_shift_materials
                night_table = Table(night_data, colWidths=[30*mm, 60*mm, 50*mm, 40*mm])
                night_table.setStyle(TableStyle([
                    ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#3F51B5')),
                    ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
                    ('ALIGN', (0, 0), (-1, 0), 'CENTER'),
                    ('ALIGN', (0, 1), (-1, -1), 'LEFT'),
                    ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                    ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
                    ('FONTSIZE', (0, 0), (-1, -1), 8),
                    ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
                    ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#E8EAF6')]),
                    ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
                    ('TOPPADDING', (0, 0), (-1, -1), 4),
                    ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
                    ('LEFTPADDING', (0, 0), (-1, -1), 4),
                    ('RIGHTPADDING', (0, 0), (-1, -1), 4),
                ]))
                story.append(night_table)
                story.append(Spacer(1, 10))
            else:
                story.append(Paragraph("🌙 NIGHT SHIFT: <i>No BOM materials uploaded</i>", self.styles['Normal']))
                story.append(Spacer(1, 10))
        
        # Remarks Section
        remarks = report_data.get('remarks', '')
        if remarks:
            story.append(Spacer(1, 18))
            story.append(Paragraph("📝 REMARKS & NOTES", self.styles['SectionHeader']))
            story.append(Spacer(1, 8))
            remarks_style = ParagraphStyle(
                'RemarksStyle',
                parent=self.styles['Normal'],
                fontSize=10,
                textColor=colors.HexColor('#424242'),
                leftIndent=15,
                rightIndent=15,
                spaceBefore=5,
                spaceAfter=5
            )
            story.append(Paragraph(remarks, remarks_style))
        
        # Footer Section
        story.append(Spacer(1, 20))
        footer_data = [
            ['Report Generated By:', 'Gautam Solar Quality Management System'],
            ['Contact:', 'quality@gautamsolar.com'],
            ['Report ID:', f"PDI-{datetime.now().strftime('%Y%m%d-%H%M%S')}"]
        ]
        
        footer_table = Table(footer_data, colWidths=[50*mm, 130*mm])
        footer_table.setStyle(TableStyle([
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
            ('FONTNAME', (1, 0), (1, -1), 'Helvetica'),
            ('FONTSIZE', (0, 0), (-1, -1), 8),
            ('TEXTCOLOR', (0, 0), (-1, -1), colors.HexColor('#757575')),
            ('TOPPADDING', (0, 0), (-1, -1), 3),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
            ('LINEABOVE', (0, 0), (-1, 0), 1, colors.HexColor('#e0e0e0')),
        ]))
        story.append(footer_table)
        
        # Build PDF
        doc.build(story)
        buffer.seek(0)
        
        # Documents are now shown as clickable links instead of being merged
        # No need to merge PDFs anymore
        
        return buffer
    
    def _merge_supporting_documents(self, main_pdf_buffer, report_data):
        """Merge IPQC PDF and FTR documents into the main report"""
        try:
            from PyPDF2 import PdfReader, PdfWriter
            
            writer = PdfWriter()
            
            # Add main report pages
            main_reader = PdfReader(main_pdf_buffer)
            for page in main_reader.pages:
                writer.add_page(page)
            
            # Collect all IPQC PDFs and FTR documents from production records
            production_records = report_data.get('production_records', [])
            
            for record in production_records:
                date = record.get('date', 'N/A')
                
                # Add IPQC PDF if exists
                ipqc_pdf = record.get('ipqc_pdf')
                if ipqc_pdf:
                    ipqc_path = self._get_full_path(ipqc_pdf)
                    if os.path.exists(ipqc_path):
                        try:
                            ipqc_reader = PdfReader(ipqc_path)
                            # Add separator page
                            from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer
                            from reportlab.lib.pagesizes import A4
                            separator_buffer = BytesIO()
                            separator_doc = SimpleDocTemplate(separator_buffer, pagesize=A4)
                            separator_story = [
                                Paragraph(f"📋 IPQC PDF - Date: {date}", self.styles['SectionHeader']),
                                Spacer(1, 20),
                                Paragraph(f"Attached: {os.path.basename(ipqc_pdf)}", self.styles['Normal'])
                            ]
                            separator_doc.build(separator_story)
                            separator_buffer.seek(0)
                            separator_reader = PdfReader(separator_buffer)
                            for page in separator_reader.pages:
                                writer.add_page(page)
                            # Add actual IPQC PDF pages
                            for page in ipqc_reader.pages:
                                writer.add_page(page)
                            print(f"✓ Merged IPQC PDF for date {date}")
                        except Exception as e:
                            print(f"ERROR merging IPQC PDF for {date}: {str(e)}")
                
                # Add FTR document if exists (if it's a PDF)
                ftr_document = record.get('ftr_document')
                if ftr_document and ftr_document.lower().endswith('.pdf'):
                    ftr_path = self._get_full_path(ftr_document)
                    if os.path.exists(ftr_path):
                        try:
                            ftr_reader = PdfReader(ftr_path)
                            # Add separator page
                            separator_buffer = BytesIO()
                            separator_doc = SimpleDocTemplate(separator_buffer, pagesize=A4)
                            separator_story = [
                                Paragraph(f"📑 FTR Document - Date: {date}", self.styles['SectionHeader']),
                                Spacer(1, 20),
                                Paragraph(f"Attached: {os.path.basename(ftr_document)}", self.styles['Normal'])
                            ]
                            separator_doc.build(separator_story)
                            separator_buffer.seek(0)
                            separator_reader = PdfReader(separator_buffer)
                            for page in separator_reader.pages:
                                writer.add_page(page)
                            # Add actual FTR PDF pages
                            for page in ftr_reader.pages:
                                writer.add_page(page)
                            print(f"✓ Merged FTR document for date {date}")
                        except Exception as e:
                            print(f"ERROR merging FTR document for {date}: {str(e)}")
            
            # Write merged PDF to buffer
            merged_buffer = BytesIO()
            writer.write(merged_buffer)
            merged_buffer.seek(0)
            
            print(f"✓ Successfully merged supporting documents. Total pages: {len(writer.pages)}")
            return merged_buffer
            
        except Exception as e:
            print(f"ERROR in PDF merging: {str(e)}")
            # Return original buffer if merging fails
            main_pdf_buffer.seek(0)
            return main_pdf_buffer
    
    def _get_full_path(self, relative_path):
        """Convert relative path to absolute path"""
        if os.path.isabs(relative_path):
            return relative_path
        backend_dir = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
        return os.path.join(backend_dir, relative_path)

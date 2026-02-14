"""
Peel Test Report Generator
Automatically generates peel test reports for 3 stringers, 2 times per day
"""

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm, inch
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib.enums import TA_CENTER
from datetime import datetime
import os
import random


class PeelTestReportGenerator:
    def __init__(self, output_folder='generated_pdfs'):
        """Initialize the report generator"""
        self.output_folder = output_folder
        
        # Configuration
        self.stringers = ['Stringer 1', 'Stringer 2', 'Stringer 3']
        self.shifts = ['Morning', 'Evening']
        
        # Create output folder if it doesn't exist
        if not os.path.exists(self.output_folder):
            os.makedirs(self.output_folder)
    
    def generate_sample_data(self):
        """Generate realistic sample data for 16 samples across 7 intervals"""
        data = []
        for i in range(16):
            row = [i + 1]  # Sample number
            for interval in range(7):
                # Generate realistic values between 2.0 and 4.0
                value = round(random.uniform(2.0, 4.0), 3)
                row.append(value)
            data.append(row)
        return data
    
    def generate_report(self, stringer_name, shift_name, date=None):
        """Generate a single peel test report PDF"""
        if date is None:
            date = datetime.now()
        
        # Create filename
        filename = f"PeelTest_{stringer_name.replace(' ', '_')}_{shift_name}_{date.strftime('%Y%m%d_%H%M')}.pdf"
        filepath = os.path.join(self.output_folder, filename)
        
        # Create PDF document
        doc = SimpleDocTemplate(
            filepath,
            pagesize=landscape(A4),
            rightMargin=15*mm,
            leftMargin=15*mm,
            topMargin=15*mm,
            bottomMargin=15*mm
        )
        
        # Container for elements
        elements = []
        
        # Styles
        styles = getSampleStyleSheet()
        
        # Header table (Company name and document details)
        header_left = Paragraph('<b>☐GAUTAM</b><br/><font size=9>Gautam Solar Private Limited</font>', styles['Normal'])
        
        doc_info_table = Table([
            ['Document No.', 'GSPL/IPQC/S5/009'],
            ['Issue Date', '01/11/2024'],
            ['Rev. No. & Date', '0']
        ], colWidths=[35*mm, 35*mm])
        doc_info_table.setStyle(TableStyle([
            ('GRID', (0, 0), (-1, -1), 0.5, colors.black),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('FONTSIZE', (0, 0), (-1, -1), 9),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ]))
        
        header_table = Table([[header_left, doc_info_table]], colWidths=[120*mm, 70*mm])
        header_table.setStyle(TableStyle([
            ('GRID', (0, 0), (-1, -1), 0.5, colors.black),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('ALIGN', (0, 0), (0, 0), 'LEFT'),
            ('ALIGN', (1, 0), (1, 0), 'CENTER'),
        ]))
        elements.append(header_table)
        
        # Title row
        title_table = Table([
            ['Type of Document:- Peel Test Report\nRibbon to Cell', 'Page\n\nPage 1 of 1']
        ], colWidths=[140*mm, 50*mm])
        title_table.setStyle(TableStyle([
            ('GRID', (0, 0), (-1, -1), 0.5, colors.black),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('FONTNAME', (0, 0), (-1, -1), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 10),
        ]))
        elements.append(title_table)
        elements.append(Spacer(1, 10*mm))
        
        # Date, Stringer, Shift information
        info_para = Paragraph(
            f'<b>DATE:-{date.strftime("%d/%m/%Y")}     '
            f'STRINGER :- {stringer_name}     '
            f'SHIFT:- {shift_name}</b>',
            styles['Normal']
        )
        elements.append(info_para)
        elements.append(Spacer(1, 10*mm))
        
        # Graph/Chart placeholder
        chart_para = Paragraph(
            '<i><font color="gray">[Graph/Chart Area - Sample measurements visualization]</font></i>',
            ParagraphStyle('ChartPlaceholder', parent=styles['Normal'], alignment=TA_CENTER, fontSize=9)
        )
        elements.append(chart_para)
        elements.append(Spacer(1, 20*mm))
        
        # Generate sample data
        sample_data = self.generate_sample_data()
        
        # Create main data table
        headers = [
            'No.', 'MaxForce\n@ 1st\nInterval\n(N)', 'MaxForce\n@ 2nd\nInterval\n(N)',
            'MaxForce\n@ 3rd\nInterval\n(N)', 'MaxForce\n@ 4th\nInterval\n(N)',
            'MaxForce\n@ 5th\nInterval\n(N)', 'MaxForce\n@ 6th\nInterval\n(N)',
            'MaxForce\n@ 7th\nInterval\n(N)'
        ]
        
        table_data = [headers]
        for sample in sample_data:
            row = [str(sample[0])] + [f'{v:.3f}' for v in sample[1:]]
            table_data.append(row)
        
        # Create table
        data_table = Table(table_data, colWidths=[15*mm] + [24*mm] * 7)
        data_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#D9D9D9')),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 8),
            ('FONTSIZE', (0, 1), (-1, -1), 9),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 10),
            ('TOPPADDING', (0, 0), (-1, -1), 3),
            ('BOTTOMPADDING', (0, 1), (-1, -1), 3),
        ]))
        elements.append(data_table)
        
        # Add note
        elements.append(Spacer(1, 10*mm))
        note_para = Paragraph(
            '<i>Note: Standard specification for peel strength ≥ 1.5 N/mm</i>',
            ParagraphStyle('Note', parent=styles['Normal'], fontSize=9)
        )
        elements.append(note_para)
        
        # Build PDF
        doc.build(elements)
        return filepath
    
    def generate_daily_reports(self, date=None):
        """Generate all reports for a day (3 stringers × 2 shifts = 6 reports)"""
        if date is None:
            date = datetime.now()
        
        generated_files = []
        for stringer in self.stringers:
            for shift in self.shifts:
                report_time = date.replace(hour=9 if shift == 'Morning' else 17, minute=0)
                filepath = self.generate_report(stringer, shift, report_time)
                generated_files.append(filepath)
                print(f"✓ Generated: {os.path.basename(filepath)}")
        return generated_files


def generate_peel_test_pdf(data):
    """
    Generate peel test PDF report
    
    Args:
        data: Dictionary containing:
            - date: Report date
            - stringer: Stringer name (Stringer 1/2/3)
            - shift: Shift name (Morning/Evening)
    
    Returns:
        str: Path to generated PDF file
    """
    generator = PeelTestReportGenerator()
    
    stringer_name = data.get('stringer', 'Stringer 1')
    shift_name = data.get('shift', 'Morning')
    report_date = data.get('date', datetime.now())
    
    if isinstance(report_date, str):
        report_date = datetime.strptime(report_date, '%Y-%m-%d')
    
    filepath = generator.generate_report(stringer_name, shift_name, report_date)
    
    return filepath

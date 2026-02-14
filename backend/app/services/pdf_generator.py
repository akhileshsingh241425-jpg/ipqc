"""
PDF Generation Service for IPQC Reports
"""
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib import colors
from reportlab.lib.units import mm
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, PageBreak
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from datetime import datetime
import os


class IPQCPDFGenerator:
    """Generate professional IPQC PDF reports"""
    
    def __init__(self, output_folder):
        self.output_folder = output_folder
        self.styles = getSampleStyleSheet()
        self._setup_custom_styles()
    
    def _setup_custom_styles(self):
        """Setup custom paragraph styles"""
        self.header_style = ParagraphStyle(
            'CustomHeader',
            parent=self.styles['Heading1'],
            fontSize=16,
            textColor=colors.HexColor('#1a237e'),
            spaceAfter=10,
            alignment=TA_CENTER
        )
        
        self.subheader_style = ParagraphStyle(
            'CustomSubHeader',
            parent=self.styles['Normal'],
            fontSize=10,
            alignment=TA_CENTER
        )
        
        self.cell_style = ParagraphStyle(
            'CellStyle',
            parent=self.styles['Normal'],
            fontSize=8,
            leading=10
        )
    
    def generate_ipqc_pdf(self, ipqc_data, bom_data, metadata):
        """
        Generate complete IPQC PDF
        
        Args:
            ipqc_data: List of stages with checkpoints and monitoring results
            bom_data: Customer BOM data
            metadata: Dict with date, shift, po_number, doc_number, etc.
        
        Returns:
            str: Path to generated PDF file
        """
        # Generate filename
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"IPQC_{metadata.get('customer_name', 'Report')}_{timestamp}.pdf"
        filepath = os.path.join(self.output_folder, filename)
        
        # Create PDF document
        doc = SimpleDocTemplate(
            filepath,
            pagesize=landscape(A4),
            rightMargin=10*mm,
            leftMargin=10*mm,
            topMargin=10*mm,
            bottomMargin=10*mm
        )
        
        # Build content - first page with header, then continuous stages
        story = []
        
        # Add header only on first page
        story.extend(self._create_header(metadata))
        story.append(Spacer(1, 2*mm))
        
        # Add all stages in one continuous table (no page breaks between stages)
        story.append(self._create_stages_table(ipqc_data))
        
        # Build PDF with automatic page breaks
        doc.build(story)
        
        return filepath
    
    def _create_header(self, metadata):
        """Create document header"""
        story = []
        
        # Header table
        header_data = [
            [
                Paragraph('<b>GAUTAM</b><br/><font size=8>SOLAR</font>', self.header_style),
                Paragraph('<b>Gautam Solar Private Limited</b><br/><font size=12>IPQC Check Sheet</font>', 
                         self.header_style),
                [
                    [Paragraph('<b>Document No.</b>', self.cell_style), 
                     Paragraph(metadata.get('doc_number', 'GSPL/IPQC/IPC/003'), self.cell_style)],
                    [Paragraph('<b>Issue Date</b>', self.cell_style), 
                     Paragraph(metadata.get('issue_date', '01/12/2024'), self.cell_style)],
                    [Paragraph('<b>Rev. No./Rev.Date</b>', self.cell_style), 
                     Paragraph(metadata.get('revision', '01/30-08-2025'), self.cell_style)]
                ]
            ]
        ]
        
        header_table = Table(header_data, colWidths=[60*mm, 140*mm, 70*mm])
        header_table.setStyle(TableStyle([
            ('GRID', (0, 0), (-1, -1), 0.5, colors.black),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('ALIGN', (0, 0), (0, 0), 'CENTER'),
            ('ALIGN', (1, 0), (1, 0), 'CENTER'),
        ]))
        
        story.append(header_table)
        
        # Date, Time, Shift info
        info_data = [
            [
                Paragraph('<b>Date:</b> ' + metadata.get('date', ''), self.cell_style),
                Paragraph('<b>Time:</b>', self.cell_style),
                Paragraph('<b>Shift:</b> ' + metadata.get('shift', ''), self.cell_style),
                Paragraph('<b>Po.no.:</b> ' + metadata.get('po_number', ''), self.cell_style)
            ]
        ]
        
        info_table = Table(info_data, colWidths=[60*mm, 60*mm, 60*mm, 90*mm])
        info_table.setStyle(TableStyle([
            ('GRID', (0, 0), (-1, -1), 0.5, colors.black),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ]))
        
        story.append(info_table)
        
        return story
    
    def _create_stages_table(self, stages):
        """Create table for stages"""
        # Table header
        table_data = [
            [
                Paragraph('<b>Sr.No.</b>', self.cell_style),
                Paragraph('<b>Stage</b>', self.cell_style),
                Paragraph('<b>Check point</b>', self.cell_style),
                Paragraph('<b>Quantum of Check</b><br/>Sample Size | Frequency', self.cell_style),
                Paragraph('<b>Shift</b><br/>Acceptance Criteria', self.cell_style),
                Paragraph('<b>Monitoring Result</b>', self.cell_style),
                Paragraph('<b>Remarks,If any</b>', self.cell_style)
            ]
        ]
        
        # Add stage data
        for stage in stages:
            checkpoints = stage.get('checkpoints', [])
            num_checkpoints = len(checkpoints)
            
            for idx, checkpoint in enumerate(checkpoints):
                row = []
                
                # Sr.No and Stage (only in first row)
                if idx == 0:
                    row.append(Paragraph(str(stage.get('sr_no', '')), self.cell_style))
                    row.append(Paragraph(stage.get('stage', ''), self.cell_style))
                else:
                    row.append('')
                    row.append('')
                
                # Checkpoint
                row.append(Paragraph(checkpoint.get('checkpoint', ''), self.cell_style))
                
                # Sample Size and Frequency
                sample_freq = f"{checkpoint.get('sample_size', '')}<br/>{checkpoint.get('frequency', '')}"
                row.append(Paragraph(sample_freq, self.cell_style))
                
                # Acceptance Criteria
                row.append(Paragraph(checkpoint.get('acceptance_criteria', ''), self.cell_style))
                
                # Monitoring Result
                monitoring = checkpoint.get('monitoring_result', '')
                if isinstance(monitoring, list):
                    monitoring_text = '<br/>'.join(monitoring)
                else:
                    monitoring_text = str(monitoring)
                row.append(Paragraph(monitoring_text, self.cell_style))
                
                # Remarks
                row.append(Paragraph(checkpoint.get('remarks', ''), self.cell_style))
                
                table_data.append(row)
        
        # Create table with column widths matching header tables (total 270mm)
        table = Table(table_data, colWidths=[15*mm, 35*mm, 45*mm, 35*mm, 50*mm, 55*mm, 35*mm])
        
        # Apply styling
        table.setStyle(TableStyle([
            # Header row
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1a237e')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, 0), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 9),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 10),
            
            # All cells
            ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('FONTSIZE', (0, 1), (-1, -1), 8),
            ('LEFTPADDING', (0, 0), (-1, -1), 3),
            ('RIGHTPADDING', (0, 0), (-1, -1), 3),
            ('TOPPADDING', (0, 0), (-1, -1), 3),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
        ]))
        
        # Add row spanning for stage cells
        row_idx = 1
        for stage in stages:
            num_checkpoints = len(stage.get('checkpoints', []))
            if num_checkpoints > 1:
                table.setStyle(TableStyle([
                    ('SPAN', (0, row_idx), (0, row_idx + num_checkpoints - 1)),
                    ('SPAN', (1, row_idx), (1, row_idx + num_checkpoints - 1)),
                ]))
            row_idx += num_checkpoints
        
        return table


class SerialNumberGenerator:
    """Generate and manage serial numbers"""
    
    @staticmethod
    def generate_serial_numbers(start_number, count):
        """
        Generate sequential serial numbers
        
        Args:
            start_number: Starting serial number (e.g., 10001)
            count: Number of serial numbers to generate
        
        Returns:
            list: List of serial numbers
        """
        return [start_number + i for i in range(count)]
    
    @staticmethod
    def format_serial_number(number, prefix="", suffix="", padding=5):
        """
        Format serial number with prefix/suffix
        
        Args:
            number: Serial number
            prefix: Prefix to add (e.g., "GSPL")
            suffix: Suffix to add
            padding: Zero padding length
        
        Returns:
            str: Formatted serial number
        """
        formatted = str(number).zfill(padding)
        if prefix:
            formatted = f"{prefix}{formatted}"
        if suffix:
            formatted = f"{formatted}{suffix}"
        return formatted

"""
FTR (Field Test Report) PDF Generator
Uses template PDF and fills it with exact coordinate positioning
"""

from io import BytesIO
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4
from reportlab.lib.utils import ImageReader
from PyPDF2 import PdfReader, PdfWriter
import os


class FTRPDFGenerator:
    """Generate FTR PDFs by overlaying data on template"""
    
    def __init__(self, template_path):
        """Initialize with template PDF path"""
        self.template_path = template_path
        
    def create_overlay(self, data):
        """Create overlay PDF with all the text values at exact positions"""
        packet = BytesIO()
        
        # Create canvas - A4 size (595.27 x 841.89 points)
        c = canvas.Canvas(packet, pagesize=A4)
        width, height = A4
        
        # Set font
        c.setFont("Helvetica", 11)
        c.setFillColorRGB(0, 0, 0)  # Black color
        
        # Helper function to place text (coordinates from bottom-left)
        def place_text(x, y, text):
            c.drawString(x, height - y, str(text))
        
        # Module identification (adjust Y coordinates from top)
        place_text(135, 175, data.get('producer', ''))
        place_text(135, 199, data.get('moduleType', ''))
        place_text(135, 223, data.get('serialNumber', ''))
        
        # Test conditions
        place_text(135, 313, data.get('testDate', ''))
        place_text(135, 337, data.get('testTime', ''))
        place_text(135, 361, f"{data.get('irradiance', 0):.2f} W/m²")
        place_text(135, 385, f"{data.get('moduleTemp', 0):.2f} °C")
        place_text(135, 409, f"{data.get('ambientTemp', 0):.2f} °C")
        
        # Test results
        results = data.get('results', {})
        place_text(135, 512, f"{results.get('pmax', 0):.2f} W")
        place_text(135, 536, f"{results.get('vpm', 0):.2f} V")
        place_text(135, 560, f"{results.get('ipm', 0):.2f} A")
        place_text(135, 584, f"{results.get('voc', 0):.2f} V")
        place_text(135, 608, f"{results.get('isc', 0):.2f} A")
        place_text(135, 632, f"{results.get('fillFactor', 0):.2f} %")
        place_text(135, 656, f"{results.get('rs', 0):.2f} Ω")
        place_text(135, 680, f"{results.get('rsh', 0):.2f} Ω")
        place_text(135, 704, f"{results.get('efficiency', 0):.2f} %")
        
        # Reference conditions
        place_text(585, 475, "1000.00 W/m²")
        place_text(585, 498, "25.00 °C")
        
        # Module Area
        place_text(630, 682, f"{data.get('moduleArea', 0)} m²")
        
        # Add graph image if provided
        graph_image_path = data.get('graphImagePath')
        if graph_image_path and os.path.exists(graph_image_path):
            # Position: left 400px, top 130px, size 460x310px
            # Convert to reportlab coordinates (from bottom-left)
            img_x = 400
            img_y = height - 130 - 310  # top - height
            img_width = 460
            img_height = 310
            
            try:
                c.drawImage(graph_image_path, img_x, img_y, 
                          width=img_width, height=img_height, 
                          preserveAspectRatio=True, mask='auto')
            except Exception as e:
                print(f"Error adding graph image: {e}")
        
        c.save()
        packet.seek(0)
        return packet
    
    def generate_pdf(self, data):
        """
        Generate final PDF by overlaying data on template
        
        Args:
            data: Dictionary with all test data
            
        Returns:
            BytesIO object containing the PDF
        """
        # Create overlay with text and graph
        overlay_pdf = self.create_overlay(data)
        
        # Read template PDF
        template_reader = PdfReader(self.template_path)
        overlay_reader = PdfReader(overlay_pdf)
        
        # Create writer
        writer = PdfWriter()
        
        # Get first page of template
        template_page = template_reader.pages[0]
        
        # Merge overlay onto template
        template_page.merge_page(overlay_reader.pages[0])
        
        # Add merged page to writer
        writer.add_page(template_page)
        
        # Write to BytesIO
        output = BytesIO()
        writer.write(output)
        output.seek(0)
        
        return output


def create_ftr_report(template_path, test_data, graph_image_path=None):
    """
    Convenience function to create FTR report
    
    Args:
        template_path: Path to template PDF
        test_data: Dictionary with test data
        graph_image_path: Optional path to graph image
        
    Returns:
        BytesIO object containing generated PDF
    """
    # Add graph path to data if provided
    if graph_image_path:
        test_data['graphImagePath'] = graph_image_path
    
    generator = FTRPDFGenerator(template_path)
    return generator.generate_pdf(test_data)

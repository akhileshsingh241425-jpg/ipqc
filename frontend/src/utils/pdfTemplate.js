import { jsPDF } from 'jspdf';

// Simple template-based export using jsPDF
export async function createReportFromTemplate(templateUrl, imageDataUrl, values) {
  const pdf = new jsPDF('p', 'pt', 'letter'); // 612 x 792 points
  
  // Load template PDF as image (you'll need to convert template to PNG first)
  // For now, we'll create a blank page and add text + graph
  
  // Add header
  pdf.setFontSize(20);
  pdf.setFont('helvetica', 'bold');
  pdf.text('Production Testing Report', 400, 50);
  
  // Module identification
  pdf.setFontSize(12);
  pdf.setFont('helvetica', 'bold');
  pdf.text('Module identification', 50, 100);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(10);
  pdf.text(`Producer: ${values.producer}`, 50, 120);
  pdf.text(`Module type: ${values.moduleType}`, 50, 135);
  pdf.text(`S/N: ${values.serialNumber}`, 50, 150);
  
  // Test conditions
  pdf.setFontSize(12);
  pdf.setFont('helvetica', 'bold');
  pdf.text('Test conditions', 50, 180);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(10);
  pdf.text(`Date: ${values.testDate}`, 50, 200);
  pdf.text(`Time: ${values.testTime}`, 50, 215);
  pdf.text(`Irradiance: ${values.irradiance}`, 50, 230);
  pdf.text(`Module temperature: ${values.moduleTemp}`, 50, 245);
  pdf.text(`Ambient temperature: ${values.ambientTemp}`, 50, 260);
  
  // Test results
  pdf.setFontSize(12);
  pdf.setFont('helvetica', 'bold');
  pdf.text('Test results', 50, 290);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(10);
  pdf.text(`Pmax: ${values.pmax.toFixed(2)} W`, 50, 310);
  pdf.text(`Vpm: ${values.vpm.toFixed(2)} V`, 50, 325);
  pdf.text(`Ipm: ${values.ipm.toFixed(2)} A`, 50, 340);
  pdf.text(`Voc: ${values.voc.toFixed(2)} V`, 50, 355);
  pdf.text(`Isc: ${values.isc.toFixed(2)} A`, 50, 370);
  pdf.text(`Fill factor: ${values.fillFactor.toFixed(2)} %`, 50, 385);
  pdf.text(`Rs: ${values.rs.toFixed(2)} Ω`, 50, 400);
  pdf.text(`Rsh: ${values.rsh.toFixed(2)} Ω`, 50, 415);
  pdf.text(`Module Efficiency: ${values.efficiency.toFixed(2)} %`, 50, 430);
  
  // Add graph image
  if (imageDataUrl) {
    pdf.addImage(imageDataUrl, 'PNG', 320, 100, 250, 200);
  }
  
  return pdf.output('arraybuffer');
}

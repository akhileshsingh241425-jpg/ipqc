import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import html2pdf from 'html2pdf.js';
import axios from 'axios';
import FTRTemplate from './FTRTemplate';
import { getStoredGraphs, getRandomGraphForPower } from './GraphManager';
import '../styles/PDIFTRGenerator.css';

const PDIFTRGenerator = () => {
  const [mode, setMode] = useState('simple'); // 'simple' or 'full'
  const [excelData, setExcelData] = useState([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [editingIndex, setEditingIndex] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [moduleAreaDefault, setModuleAreaDefault] = useState(2.7); // User-configurable default
  const [downloadType, setDownloadType] = useState('merged'); // 'merged' or 'split'
  const [downloadFormat, setDownloadFormat] = useState('pdf'); // 'pdf' or 'word'
  const [moduleType, setModuleType] = useState('monofacial'); // 'monofacial' or 'bifacial'

  // Check if user is super admin
  const isSuperAdmin = () => {
    return localStorage.getItem('userRole') === 'super_admin';
  };

  // Handle Excel file upload
  const handleExcelUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const workbook = XLSX.read(event.target.result, { type: 'binary' });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(sheet);
      
      // Ask user for module area
      const moduleAreaInput = prompt('Enter Module Area in m² (e.g., 2.7):', '2.7');
      if (moduleAreaInput !== null && moduleAreaInput !== '') {
        const parsed = parseFloat(moduleAreaInput);
        if (!isNaN(parsed)) {
          setModuleAreaDefault(parsed);
        }
      }
      
      setExcelData(data);
      alert(`${data.length} records loaded from Excel!`);
    };
    reader.readAsBinaryString(file);
  };



  // Auto-generate test data from serial number and power
  const generateTestData = (serialNumber, power, moduleArea = 2.7) => {
    const today = new Date();
    
    // Generate realistic test parameters based on power
    const baseValues = {
      510: { vmax: 41.5, imax: 12.3, voc: 49.8, isc: 13.0 },
      520: { vmax: 41.8, imax: 12.4, voc: 50.0, isc: 13.1 },
      530: { vmax: 42.1, imax: 12.6, voc: 50.3, isc: 13.3 },
      540: { vmax: 42.4, imax: 12.7, voc: 50.6, isc: 13.4 },
      550: { vmax: 42.9, imax: 12.8, voc: 51.0, isc: 13.5 },
      560: { vmax: 43.2, imax: 13.0, voc: 51.3, isc: 13.7 },
      580: { vmax: 44.1, imax: 13.2, voc: 52.2, isc: 13.9 },
      590: { vmax: 44.5, imax: 13.3, voc: 52.6, isc: 14.0 },
      600: { vmax: 44.8, imax: 13.4, voc: 52.9, isc: 14.2 },
      610: { vmax: 45.1, imax: 13.5, voc: 53.2, isc: 14.3 },
      630: { vmax: 45.4, imax: 13.9, voc: 53.8, isc: 14.7 },
      650: { vmax: 45.9, imax: 14.2, voc: 54.5, isc: 15.0 }
    };

    const specs = baseValues[power] || baseValues[630];
    
    // Add small random variations
    const pmax = power * (0.998 + Math.random() * 0.004);
    const vpm = specs.vmax + (Math.random() - 0.5) * 0.1;
    const ipm = specs.imax + (Math.random() - 0.5) * 0.05;
    const voc = specs.voc + (Math.random() - 0.5) * 0.1;
    const isc = specs.isc + (Math.random() - 0.5) * 0.05;
    const fillFactor = (pmax / (voc * isc)) * 100;
    const rs = 0.10 + Math.random() * 0.08;
    const rsh = 2200 + Math.random() * 600;
    const efficiency = (pmax / (moduleArea * 1000)) * 100;

    return {
      producer: 'Gautam Solar',
      moduleType: `${power}W`,
      serialNumber: serialNumber,
      testDate: today.toLocaleDateString('en-CA'),
      testTime: today.toLocaleTimeString('en-GB', { hour12: false }),
      irradiance: 1000 + (Math.random() - 0.5) * 2,
      moduleTemp: 24.5 + (Math.random() - 0.5) * 1,
      ambientTemp: 23.0 + (Math.random() - 0.5) * 1.5,
      moduleArea: moduleArea,
      results: {
        pmax: pmax,
        vpm: vpm,
        ipm: ipm,
        voc: voc,
        isc: isc,
        fillFactor: fillFactor,
        rs: rs,
        rsh: rsh,
        efficiency: efficiency
      }
    };
  };

  // Generate single PDF and return blob
  const generateSinglePDFBlob = async (testData, graphImage) => {
    return new Promise((resolve, reject) => {
      const container = document.createElement('div');
      container.style.position = 'absolute';
      container.style.left = '-9999px';
      container.style.top = '0';
      document.body.appendChild(container);

      const tempDiv = document.createElement('div');
      container.appendChild(tempDiv);
      
      import('react-dom/client').then(({ createRoot }) => {
        const root = createRoot(tempDiv);
        root.render(<FTRTemplate testData={testData} graphImage={graphImage} />);
        
        // Wait for image to load before generating PDF
        const waitForImages = () => {
          return new Promise((resolve) => {
            const images = tempDiv.getElementsByTagName('img');
            if (images.length === 0) {
              resolve();
              return;
            }
            
            let loadedCount = 0;
            const totalImages = images.length;
            
            const checkComplete = () => {
              loadedCount++;
              if (loadedCount >= totalImages) {
                resolve();
              }
            };
            
            Array.from(images).forEach(img => {
              if (img.complete) {
                checkComplete();
              } else {
                img.onload = checkComplete;
                img.onerror = checkComplete; // Continue even if image fails
              }
            });
            
            // Timeout fallback after 3 seconds
            setTimeout(resolve, 3000);
          });
        };
        
        // Wait for component render + images
        setTimeout(async () => {
          await waitForImages();
          
          const opt = {
            margin: 0,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { 
              scale: 2,
              useCORS: true,
              allowTaint: true,
              backgroundColor: '#ffffff',
              logging: false
            },
            jsPDF: { 
              orientation: 'portrait', 
              unit: 'mm', 
              format: 'a4',
              compress: true
            }
          };

          html2pdf().set(opt).from(tempDiv.firstChild).outputPdf('blob').then((blob) => {
            root.unmount();
            document.body.removeChild(container);
            resolve(blob);
          }).catch(reject);
        }, 500);
      }).catch(reject);
    });
  };

  // Upload PDFs to backend
  const uploadPDFsToBackend = async (pdfDataArray) => {
    try {
      const API_BASE_URL = process.env.REACT_APP_API_URL || process.env.REACT_APP_API_BASE_URL || 'http://localhost:5003';
      // Construct proper API endpoint (avoid double /api)
      const endpoint = API_BASE_URL.endsWith('/api') ? `${API_BASE_URL}/ftr/upload-bulk` : `${API_BASE_URL}/api/ftr/upload-bulk`;
      
      // Convert blobs to base64
      const reports = await Promise.all(pdfDataArray.map(async (item) => {
        const base64 = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result);
          reader.readAsDataURL(item.blob);
        });
        
        return {
          pdfData: base64,
          serialNumber: item.serialNumber,
          moduleType: item.moduleType,
          pmax: item.pmax
        };
      }));
      
      const response = await axios.post(endpoint, {
        reports: reports
      });
      
      return response.data;
    } catch (error) {
      console.error('Upload error:', error);
      throw error;
    }
  };

  // Generate all reports
  const generateAllReports = async (downloadMode = 'merged', format = 'pdf', modType = 'monofacial') => {
    if (excelData.length === 0) {
      alert('Please upload Excel file first!');
      return;
    }

    // Get stored graphs from server (async)
    const storedGraphs = await getStoredGraphs();
    if (Object.keys(storedGraphs).length === 0) {
      alert('No graphs found! Please upload graphs in Graph Manager first.');
      return;
    }

    setIsGenerating(true);
    setProgress(0);

    const pdfDataArray = [];

    for (let i = 0; i < excelData.length; i++) {
      const row = excelData[i];
      let testData;

      if (mode === 'simple') {
        // Simple mode: SerialNumber and Power only
        const serialNumber = row.SerialNumber || row['Serial Number'] || row.SN || '';
        const powerMatch = String(row.Power || row.ModuleType || '').match(/(\d+)/);
        const power = powerMatch ? powerMatch[1] : '630';
        
        testData = generateTestData(serialNumber, power, moduleAreaDefault);
      } else {
        // Full mode: Complete data from Excel
        testData = {
          producer: row.Producer || 'Gautam Solar',
          moduleType: row.ModuleType || row['Module Type'] || '',
          serialNumber: row.SerialNumber || row['Serial Number'] || '',
          testDate: row.Date || new Date().toLocaleDateString('en-CA'),
          testTime: row.Time || new Date().toLocaleTimeString('en-GB', { hour12: false }),
          irradiance: parseFloat(row.Irradiance) || 1000,
          moduleTemp: parseFloat(row.ModuleTemp || row['Module Temperature']) || 25,
          ambientTemp: parseFloat(row.AmbientTemp || row['Ambient Temperature']) || 23,
          moduleArea: parseFloat(row.ModuleArea || row['Module Area']) || moduleAreaDefault,
          results: {
            pmax: parseFloat(row.Pmax) || 0,
            vpm: parseFloat(row.Vpm) || 0,
            ipm: parseFloat(row.Ipm) || 0,
            voc: parseFloat(row.Voc) || 0,
            isc: parseFloat(row.Isc) || 0,
            fillFactor: parseFloat(row.FillFactor || row['Fill Factor']) || 0,
            rs: parseFloat(row.Rs) || 0,
            rsh: parseFloat(row.Rsh) || 0,
            efficiency: parseFloat(row.Efficiency) || 0
          }
        };
      }

      // Get graph image from stored graphs - USE RANDOM SELECTION with module type
      const powerMatch = testData.moduleType.match(/(\d+)/);
      const power = powerMatch ? powerMatch[1] : null;
      const graphImage = power ? await getRandomGraphForPower(power, modType) : null;
      
      if (!graphImage && power) {
        console.warn(`Warning: Could not load graph image for ${testData.serialNumber}`);
      }

      try {
        // Generate PDF blob
        const blob = await generateSinglePDFBlob(testData, graphImage);
        pdfDataArray.push({
          blob: blob,
          serialNumber: testData.serialNumber,
          moduleType: testData.moduleType,
          pmax: testData.results.pmax,
          testData: testData,
          graphImage: graphImage
        });
        
        // (no per-file download) collect blob for upload/merge
        
      } catch (error) {
        console.error(`Error generating PDF for ${testData.serialNumber}:`, error);
      }

      setProgress(Math.round(((i + 1) / excelData.length) * 85));
      
      // Small delay between PDFs
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    // Download based on selected mode and format
    // eslint-disable-next-line no-unused-vars
    let downloadSuccess = false;
    if (pdfDataArray.length > 0) {
      if (format === 'word') {
        // Word format generation
        try {
          setProgress(87);
          const { Document, Packer, Paragraph, TextRun, AlignmentType } = await import('docx');
          const { saveAs } = await import('file-saver');
          
          if (downloadMode === 'split') {
            // Generate individual Word files
            for (let i = 0; i < pdfDataArray.length; i++) {
              const item = pdfDataArray[i];
              const td = item.testData;
              
              const doc = new Document({
                sections: [{
                  children: [
                    new Paragraph({ children: [new TextRun({ text: 'Production Testing Report', bold: true, size: 32 })], alignment: AlignmentType.CENTER }),
                    new Paragraph({ children: [new TextRun({ text: `Producer: ${td.producer}`, size: 24 })] }),
                    new Paragraph({ children: [new TextRun({ text: `Module Type: ${td.moduleType}`, size: 24 })] }),
                    new Paragraph({ children: [new TextRun({ text: `S/N: ${td.serialNumber}`, size: 24 })] }),
                    new Paragraph({ children: [new TextRun({ text: '', size: 24 })] }),
                    new Paragraph({ children: [new TextRun({ text: 'Test Conditions', bold: true, size: 28 })] }),
                    new Paragraph({ children: [new TextRun({ text: `Date: ${td.testDate}`, size: 24 })] }),
                    new Paragraph({ children: [new TextRun({ text: `Time: ${td.testTime}`, size: 24 })] }),
                    new Paragraph({ children: [new TextRun({ text: `Irradiance: ${td.irradiance?.toFixed(2) || 1000} W/m²`, size: 24 })] }),
                    new Paragraph({ children: [new TextRun({ text: `Module Temp: ${td.moduleTemp?.toFixed(2) || 25} °C`, size: 24 })] }),
                    new Paragraph({ children: [new TextRun({ text: `Ambient Temp: ${td.ambientTemp?.toFixed(2) || 25} °C`, size: 24 })] }),
                    new Paragraph({ children: [new TextRun({ text: '', size: 24 })] }),
                    new Paragraph({ children: [new TextRun({ text: 'Test Results', bold: true, size: 28 })] }),
                    new Paragraph({ children: [new TextRun({ text: `Pmax: ${td.results.pmax?.toFixed(2) || 0} W`, size: 24 })] }),
                    new Paragraph({ children: [new TextRun({ text: `Vpm: ${td.results.vpm?.toFixed(2) || 0} V`, size: 24 })] }),
                    new Paragraph({ children: [new TextRun({ text: `Ipm: ${td.results.ipm?.toFixed(2) || 0} A`, size: 24 })] }),
                    new Paragraph({ children: [new TextRun({ text: `Voc: ${td.results.voc?.toFixed(2) || 0} V`, size: 24 })] }),
                    new Paragraph({ children: [new TextRun({ text: `Isc: ${td.results.isc?.toFixed(2) || 0} A`, size: 24 })] }),
                    new Paragraph({ children: [new TextRun({ text: `Fill Factor: ${td.results.fillFactor?.toFixed(2) || 0} %`, size: 24 })] }),
                    new Paragraph({ children: [new TextRun({ text: `Rs: ${td.results.rs?.toFixed(2) || 0} Ω`, size: 24 })] }),
                    new Paragraph({ children: [new TextRun({ text: `Rsh: ${td.results.rsh?.toFixed(2) || 0} Ω`, size: 24 })] }),
                    new Paragraph({ children: [new TextRun({ text: `Efficiency: ${td.results.efficiency?.toFixed(2) || 0} %`, size: 24 })] }),
                    new Paragraph({ children: [new TextRun({ text: '', size: 24 })] }),
                    new Paragraph({ children: [new TextRun({ text: `Module Area: ${td.moduleArea || 2.7} m²`, size: 24 })] }),
                  ]
                }]
              });
              
              const blob = await Packer.toBlob(doc);
              saveAs(blob, `FTR_${item.serialNumber.replace(/\//g, '_')}.docx`);
              setProgress(87 + Math.round(((i + 1) / pdfDataArray.length) * 10));
              await new Promise(r => setTimeout(r, 300));
            }
            downloadSuccess = true;
          } else {
            // Merged Word document
            const sections = pdfDataArray.map((item, idx) => {
              const td = item.testData;
              return {
                children: [
                  new Paragraph({ children: [new TextRun({ text: `Report ${idx + 1} of ${pdfDataArray.length}`, bold: true, size: 20, color: '666666' })], alignment: AlignmentType.RIGHT }),
                  new Paragraph({ children: [new TextRun({ text: 'Production Testing Report', bold: true, size: 32 })], alignment: AlignmentType.CENTER }),
                  new Paragraph({ children: [new TextRun({ text: `Producer: ${td.producer}`, size: 24 })] }),
                  new Paragraph({ children: [new TextRun({ text: `Module Type: ${td.moduleType}`, size: 24 })] }),
                  new Paragraph({ children: [new TextRun({ text: `S/N: ${td.serialNumber}`, size: 24 })] }),
                  new Paragraph({ children: [new TextRun({ text: '', size: 24 })] }),
                  new Paragraph({ children: [new TextRun({ text: 'Test Conditions', bold: true, size: 28 })] }),
                  new Paragraph({ children: [new TextRun({ text: `Date: ${td.testDate}  |  Time: ${td.testTime}`, size: 24 })] }),
                  new Paragraph({ children: [new TextRun({ text: `Irradiance: ${td.irradiance?.toFixed(2) || 1000} W/m²  |  Module Temp: ${td.moduleTemp?.toFixed(2) || 25} °C`, size: 24 })] }),
                  new Paragraph({ children: [new TextRun({ text: '', size: 24 })] }),
                  new Paragraph({ children: [new TextRun({ text: 'Test Results', bold: true, size: 28 })] }),
                  new Paragraph({ children: [new TextRun({ text: `Pmax: ${td.results.pmax?.toFixed(2) || 0} W  |  Vpm: ${td.results.vpm?.toFixed(2) || 0} V  |  Ipm: ${td.results.ipm?.toFixed(2) || 0} A`, size: 24 })] }),
                  new Paragraph({ children: [new TextRun({ text: `Voc: ${td.results.voc?.toFixed(2) || 0} V  |  Isc: ${td.results.isc?.toFixed(2) || 0} A  |  FF: ${td.results.fillFactor?.toFixed(2) || 0} %`, size: 24 })] }),
                  new Paragraph({ children: [new TextRun({ text: `Rs: ${td.results.rs?.toFixed(2) || 0} Ω  |  Rsh: ${td.results.rsh?.toFixed(2) || 0} Ω  |  Eff: ${td.results.efficiency?.toFixed(2) || 0} %`, size: 24 })] }),
                  new Paragraph({ children: [new TextRun({ text: `Module Area: ${td.moduleArea || 2.7} m²`, size: 24 })] }),
                  new Paragraph({ children: [new TextRun({ text: '─'.repeat(50), size: 24, color: '999999' })], alignment: AlignmentType.CENTER }),
                ],
                properties: idx < pdfDataArray.length - 1 ? { page: { pageBreak: true } } : {}
              };
            });
            
            const doc = new Document({ sections });
            const blob = await Packer.toBlob(doc);
            saveAs(blob, `FTR_Reports_Merged_${new Date().toISOString().split('T')[0]}_${pdfDataArray.length}files.docx`);
            downloadSuccess = true;
          }
          setProgress(98);
        } catch (wordError) {
          console.error('Word generation error:', wordError);
          alert('⚠️ Word generation failed: ' + wordError.message);
        }
      } else {
        // PDF format (existing code)
        if (downloadMode === 'split') {
          // Split mode: download each PDF individually
          setProgress(87);
          for (let i = 0; i < pdfDataArray.length; i++) {
            const item = pdfDataArray[i];
            const url = window.URL.createObjectURL(item.blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `FTR_${item.serialNumber.replace(/\//g, '_')}.pdf`;
            link.style.display = 'none';
            document.body.appendChild(link);
            link.click();
            
            setTimeout(() => {
              document.body.removeChild(link);
              window.URL.revokeObjectURL(url);
            }, 500);
            
            setProgress(87 + Math.round(((i + 1) / pdfDataArray.length) * 10));
            await new Promise(r => setTimeout(r, 400));
          }
          downloadSuccess = true;
        } else {
          // Merged mode: merge all PDFs into single file
          try {
            setProgress(87);
            const { PDFDocument } = await import('pdf-lib');
            const mergedPdf = await PDFDocument.create();

            for (let i = 0; i < pdfDataArray.length; i++) {
              const item = pdfDataArray[i];
              const arrayBuffer = await item.blob.arrayBuffer();
              const donor = await PDFDocument.load(arrayBuffer);
              const copied = await mergedPdf.copyPages(donor, donor.getPageIndices());
              copied.forEach((p) => mergedPdf.addPage(p));
              setProgress(87 + Math.round(((i + 1) / pdfDataArray.length) * 10));
              await new Promise(r => setTimeout(r, 30));
            }

            const mergedBytes = await mergedPdf.save();
            const mergedBlob = new Blob([mergedBytes], { type: 'application/pdf' });

            const url = window.URL.createObjectURL(mergedBlob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `FTR_Reports_Merged_${new Date().toISOString().split('T')[0]}_${pdfDataArray.length}files.pdf`;
            a.style.display = 'none';
            document.body.appendChild(a);
            a.click();
            
            setTimeout(() => {
              document.body.removeChild(a);
              window.URL.revokeObjectURL(url);
            }, 1000);
            
            downloadSuccess = true;
          } catch (mergeError) {
            console.error('Error merging PDFs:', mergeError);
            alert('⚠️ PDF merge failed: ' + mergeError.message + '\nDownloading individual PDFs instead...');
            
            // Fallback: download each PDF individually
            for (const item of pdfDataArray) {
              const url = window.URL.createObjectURL(item.blob);
              const link = document.createElement('a');
              link.href = url;
              link.download = `FTR_${item.serialNumber.replace(/\//g, '_')}.pdf`;
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
              window.URL.revokeObjectURL(url);
              await new Promise(r => setTimeout(r, 300));
            }
            downloadSuccess = true;
          }
        }
        setProgress(98);
      }
    }

    // Upload all PDFs to backend
    try {
      const uploadResult = await uploadPDFsToBackend(pdfDataArray);
      setIsGenerating(false);
      setProgress(100);
      const formatText = format === 'word' ? 'Word' : 'PDF';
      const modeText = downloadMode === 'merged' ? `merged ${formatText}` : `${pdfDataArray.length} individual ${formatText} files`;
      alert(`✅ ${uploadResult.files.length} FTR reports generated!\n📥 Downloaded: ${modeText}`);
    } catch (error) {
      setIsGenerating(false);
      setProgress(100);
      const formatText = format === 'word' ? 'Word' : 'PDF';
      const modeText = downloadMode === 'merged' ? `merged ${formatText}` : `${pdfDataArray.length} individual ${formatText} files`;
      alert(`✅ ${pdfDataArray.length} FTR reports generated!\n📥 Downloaded: ${modeText}\n\n⚠️ Upload to server failed: ${error.message}`);
    }
  };

  // Delete a record
  const deleteRecord = (index) => {
    if (window.confirm('Delete this record?')) {
      const newData = excelData.filter((_, i) => i !== index);
      setExcelData(newData);
    }
  };

  // Start editing a record
  const startEdit = (index) => {
    setEditingIndex(index);
    setEditForm({...excelData[index]});
  };

  // Save edited record
  const saveEdit = () => {
    const newData = [...excelData];
    newData[editingIndex] = editForm;
    setExcelData(newData);
    setEditingIndex(null);
    setEditForm({});
  };

  // Cancel editing
  const cancelEdit = () => {
    setEditingIndex(null);
    setEditForm({});
  };

  // Clear all data
  const clearAllData = () => {
    if (window.confirm('Clear all uploaded data?')) {
      setExcelData([]);
    }
  };

  return (
    <div className="pdi-ftr-generator">
      <h2>📄 FTR Bulk Report Generator</h2>
      
      {/* Mode Selection */}
      <div className="mode-selection">
        <label className="mode-option">
          <input 
            type="radio" 
            value="simple" 
            checked={mode === 'simple'}
            onChange={(e) => setMode(e.target.value)}
          />
          <div className="mode-details">
            <strong>Simple Mode</strong>
            <small>Only Serial Number & Power needed (auto-generate test data)</small>
          </div>
        </label>
        
        <label className="mode-option">
          <input 
            type="radio" 
            value="full" 
            checked={mode === 'full'}
            onChange={(e) => setMode(e.target.value)}
          />
          <div className="mode-details">
            <strong>Full Mode</strong>
            <small>Complete test data from Excel</small>
          </div>
        </label>
      </div>

      {/* Upload Section */}
      <div className="upload-section">
        <div className="upload-box" style={{gridColumn: '1 / -1'}}>
          <h3>Upload Excel Data</h3>
          {mode === 'simple' ? (
            <p><strong>Required columns:</strong> SerialNumber, Power (e.g., 630W or just 630)</p>
          ) : (
            <p><strong>Required columns:</strong> Producer, ModuleType, SerialNumber, Date, Time, Irradiance, ModuleTemp, AmbientTemp, ModuleArea, Pmax, Vpm, Ipm, Voc, Isc, FillFactor, Rs, Rsh, Efficiency</p>
          )}
          <p style={{fontSize: '13px', color: '#1e3a8a', fontWeight: '600', marginTop: '8px'}}>📊 Graphs will be automatically loaded from Graph Manager</p>
          <input 
            type="file" 
            accept=".xlsx,.xls" 
            onChange={handleExcelUpload}
            className="file-input"
          />
          {excelData.length > 0 && (
            <div className="success-msg">✓ {excelData.length} records loaded</div>
          )}
        </div>
      </div>

      {/* Data Table with CRUD */}
      {excelData.length > 0 && (
        <div className="data-table-section">
          <div className="table-header">
            <h3>📋 Uploaded Records ({excelData.length})</h3>
            {isSuperAdmin() && (
              <button onClick={clearAllData} className="btn-clear" title="Clear all data">
                🗑️ Clear All
              </button>
            )}
          </div>
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Serial Number</th>
                  {mode === 'full' && (
                    <>
                      <th>Module Type</th>
                      <th>Producer</th>
                      <th>Pmax (W)</th>
                      <th>Voc (V)</th>
                      <th>Isc (A)</th>
                      <th>Date</th>
                    </>
                  )}
                  {mode === 'simple' && (
                    <>
                      <th>Power</th>
                    </>
                  )}
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {excelData.map((row, index) => (
                  <tr key={index}>
                    {editingIndex === index ? (
                      <>
                        <td>{index + 1}</td>
                        <td>
                          <input 
                            value={editForm.SerialNumber || editForm['Serial Number'] || editForm.SN || ''}
                            onChange={(e) => setEditForm({...editForm, SerialNumber: e.target.value})}
                            style={{width: '100%', padding: '4px'}}
                          />
                        </td>
                        {mode === 'full' ? (
                          <>
                            <td>
                              <input 
                                value={editForm.ModuleType || editForm['Module Type'] || ''}
                                onChange={(e) => setEditForm({...editForm, ModuleType: e.target.value})}
                                style={{width: '100%', padding: '4px'}}
                              />
                            </td>
                            <td>
                              <input 
                                value={editForm.Producer || ''}
                                onChange={(e) => setEditForm({...editForm, Producer: e.target.value})}
                                style={{width: '100%', padding: '4px'}}
                              />
                            </td>
                            <td>
                              <input 
                                type="number"
                                value={editForm.Pmax || ''}
                                onChange={(e) => setEditForm({...editForm, Pmax: e.target.value})}
                                style={{width: '80px', padding: '4px'}}
                              />
                            </td>
                            <td>
                              <input 
                                type="number"
                                value={editForm.Voc || ''}
                                onChange={(e) => setEditForm({...editForm, Voc: e.target.value})}
                                style={{width: '70px', padding: '4px'}}
                              />
                            </td>
                            <td>
                              <input 
                                type="number"
                                value={editForm.Isc || ''}
                                onChange={(e) => setEditForm({...editForm, Isc: e.target.value})}
                                style={{width: '70px', padding: '4px'}}
                              />
                            </td>
                            <td>
                              <input 
                                type="date"
                                value={editForm.Date || ''}
                                onChange={(e) => setEditForm({...editForm, Date: e.target.value})}
                                style={{width: '120px', padding: '4px'}}
                              />
                            </td>
                          </>
                        ) : (
                          <td>
                            <input 
                              value={editForm.Power || editForm.ModuleType || ''}
                              onChange={(e) => setEditForm({...editForm, Power: e.target.value})}
                              style={{width: '100px', padding: '4px'}}
                            />
                          </td>
                        )}
                        <td>
                          <button onClick={saveEdit} className="btn-save" title="Save">✓</button>
                          <button onClick={cancelEdit} className="btn-cancel" title="Cancel">✕</button>
                        </td>
                      </>
                    ) : (
                      <>
                        <td>{index + 1}</td>
                        <td>{row.SerialNumber || row['Serial Number'] || row.SN || '-'}</td>
                        {mode === 'full' ? (
                          <>
                            <td>{row.ModuleType || row['Module Type'] || '-'}</td>
                            <td>{row.Producer || '-'}</td>
                            <td>{row.Pmax || '-'}</td>
                            <td>{row.Voc || '-'}</td>
                            <td>{row.Isc || '-'}</td>
                            <td>{row.Date || '-'}</td>
                          </>
                        ) : (
                          <td>{row.Power || row.ModuleType || '-'}</td>
                        )}
                        <td>
                          <button onClick={() => startEdit(index)} className="btn-edit" title="Edit">✏️</button>
                          {isSuperAdmin() && (
                            <button onClick={() => deleteRecord(index)} className="btn-delete" title="Delete">🗑️</button>
                          )}
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Generate Button */}
      <div className="generate-section">
        {/* Format Selection - PDF or Word */}
        <div style={{ marginBottom: '15px', display: 'flex', gap: '20px', justifyContent: 'center', flexWrap: 'wrap' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', padding: '10px 15px', border: downloadFormat === 'pdf' ? '2px solid #4CAF50' : '2px solid #ddd', borderRadius: '8px', backgroundColor: downloadFormat === 'pdf' ? '#E8F5E9' : '#fff' }}>
            <input 
              type="radio" 
              name="pdiDownloadFormat" 
              value="pdf" 
              checked={downloadFormat === 'pdf'}
              onChange={(e) => setDownloadFormat(e.target.value)}
            />
            <span style={{ fontWeight: '600' }}>📄 PDF Format</span>
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', padding: '10px 15px', border: downloadFormat === 'word' ? '2px solid #4CAF50' : '2px solid #ddd', borderRadius: '8px', backgroundColor: downloadFormat === 'word' ? '#E8F5E9' : '#fff' }}>
            <input 
              type="radio" 
              name="pdiDownloadFormat" 
              value="word" 
              checked={downloadFormat === 'word'}
              onChange={(e) => setDownloadFormat(e.target.value)}
            />
            <span style={{ fontWeight: '600' }}>📝 Word Format</span>
          </label>
        </div>

        {/* Module Type Selection - Monofacial or Bifacial */}
        <div style={{ marginBottom: '15px', display: 'flex', gap: '20px', justifyContent: 'center', flexWrap: 'wrap' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', padding: '10px 15px', border: moduleType === 'monofacial' ? '2px solid #FF9800' : '2px solid #ddd', borderRadius: '8px', backgroundColor: moduleType === 'monofacial' ? '#FFF3E0' : '#fff' }}>
            <input 
              type="radio" 
              name="pdiModuleType" 
              value="monofacial" 
              checked={moduleType === 'monofacial'}
              onChange={(e) => setModuleType(e.target.value)}
            />
            <span style={{ fontWeight: '600' }}>☀️ Monofacial</span>
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', padding: '10px 15px', border: moduleType === 'bifacial' ? '2px solid #FF9800' : '2px solid #ddd', borderRadius: '8px', backgroundColor: moduleType === 'bifacial' ? '#FFF3E0' : '#fff' }}>
            <input 
              type="radio" 
              name="pdiModuleType" 
              value="bifacial" 
              checked={moduleType === 'bifacial'}
              onChange={(e) => setModuleType(e.target.value)}
            />
            <span style={{ fontWeight: '600' }}>🔆 Bifacial</span>
          </label>
        </div>

        {/* Download Type Selection */}
        <div style={{ marginBottom: '15px', display: 'flex', gap: '20px', justifyContent: 'center', flexWrap: 'wrap' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', padding: '10px 15px', border: downloadType === 'merged' ? '2px solid #1565C0' : '2px solid #ddd', borderRadius: '8px', backgroundColor: downloadType === 'merged' ? '#E3F2FD' : '#fff' }}>
            <input 
              type="radio" 
              name="pdiDownloadType" 
              value="merged" 
              checked={downloadType === 'merged'}
              onChange={(e) => setDownloadType(e.target.value)}
            />
            <span style={{ fontWeight: '600' }}>📄 Merged</span>
            <small style={{ color: '#666' }}>(Single file)</small>
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', padding: '10px 15px', border: downloadType === 'split' ? '2px solid #1565C0' : '2px solid #ddd', borderRadius: '8px', backgroundColor: downloadType === 'split' ? '#E3F2FD' : '#fff' }}>
            <input 
              type="radio" 
              name="pdiDownloadType" 
              value="split" 
              checked={downloadType === 'split'}
              onChange={(e) => setDownloadType(e.target.value)}
            />
            <span style={{ fontWeight: '600' }}>📑 Split</span>
            <small style={{ color: '#666' }}>(Individual files)</small>
          </label>
        </div>
        
        <button 
          onClick={() => generateAllReports(downloadType, downloadFormat, moduleType)}
          disabled={isGenerating || excelData.length === 0}
          className="generate-btn"
        >
          {isGenerating ? `Generating ${Math.round(progress)}%...` : `Generate ${excelData.length} Reports (${downloadFormat.toUpperCase()} - ${downloadType === 'merged' ? 'Merged' : 'Split'} - ${moduleType})`}
        </button>
      </div>

      {/* Progress Bar */}
      {isGenerating && (
        <div className="progress-bar">
          <div className="progress-fill" style={{ width: `${progress}%` }}>
            {Math.round(progress)}%
          </div>
        </div>
      )}
    </div>
  );
};

export default PDIFTRGenerator;

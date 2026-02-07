import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import html2pdf from 'html2pdf.js';
import axios from 'axios';
import FTRTemplate from './FTRTemplate';
import { getStoredGraphs, getRandomGraphForPower } from './GraphManager';
import '../styles/BulkFTR.css';

const BulkFTRGenerator = () => {
  const [excelData, setExcelData] = useState([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [editingIndex, setEditingIndex] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [downloadType, setDownloadType] = useState('merged'); // 'merged' or 'split'
  const [downloadFormat, setDownloadFormat] = useState('pdf'); // 'pdf' or 'word'
  const [moduleType, setModuleType] = useState('monofacial'); // 'monofacial' or 'bifacial'
  const [defaultDate, setDefaultDate] = useState(new Date().toISOString().split('T')[0]); // Default date for Excel without date
  const [defaultTime, setDefaultTime] = useState(new Date().toLocaleTimeString('en-GB', { hour12: false })); // Default time for Excel without time

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
      
      // Helper function to get value by flexible column name matching
      const getValue = (row, ...possibleNames) => {
        for (const name of possibleNames) {
          // Try exact match
          if (row[name] !== undefined && row[name] !== null && row[name] !== '') {
            return row[name];
          }
          // Try case-insensitive match
          const lowerName = name.toLowerCase();
          for (const key of Object.keys(row)) {
            if (key.toLowerCase() === lowerName || key.toLowerCase().replace(/[_\s]/g, '') === lowerName.replace(/[_\s]/g, '')) {
              if (row[key] !== undefined && row[key] !== null && row[key] !== '') {
                return row[key];
              }
            }
          }
        }
        return null;
      };
      
      // Normalize data - map various column names to standard names
      // Ask user for module area to apply when Excel doesn't contain it
      const moduleAreaInput = prompt('Enter Module Area in m² for these records (e.g., 2.7). Leave blank to use values from Excel if present:', '2.7');
      const defaultModuleArea = moduleAreaInput !== null && moduleAreaInput !== '' ? parseFloat(moduleAreaInput) : null;

      const normalizedData = data.map((row, idx) => {
        // Debug: log first row column names
        if (idx === 0) {
          console.log('Excel columns found:', Object.keys(row));
          console.log('First row data:', row);
        }
        
        // Handle date and time - can be combined or separate
        let dateVal = getValue(row, 'Date', 'date') || '';
        let timeVal = getValue(row, 'Time', 'time') || '';
        
        if (typeof dateVal === 'number' && dateVal > 40000) {
          // Excel Julian date (may include time as decimal)
          const excelEpoch = new Date(1899, 11, 30);
          const date = new Date(excelEpoch.getTime() + dateVal * 86400000);
          dateVal = date.toISOString().split('T')[0];
          // Extract time if it was part of the decimal
          if (!timeVal) {
            timeVal = date.toTimeString().split(' ')[0]; // HH:MM:SS
          }
        } else if (typeof dateVal === 'string' && dateVal.includes(' ')) {
          // Date string with time like "1/28/2026 17:05"
          const parts = dateVal.split(' ');
          const datePart = parts[0];
          const timePart = parts[1] || '';
          
          // Parse date part (could be M/D/YYYY or YYYY-MM-DD)
          if (datePart.includes('/')) {
            const [m, d, y] = datePart.split('/');
            dateVal = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
          } else {
            dateVal = datePart;
          }
          
          // Use time from date string if not provided separately
          if (!timeVal && timePart) {
            timeVal = timePart.includes(':') ? timePart : timePart + ':00';
            // Ensure HH:MM:SS format
            if (timeVal.split(':').length === 2) {
              timeVal = timeVal + ':00';
            }
          }
        }
        
        // Default time if still empty - use user input
        if (!timeVal) {
          timeVal = defaultTime || new Date().toLocaleTimeString('en-GB', { hour12: false });
        }
        
        // Default date if still empty - use user input
        if (!dateVal) {
          dateVal = defaultDate || new Date().toISOString().split('T')[0];
        }
        
        return {
          // Serial Number - try multiple column names
          SerialNumber: getValue(row, 'ID', 'Id', 'id', 'SerialNumber', 'Serial Number', 'serial_number', 'Barcode', 'barcode') || '',
          // Module Type
          ModuleType: getValue(row, 'ModuleType', 'Module Type', 'module_type', 'Type', 'type') || '',
          // Producer
          Producer: getValue(row, 'Producer', 'producer', 'Manufacturer') || 'Gautam Solar',
          // Test values
          Pmax: parseFloat(getValue(row, 'Pmax', 'pmax', 'PMAX') || 0),
          Voc: parseFloat(getValue(row, 'Voc', 'voc', 'VOC') || 0),
          Isc: parseFloat(getValue(row, 'Isc', 'isc', 'ISC') || 0),
          Vpm: parseFloat(getValue(row, 'Vpm', 'vpm', 'VPM') || 0),
          Ipm: parseFloat(getValue(row, 'Ipm', 'ipm', 'IPM') || 0),
          FF: parseFloat(getValue(row, 'FF', 'ff', 'FillFactor', 'Fill_Factor') || 0),
          Rs: parseFloat(getValue(row, 'Rs', 'rs', 'RS') || 0),
          Rsh: parseFloat(getValue(row, 'Rsh', 'rsh', 'RSH') || 0),
          Eff: parseFloat(getValue(row, 'Eff', 'eff', 'Efficiency', 'EFF') || 0),
          // Temperature
          ModuleTemp: parseFloat(getValue(row, 'T_Object', 't_object', 'ModuleTemp', 'Cel_T', 'Module_Temp') || 25),
          AmbientTemp: parseFloat(getValue(row, 'T_Ambient', 't_ambient', 'AmbientTemp', 'Ambient', 'Ambient_Temp') || 25),
          // Irradiance - check all possible column names
          Irradiance: parseFloat(getValue(row, 'Irradiance', 'irradiance', 'Irr_Target', 'irr_target', 'IRR', 'Irr', 'IrrTarget') || 1000),
          // Module Area (m2) - prefer Excel value, otherwise use prompt default or 2.7
          ModuleArea: (() => {
            const ma = getValue(row, 'ModuleArea', 'Module Area', 'Module_Area', 'Area');
            if (ma !== null && ma !== '') {
              const parsed = parseFloat(ma);
              return isNaN(parsed) ? (defaultModuleArea !== null ? defaultModuleArea : 2.7) : parsed;
            }
            return defaultModuleArea !== null ? defaultModuleArea : 2.7;
          })(),
          // Date and Time
          Date: dateVal,
          Time: timeVal,
          // Class
          Class: getValue(row, 'Class', 'class', 'Irr_Target_Class') || ''
        };
      });
      
      setExcelData(normalizedData);
      alert(`${normalizedData.length} records loaded from Excel!`);
    };
    reader.readAsBinaryString(file);
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
            
            // Timeout fallback after 800ms (optimized from 3s)
            setTimeout(resolve, 800);
          });
        };
        
        // Wait for component render + images (reduced from 500ms)
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
              logging: false,
              imageTimeout: 800
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
        }, 100);
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

    // Filter available keys by module type if specified
    const graphKeys = Object.keys(storedGraphs);
    // Extract unique wattages (handle both "630" and "630_bifacial" formats)
    const availableWattages = [...new Set(graphKeys.map(key => key.split('_')[0]))].sort((a, b) => parseInt(a) - parseInt(b));
    
    // Ask user which wattage to use for bulk generation
    const wattagePrompt = `Available wattages with graphs:\n${availableWattages.join('W, ')}W\n\nEnter the wattage (WP) for these modules:`;
    const selectedWattage = prompt(wattagePrompt, availableWattages[0]);
    
    if (!selectedWattage) {
      return; // User cancelled
    }
    
    // Check if graphs exist for selected wattage (with or without module type)
    const graphKey = `${selectedWattage}_${modType}`;
    const hasGraphs = storedGraphs[graphKey] || storedGraphs[selectedWattage];
    if (!hasGraphs) {
      alert(`No graphs found for ${selectedWattage}W (${modType})! Please upload graphs first.`);
      return;
    }

    setIsGenerating(true);
    setProgress(0);

    const pdfDataArray = [];
    
    // Process reports in batches of 5 for faster generation
    const BATCH_SIZE = 5;
    const totalBatches = Math.ceil(excelData.length / BATCH_SIZE);

    for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
      const batchStart = batchIndex * BATCH_SIZE;
      const batchEnd = Math.min(batchStart + BATCH_SIZE, excelData.length);
      const batchRows = excelData.slice(batchStart, batchEnd);
      
      // Process batch in parallel
      const batchPromises = batchRows.map(async (row, indexInBatch) => {
        const i = batchStart + indexInBatch;
      
      // Map Excel data to testData format (data is already normalized)
      const testData = {
        producer: row.Producer || 'Gautam Solar',
        moduleType: `${selectedWattage}W`, // Use selected wattage
        serialNumber: row.SerialNumber || '',
        testDate: row.Date || new Date().toLocaleDateString('en-CA'),
        testTime: row.Time || new Date().toLocaleTimeString('en-GB', { hour12: false }),
        irradiance: row.Irradiance || 1000,
        moduleTemp: row.ModuleTemp || 25,
        ambientTemp: row.AmbientTemp || 23,
        moduleArea: row.ModuleArea || 2.7,
        results: {
          pmax: row.Pmax || 0,
          vpm: row.Vpm || 0,
          ipm: row.Ipm || 0,
          voc: row.Voc || 0,
          isc: row.Isc || 0,
          fillFactor: row.FF || 0,
          rs: row.Rs || 0,
          rsh: row.Rsh || 0,
          efficiency: row.Eff || 0
        }
      };

        // Get random graph for selected wattage and module type (already returns base64)
        const graphImage = await getRandomGraphForPower(selectedWattage, modType);
        
        if (!graphImage) {
          console.warn(`Warning: Could not load graph image for ${testData.serialNumber}`);
        }

        try {
          // Generate PDF blob (for both PDF and Word we generate PDF first, Word will be created later)
          const blob = await generateSinglePDFBlob(testData, graphImage);
          return {
            blob: blob,
            serialNumber: testData.serialNumber,
            moduleType: testData.moduleType,
            pmax: testData.results.pmax,
            testData: testData, // Keep testData for Word generation
            graphImage: graphImage // Keep graph for Word generation
          };
        } catch (error) {
          console.error(`Error generating PDF for ${testData.serialNumber}:`, error);
          return null;
        }
      });
      
      // Wait for batch to complete
      const batchResults = await Promise.all(batchPromises);
      
      // Add successful results to array
      batchResults.forEach(result => {
        if (result) pdfDataArray.push(result);
      });
      
      // Update progress
      setProgress((batchEnd / excelData.length) * 85);
      
      // Small delay between batches to prevent browser freeze (reduced from 500ms)
      await new Promise(resolve => setTimeout(resolve, 50));
    }

    // Download based on selected mode and format
    // eslint-disable-next-line no-unused-vars
    let downloadSuccess = false;
    if (pdfDataArray.length > 0) {
      if (format === 'word') {
        // Word format generation
        try {
          setProgress(87);
          // eslint-disable-next-line no-unused-vars
          const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, AlignmentType, BorderStyle, ImageRun } = await import('docx');
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
              await new Promise(r => setTimeout(r, 50));
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
      const formatText = format === 'word' ? 'Word' : 'PDF';
      const modeText = downloadMode === 'merged' ? `merged ${formatText}` : `${pdfDataArray.length} individual ${formatText} files`;
      alert(`✅ ${uploadResult.files.length} FTR reports generated!\n📥 Downloaded: ${modeText}`);
    } catch (error) {
      setIsGenerating(false);
      const formatText = format === 'word' ? 'Word' : 'PDF';
      const modeText = downloadMode === 'merged' ? `merged ${formatText}` : `${pdfDataArray.length} individual ${formatText} files`;
      alert(`✅ ${pdfDataArray.length} FTR reports generated!\n📥 Downloaded: ${modeText}\n\n⚠️ Upload to server failed: ${error.message}`);
    }
  };

  // Download all PDFs as a ZIP file
  const downloadAllAsZip = async (pdfDataArray) => {
    try {
      // Dynamically import JSZip
      const JSZip = (await import('jszip')).default;
      const zip = new JSZip();
      
      // Add all PDFs to ZIP
      pdfDataArray.forEach((item, index) => {
        const filename = `FTR_${item.serialNumber.replace(/\//g, '_')}.pdf`;
        zip.file(filename, item.blob);
      });
      
      // Generate ZIP file
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      
      // Download ZIP
      const url = window.URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `FTR_Reports_${new Date().toISOString().split('T')[0]}_${pdfDataArray.length}files.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error creating ZIP:', error);
      alert('Failed to create ZIP file: ' + error.message);
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
    <div className="bulk-ftr-container">
      <h2>Bulk FTR Report Generator</h2>
      
      <div className="upload-section">
        <div className="upload-box" style={{gridColumn: '1 / -1'}}>
          <h3>Upload Excel Data</h3>
          <p>Excel should have columns: Producer, ModuleType, SerialNumber, Date, Time, Irradiance, ModuleTemp, AmbientTemp, ModuleArea, Pmax, Vpm, Ipm, Voc, Isc, FillFactor, Rs, Rsh, Efficiency</p>
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
                  <th>Module Type</th>
                  <th>Producer</th>
                  <th>Pmax (W)</th>
                  <th>Voc (V)</th>
                  <th>Isc (A)</th>
                  <th>Date</th>
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
                            value={editForm.SerialNumber || editForm['Serial Number'] || ''}
                            onChange={(e) => setEditForm({...editForm, SerialNumber: e.target.value})}
                            style={{width: '100%', padding: '4px'}}
                          />
                        </td>
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
                        <td>
                          <button onClick={saveEdit} className="btn-save" title="Save">✓</button>
                          <button onClick={cancelEdit} className="btn-cancel" title="Cancel">✕</button>
                        </td>
                      </>
                    ) : (
                      <>
                        <td>{index + 1}</td>
                        <td>{row.SerialNumber || row['Serial Number'] || '-'}</td>
                        <td>{row.ModuleType || row['Module Type'] || '-'}</td>
                        <td>{row.Producer || '-'}</td>
                        <td>{row.Pmax || '-'}</td>
                        <td>{row.Voc || '-'}</td>
                        <td>{row.Isc || '-'}</td>
                        <td>{row.Date || '-'}</td>
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

      <div className="generate-section">
        {/* Module Type Selection */}
        <div style={{ marginBottom: '15px' }}>
          <label style={{ fontSize: '14px', fontWeight: '600', color: '#1e3a8a', display: 'block', marginBottom: '10px' }}>Module Type:</label>
          <div style={{ display: 'flex', gap: '15px', justifyContent: 'center' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', padding: '8px 15px', border: moduleType === 'monofacial' ? '2px solid #4CAF50' : '2px solid #ddd', borderRadius: '8px', backgroundColor: moduleType === 'monofacial' ? '#E8F5E9' : '#fff' }}>
              <input type="radio" name="moduleType" value="monofacial" checked={moduleType === 'monofacial'} onChange={(e) => setModuleType(e.target.value)} />
              <span style={{ fontWeight: '600' }}>◻️ Monofacial</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', padding: '8px 15px', border: moduleType === 'bifacial' ? '2px solid #4CAF50' : '2px solid #ddd', borderRadius: '8px', backgroundColor: moduleType === 'bifacial' ? '#E8F5E9' : '#fff' }}>
              <input type="radio" name="moduleType" value="bifacial" checked={moduleType === 'bifacial'} onChange={(e) => setModuleType(e.target.value)} />
              <span style={{ fontWeight: '600' }}>🔄 Bifacial</span>
            </label>
          </div>
        </div>

        {/* Default Date & Time (used when Excel doesn't have date/time) */}
        <div style={{ marginBottom: '15px' }}>
          <label style={{ fontSize: '14px', fontWeight: '600', color: '#1e3a8a', display: 'block', marginBottom: '10px' }}>Default Date & Time (if not in Excel):</label>
          <div style={{ display: 'flex', gap: '15px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 15px', border: '2px solid #9C27B0', borderRadius: '8px', backgroundColor: '#F3E5F5' }}>
              <span style={{ fontWeight: '600' }}>📅 Date:</span>
              <input 
                type="date" 
                value={defaultDate} 
                onChange={(e) => setDefaultDate(e.target.value)} 
                style={{ padding: '6px 10px', border: '1px solid #ccc', borderRadius: '4px', fontSize: '14px' }}
              />
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 15px', border: '2px solid #9C27B0', borderRadius: '8px', backgroundColor: '#F3E5F5' }}>
              <span style={{ fontWeight: '600' }}>⏰ Time:</span>
              <input 
                type="time" 
                value={defaultTime.substring(0, 5)} 
                onChange={(e) => setDefaultTime(e.target.value + ':00')} 
                style={{ padding: '6px 10px', border: '1px solid #ccc', borderRadius: '4px', fontSize: '14px' }}
              />
            </label>
          </div>
          <p style={{ fontSize: '12px', color: '#666', marginTop: '5px', textAlign: 'center' }}>These values will be used when Excel file doesn't contain Date/Time columns</p>
        </div>

        {/* Download Format Selection */}
        <div style={{ marginBottom: '15px' }}>
          <label style={{ fontSize: '14px', fontWeight: '600', color: '#1e3a8a', display: 'block', marginBottom: '10px' }}>Download Format:</label>
          <div style={{ display: 'flex', gap: '15px', justifyContent: 'center' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', padding: '8px 15px', border: downloadFormat === 'pdf' ? '2px solid #E91E63' : '2px solid #ddd', borderRadius: '8px', backgroundColor: downloadFormat === 'pdf' ? '#FCE4EC' : '#fff' }}>
              <input type="radio" name="downloadFormat" value="pdf" checked={downloadFormat === 'pdf'} onChange={(e) => setDownloadFormat(e.target.value)} />
              <span style={{ fontWeight: '600' }}>📄 PDF</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', padding: '8px 15px', border: downloadFormat === 'word' ? '2px solid #E91E63' : '2px solid #ddd', borderRadius: '8px', backgroundColor: downloadFormat === 'word' ? '#FCE4EC' : '#fff' }}>
              <input type="radio" name="downloadFormat" value="word" checked={downloadFormat === 'word'} onChange={(e) => setDownloadFormat(e.target.value)} />
              <span style={{ fontWeight: '600' }}>📝 Word</span>
            </label>
          </div>
        </div>
        
        {/* Download Type Selection */}
        <div style={{ marginBottom: '15px', display: 'flex', gap: '20px', justifyContent: 'center', flexWrap: 'wrap' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', padding: '10px 15px', border: downloadType === 'merged' ? '2px solid #1565C0' : '2px solid #ddd', borderRadius: '8px', backgroundColor: downloadType === 'merged' ? '#E3F2FD' : '#fff' }}>
            <input 
              type="radio" 
              name="downloadType" 
              value="merged" 
              checked={downloadType === 'merged'}
              onChange={(e) => setDownloadType(e.target.value)}
            />
            <span style={{ fontWeight: '600' }}>📄 Merged {downloadFormat === 'pdf' ? 'PDF' : 'Word'}</span>
            <small style={{ color: '#666' }}>(Single file)</small>
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', padding: '10px 15px', border: downloadType === 'split' ? '2px solid #1565C0' : '2px solid #ddd', borderRadius: '8px', backgroundColor: downloadType === 'split' ? '#E3F2FD' : '#fff' }}>
            <input 
              type="radio" 
              name="downloadType" 
              value="split" 
              checked={downloadType === 'split'}
              onChange={(e) => setDownloadType(e.target.value)}
            />
            <span style={{ fontWeight: '600' }}>📑 Split Files</span>
            <small style={{ color: '#666' }}>(Individual files)</small>
          </label>
        </div>
        
        <button 
          onClick={() => generateAllReports(downloadType, downloadFormat, moduleType)}
          disabled={isGenerating || excelData.length === 0}
          className="generate-btn"
        >
          {isGenerating ? `Generating... ${Math.round(progress)}%` : `Generate ${downloadType === 'merged' ? 'Merged' : 'Split'} ${downloadFormat.toUpperCase()}`}
        </button>
      </div>

      {isGenerating && (
        <div className="progress-bar">
          <div className="progress-fill" style={{ width: `${progress}%` }}></div>
        </div>
      )}
    </div>
  );
};

export default BulkFTRGenerator;

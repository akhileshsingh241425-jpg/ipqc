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
        
        // Default time if still empty
        if (!timeVal) {
          timeVal = new Date().toLocaleTimeString('en-GB', { hour12: false });
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
  const generateAllReports = async () => {
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

    // Get available wattages
    const availableWattages = Object.keys(storedGraphs).sort((a, b) => parseInt(a) - parseInt(b));
    
    // Ask user which wattage to use for bulk generation
    const wattagePrompt = `Available wattages with graphs:\n${availableWattages.join('W, ')}W\n\nEnter the wattage (WP) for these modules:`;
    const selectedWattage = prompt(wattagePrompt, availableWattages[0]);
    
    if (!selectedWattage) {
      return; // User cancelled
    }
    
    // Validate selected wattage
    if (!storedGraphs[selectedWattage]) {
      alert(`No graphs found for ${selectedWattage}W! Please select from available wattages or upload graphs for ${selectedWattage}W first.`);
      return;
    }

    setIsGenerating(true);
    setProgress(0);

    const pdfDataArray = [];

    for (let i = 0; i < excelData.length; i++) {
      const row = excelData[i];
      
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

      // Get random graph for selected wattage (already returns base64)
      const graphImage = await getRandomGraphForPower(selectedWattage);
      
      if (!graphImage) {
        console.warn(`Warning: Could not load graph image for ${testData.serialNumber}`);
      }

      try {
        // Generate PDF blob
        const blob = await generateSinglePDFBlob(testData, graphImage);
        pdfDataArray.push({
          blob: blob,
          serialNumber: testData.serialNumber,
          moduleType: testData.moduleType,
          pmax: testData.results.pmax
        });
        
        // (no per-file download here) collect blob for upload/merge
        
      } catch (error) {
        console.error(`Error generating PDF for ${testData.serialNumber}:`, error);
      }

      setProgress(((i + 1) / excelData.length) * 100);
      
      // Small delay to prevent browser freeze
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    // Merge all PDFs into single file for user download (client-side)
    let mergeSuccess = false;
    if (pdfDataArray.length > 0) {
      try {
        setProgress(90);
        const { PDFDocument } = await import('pdf-lib');
        const mergedPdf = await PDFDocument.create();

        for (let i = 0; i < pdfDataArray.length; i++) {
          const item = pdfDataArray[i];
          const arrayBuffer = await item.blob.arrayBuffer();
          const donor = await PDFDocument.load(arrayBuffer);
          const copied = await mergedPdf.copyPages(donor, donor.getPageIndices());
          copied.forEach((p) => mergedPdf.addPage(p));
          // update merge progress a bit
          setProgress(90 + Math.round(((i + 1) / pdfDataArray.length) * 8));
          await new Promise(r => setTimeout(r, 50));
        }

        const mergedBytes = await mergedPdf.save();
        const mergedBlob = new Blob([mergedBytes], { type: 'application/pdf' });

        const url = window.URL.createObjectURL(mergedBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `FTR_Reports_${new Date().toISOString().split('T')[0]}_${pdfDataArray.length}files.pdf`;
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        
        // Delay removal to ensure download starts
        setTimeout(() => {
          document.body.removeChild(a);
          window.URL.revokeObjectURL(url);
        }, 1000);
        
        setProgress(95);
        mergeSuccess = true;
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
        mergeSuccess = true; // Individual downloads done
      }
    }

    // Upload all PDFs to backend
    try {
      const uploadResult = await uploadPDFsToBackend(pdfDataArray);
      setIsGenerating(false);
      if (mergeSuccess) {
        alert(`✅ ${uploadResult.files.length} FTR reports generated and merged PDF downloaded!`);
      } else {
        alert(`✅ ${uploadResult.files.length} FTR reports generated! Check downloads.`);
      }
    } catch (error) {
      setIsGenerating(false);
      alert(`✅ ${pdfDataArray.length} FTR reports generated and downloaded!\n\n⚠️ Upload to server failed: ${error.message}`);
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
        <button 
          onClick={generateAllReports}
          disabled={isGenerating || excelData.length === 0}
          className="generate-btn"
        >
          {isGenerating ? `Generating... ${Math.round(progress)}%` : 'Generate All Reports'}
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

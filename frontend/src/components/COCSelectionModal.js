import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { MATERIAL_REQUIREMENTS, calculateMaterialRequirements } from '../constants/materialRequirements';

const API_BASE_URL = process.env.REACT_APP_API_URL || '/api';

const COCSelectionModal = ({ 
  isOpen, 
  onClose, 
  onConfirm, 
  productionQty,
  companyId,
  existingSelections = {}
}) => {
  const [availableCOCs, setAvailableCOCs] = useState([]);
  const [selectedCOCs, setSelectedCOCs] = useState(existingSelections);
  const [loading, setLoading] = useState(true);
  const [materialRequirements, setMaterialRequirements] = useState({});

  useEffect(() => {
    if (isOpen && productionQty > 0) {
      // Calculate requirements
      const requirements = calculateMaterialRequirements(productionQty);
      setMaterialRequirements(requirements);
      
      // Fetch available COCs
      fetchAvailableCOCs();
    }
  }, [isOpen, productionQty]);

  const fetchAvailableCOCs = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_BASE_URL}/coc/list`, {
        params: {
          company_id: companyId // Filter by company if needed
        }
      });

      // Group COCs by material type
      const groupedCOCs = {};
      const cocList = response.data.data || response.data.coc_list || [];
      
      cocList.forEach(coc => {
        const material = coc.material; // Field name is 'material' not 'material_name'
        if (!groupedCOCs[material]) {
          groupedCOCs[material] = [];
        }
        groupedCOCs[material].push(coc);
      });

      console.log('Grouped COCs:', groupedCOCs); // Debug log
      setAvailableCOCs(groupedCOCs);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching COCs:', error);
      setLoading(false);
    }
  };

  const handleCOCSelect = (materialName, coc) => {
    setSelectedCOCs(prev => ({
      ...prev,
      [materialName]: {
        lot_batch_no: coc.lot_batch_no,
        invoice_no: coc.invoice_no,
        invoice_date: coc.invoice_date,
        brand: coc.brand,
        available_qty: coc.available_qty,
        consumed_qty: coc.consumed_qty,
        received_qty: coc.coc_qty, // Use coc_qty as received_qty
        material: coc.material // Correct field name
      }
    }));
  };

  const handleRemoveCOC = (materialName) => {
    setSelectedCOCs(prev => {
      const updated = { ...prev };
      delete updated[materialName];
      return updated;
    });
  };

  const calculateModulesFromCOC = (availableQty, requiredPerModule) => {
    return Math.floor(availableQty / requiredPerModule);
  };

  const calculateRemainingAfterProduction = (availableQty, totalRequired) => {
    return availableQty - totalRequired;
  };

  const handleConfirm = () => {
    // Check if all required materials have COC selected
    const missingMaterials = Object.keys(materialRequirements).filter(
      mat => !selectedCOCs[mat]
    );

    if (missingMaterials.length > 0) {
      alert(`Please select COC for: ${missingMaterials.join(', ')}`);
      return;
    }

    onConfirm(selectedCOCs);
  };

  if (!isOpen) return null;

  return (
    <div className="coc-modal-overlay" style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.6)',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 10000,
      padding: '20px'
    }}>
      <div className="coc-modal-container" style={{
        backgroundColor: 'white',
        borderRadius: '16px',
        width: '95%',
        maxWidth: '1400px',
        maxHeight: '90vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 10px 40px rgba(0, 0, 0, 0.3)',
        animation: 'slideUp 0.3s ease'
      }}>
        <div className="coc-modal-header" style={{
          padding: '24px 30px',
          borderBottom: '2px solid #e0e0e0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          borderRadius: '16px 16px 0 0',
          color: 'white'
        }}>
          <div>
            <h2 style={{margin: 0, fontSize: '24px', fontWeight: 700}}>📋 Select COC for Materials</h2>
            <div className="production-info" style={{
              marginTop: '8px',
              fontSize: '14px',
              opacity: 0.95
            }}>
              Production Quantity: <strong style={{fontSize: '16px'}}>{productionQty} modules</strong>
            </div>
          </div>
          <button 
            className="close-btn" 
            onClick={onClose}
            style={{
              background: 'rgba(255, 255, 255, 0.2)',
              border: 'none',
              color: 'white',
              fontSize: '32px',
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.3s ease',
              lineHeight: 1
            }}
            onMouseOver={(e) => e.target.style.background = 'rgba(255, 255, 255, 0.3)'}
            onMouseOut={(e) => e.target.style.background = 'rgba(255, 255, 255, 0.2)'}
          >
            &times;
          </button>
        </div>

        <div className="coc-modal-body" style={{
          padding: '25px 30px',
          overflowY: 'auto',
          flex: 1,
          backgroundColor: '#f8f9fa'
        }}>
          {loading ? (
            <div className="loading" style={{
              textAlign: 'center',
              padding: '60px 20px',
              fontSize: '18px',
              color: '#667eea',
              fontWeight: 600
            }}>
              <div style={{fontSize: '48px', marginBottom: '15px'}}>⏳</div>
              Loading COC data...
            </div>
          ) : (
            <div className="materials-grid" style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
              gap: '20px'
            }}>
              {Object.entries(materialRequirements).map(([materialName, requirement]) => {
                const cocMaterialType = requirement.cocMaterial;
                const availableCOCsList = availableCOCs[cocMaterialType] || [];
                const selectedCOC = selectedCOCs[materialName];
                const requiredQty = requirement.totalRequired;

                return (
                  <div key={materialName} className="material-section" style={{
                    backgroundColor: 'white',
                    borderRadius: '12px',
                    padding: '20px',
                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
                    border: '1px solid #e0e0e0',
                    transition: 'transform 0.2s ease, box-shadow 0.2s ease'
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.2)';
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.1)';
                  }}>
                    <div className="material-header" style={{
                      marginBottom: '15px',
                      paddingBottom: '12px',
                      borderBottom: '2px solid #e0e0e0'
                    }}>
                      <h3 style={{
                        margin: 0,
                        fontSize: '16px',
                        color: '#2c3e50',
                        fontWeight: 700,
                        marginBottom: '8px'
                      }}>{materialName}</h3>
                      <div className="material-requirement" style={{
                        fontSize: '13px',
                        color: '#666'
                      }}>
                        Required: <strong style={{color: '#667eea', fontSize: '14px'}}>{requiredQty.toFixed(3)} {requirement.unit}</strong>
                        {requirement.description && (
                          <span className="material-desc" style={{color: '#999', fontSize: '12px'}}> ({requirement.description})</span>
                        )}
                      </div>
                    </div>

                    {selectedCOC ? (
                      <div className="selected-coc-card" style={{
                        background: 'linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 100%)',
                        borderRadius: '10px',
                        padding: '16px',
                        border: '2px solid #4caf50'
                      }}>
                        <div className="coc-card-header" style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          marginBottom: '12px'
                        }}>
                          <span className="invoice-badge" style={{
                            background: '#4caf50',
                            color: 'white',
                            padding: '6px 12px',
                            borderRadius: '20px',
                            fontSize: '12px',
                            fontWeight: 600
                          }}>
                            📄 {selectedCOC.invoice_no}
                          </span>
                          <button 
                            className="remove-btn"
                            onClick={() => handleRemoveCOC(materialName)}
                            style={{
                              background: '#f44336',
                              color: 'white',
                              border: 'none',
                              width: '28px',
                              height: '28px',
                              borderRadius: '50%',
                              cursor: 'pointer',
                              fontSize: '18px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontWeight: 'bold',
                              transition: 'all 0.2s ease'
                            }}
                            onMouseOver={(e) => e.target.style.background = '#d32f2f'}
                            onMouseOut={(e) => e.target.style.background = '#f44336'}
                          >
                            ✕
                          </button>
                        </div>
                        <div className="coc-details" style={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '8px'
                        }}>
                          <div className="coc-detail-row" style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            fontSize: '13px',
                            color: '#2c3e50'
                          }}>
                            <span style={{color: '#666'}}>Lot/Batch:</span>
                            <strong>{selectedCOC.lot_batch_no}</strong>
                          </div>
                          <div className="coc-detail-row" style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            fontSize: '13px',
                            color: '#2c3e50'
                          }}>
                            <span style={{color: '#666'}}>Brand:</span>
                            <strong>{selectedCOC.brand}</strong>
                          </div>
                          <div className="coc-detail-row" style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            fontSize: '13px',
                            color: '#2c3e50'
                          }}>
                            <span style={{color: '#666'}}>Available:</span>
                            <strong>{selectedCOC.available_qty} {requirement.unit}</strong>
                          </div>
                          <div className="coc-detail-row" style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            fontSize: '13px',
                            color: '#2c3e50',
                            backgroundColor: 'rgba(255, 255, 255, 0.7)',
                            padding: '8px',
                            borderRadius: '6px',
                            marginTop: '4px'
                          }}>
                            <span style={{color: '#666'}}>Modules Possible:</span>
                            <strong className="modules-possible" style={{color: '#4caf50', fontSize: '14px'}}>
                              {calculateModulesFromCOC(selectedCOC.available_qty, requirement.quantity)} modules
                            </strong>
                          </div>
                          <div className="coc-detail-row" style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            fontSize: '13px',
                            color: '#2c3e50'
                          }}>
                            <span style={{color: '#666'}}>After Production:</span>
                            <strong className={
                              calculateRemainingAfterProduction(selectedCOC.available_qty, requiredQty) < 0 
                                ? 'negative-qty' 
                                : 'positive-qty'
                            } style={{
                              color: calculateRemainingAfterProduction(selectedCOC.available_qty, requiredQty) < 0 ? '#f44336' : '#4caf50'
                            }}>
                              {calculateRemainingAfterProduction(selectedCOC.available_qty, requiredQty).toFixed(3)} {requirement.unit}
                            </strong>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="coc-selection-area" style={{
                        minHeight: '200px'
                      }}>
                        <div className="no-coc-warning" style={{
                          background: '#fff3cd',
                          border: '1px solid #ffc107',
                          borderRadius: '8px',
                          padding: '12px',
                          textAlign: 'center',
                          color: '#856404',
                          fontSize: '13px',
                          fontWeight: 600,
                          marginBottom: '12px'
                        }}>
                          ⚠️ No COC Selected
                        </div>
                        <div className="available-cocs-list" style={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '10px',
                          maxHeight: '300px',
                          overflowY: 'auto',
                          paddingRight: '5px'
                        }}>
                          {availableCOCsList.length > 0 ? (
                            availableCOCsList.map((coc, idx) => {
                              const modulesPossible = calculateModulesFromCOC(
                                coc.available_qty, 
                                requirement.quantity
                              );
                              const remainingAfter = calculateRemainingAfterProduction(
                                coc.available_qty, 
                                requiredQty
                              );
                              const isInsufficient = remainingAfter < 0;

                              return (
                                <button
                                  key={idx}
                                  className={`coc-option-btn ${isInsufficient ? 'insufficient' : ''}`}
                                  onClick={() => handleCOCSelect(materialName, coc)}
                                  disabled={isInsufficient}
                                  style={{
                                    width: '100%',
                                    textAlign: 'left',
                                    padding: '14px',
                                    border: isInsufficient ? '2px solid #ffcdd2' : '2px solid #e0e0e0',
                                    borderRadius: '10px',
                                    backgroundColor: isInsufficient ? '#ffebee' : 'white',
                                    cursor: isInsufficient ? 'not-allowed' : 'pointer',
                                    transition: 'all 0.2s ease',
                                    opacity: isInsufficient ? 0.6 : 1
                                  }}
                                  onMouseOver={(e) => {
                                    if (!isInsufficient) {
                                      e.currentTarget.style.borderColor = '#667eea';
                                      e.currentTarget.style.backgroundColor = '#f5f7ff';
                                      e.currentTarget.style.transform = 'translateX(4px)';
                                    }
                                  }}
                                  onMouseOut={(e) => {
                                    if (!isInsufficient) {
                                      e.currentTarget.style.borderColor = '#e0e0e0';
                                      e.currentTarget.style.backgroundColor = 'white';
                                      e.currentTarget.style.transform = 'translateX(0)';
                                    }
                                  }}
                                >
                                  <div className="coc-btn-header" style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    marginBottom: '10px'
                                  }}>
                                    <span className="invoice-no" style={{
                                      fontSize: '13px',
                                      fontWeight: 700,
                                      color: '#667eea'
                                    }}>📄 {coc.invoice_no}</span>
                                    {isInsufficient && (
                                      <span className="insufficient-badge" style={{
                                        background: '#f44336',
                                        color: 'white',
                                        padding: '4px 10px',
                                        borderRadius: '12px',
                                        fontSize: '11px',
                                        fontWeight: 600
                                      }}>⚠️ Insufficient</span>
                                    )}
                                  </div>
                                  <div className="coc-btn-details" style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '6px',
                                    fontSize: '12px'
                                  }}>
                                    <div className="coc-btn-row" style={{
                                      display: 'flex',
                                      justifyContent: 'space-between',
                                      color: '#555'
                                    }}>
                                      <span style={{color: '#888'}}>Brand:</span> 
                                      <strong style={{color: '#2c3e50'}}>{coc.brand}</strong>
                                    </div>
                                    <div className="coc-btn-row" style={{
                                      display: 'flex',
                                      justifyContent: 'space-between',
                                      color: '#555'
                                    }}>
                                      <span style={{color: '#888'}}>Available:</span> 
                                      <strong style={{color: '#2c3e50'}}>{coc.available_qty} {requirement.unit}</strong>
                                    </div>
                                    <div className="coc-btn-row" style={{
                                      display: 'flex',
                                      justifyContent: 'space-between',
                                      color: '#555',
                                      backgroundColor: 'rgba(102, 126, 234, 0.08)',
                                      padding: '6px 8px',
                                      borderRadius: '6px',
                                      marginTop: '2px'
                                    }}>
                                      <span style={{color: '#888'}}>Can Produce:</span> 
                                      <strong style={{color: '#667eea', fontSize: '13px'}}>{modulesPossible} modules</strong>
                                    </div>
                                    <div className="coc-btn-row" style={{
                                      display: 'flex',
                                      justifyContent: 'space-between',
                                      color: '#555'
                                    }}>
                                      <span style={{color: '#888'}}>After Production:</span>
                                      <strong className={remainingAfter < 0 ? 'negative' : 'positive'} style={{
                                        color: remainingAfter < 0 ? '#f44336' : '#4caf50'
                                      }}>
                                        {remainingAfter.toFixed(3)} {requirement.unit}
                                      </strong>
                                    </div>
                                  </div>
                                </button>
                              );
                            })
                          ) : (
                            <div className="no-coc-available" style={{
                              textAlign: 'center',
                              padding: '30px 20px',
                              color: '#999',
                              fontSize: '14px',
                              backgroundColor: '#f5f5f5',
                              borderRadius: '8px',
                              border: '2px dashed #ddd'
                            }}>
                              📭 No COC available for {cocMaterialType}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="coc-modal-footer" style={{
          padding: '20px 30px',
          borderTop: '2px solid #e0e0e0',
          display: 'flex',
          justifyContent: 'flex-end',
          gap: '12px',
          backgroundColor: '#f8f9fa'
        }}>
          <button 
            className="cancel-btn" 
            onClick={onClose}
            style={{
              padding: '12px 28px',
              fontSize: '15px',
              fontWeight: 600,
              border: '2px solid #e0e0e0',
              backgroundColor: 'white',
              color: '#666',
              borderRadius: '10px',
              cursor: 'pointer',
              transition: 'all 0.3s ease'
            }}
            onMouseOver={(e) => {
              e.target.style.borderColor = '#bbb';
              e.target.style.backgroundColor = '#f5f5f5';
            }}
            onMouseOut={(e) => {
              e.target.style.borderColor = '#e0e0e0';
              e.target.style.backgroundColor = 'white';
            }}
          >
            ✕ Cancel
          </button>
          <button 
            className="confirm-btn" 
            onClick={handleConfirm}
            style={{
              padding: '12px 28px',
              fontSize: '15px',
              fontWeight: 600,
              border: 'none',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: 'white',
              borderRadius: '10px',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              boxShadow: '0 4px 12px rgba(102, 126, 234, 0.3)'
            }}
            onMouseOver={(e) => {
              e.target.style.transform = 'translateY(-2px)';
              e.target.style.boxShadow = '0 6px 16px rgba(102, 126, 234, 0.4)';
            }}
            onMouseOut={(e) => {
              e.target.style.transform = 'translateY(0)';
              e.target.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.3)';
            }}
          >
            ✓ Confirm COC Selection
          </button>
        </div>
      </div>
    </div>
  );
};

export default COCSelectionModal;

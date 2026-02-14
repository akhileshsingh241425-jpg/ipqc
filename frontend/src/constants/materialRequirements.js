/**
 * Material Requirements per Module
 * Defines exact quantity needed for each material type per solar module
 */

export const MATERIAL_REQUIREMENTS = {
  'Solar Cell': {
    quantity: 66,
    unit: 'PCS',
    description: '25.3-25.8',
    cocMaterial: 'Solar Cell'
  },
  'Front Glass': {
    quantity: 1,
    unit: 'PCS',
    description: '2376',
    cocMaterial: 'Glass'
  },
  'Back Glass': {
    quantity: 1,
    unit: 'PCS',
    description: '2376 with 3 hole',
    cocMaterial: 'Glass'
  },
  'Ribbon': {
    quantity: 0.212,
    unit: 'KG',
    description: '0.26mm',
    cocMaterial: 'Ribbon'
  },
  'Flux': {
    quantity: 0.02,
    unit: 'LTR',
    description: '',
    cocMaterial: 'Flux' // Need to add if not in COC
  },
  'Busbar 4mm': {
    quantity: 0.038,
    unit: 'KG',
    description: '4.0X0.4 mm',
    cocMaterial: 'Ribbon' // Busbar is type of Ribbon
  },
  'Busbar 6mm': {
    quantity: 0.018,
    unit: 'KG',
    description: '6.0X0.4 mm',
    cocMaterial: 'Ribbon'
  },
  'EPE Front': {
    quantity: 5.2,
    unit: 'SQM',
    description: 'Front',
    cocMaterial: 'EPE'
  },
  'Aluminium Frame': {
    quantity: 1,
    unit: 'SETS',
    description: '2382*1134',
    cocMaterial: 'Aluminium Frame'
  },
  'Sealant': {
    quantity: 0.35,
    unit: 'KG',
    description: '270KG',
    cocMaterial: 'Sealant' // Need to add if not in COC
  },
  'JB Potting': {
    quantity: 0.021,
    unit: 'KG',
    description: 'A and B',
    cocMaterial: 'Potting Material' // Need to add if not in COC
  },
  'Junction Box': {
    quantity: 1,
    unit: 'SETS',
    description: '1200mm',
    cocMaterial: 'Junction Box'
  }
};

/**
 * Calculate total material requirements for given production quantity
 */
export const calculateMaterialRequirements = (productionQty) => {
  const requirements = {};
  
  Object.entries(MATERIAL_REQUIREMENTS).forEach(([materialName, config]) => {
    const totalQty = config.quantity * productionQty;
    
    requirements[materialName] = {
      ...config,
      totalRequired: totalQty,
      formattedQty: `${totalQty.toFixed(3)} ${config.unit}`
    };
  });
  
  return requirements;
};

/**
 * Group materials by COC material type
 */
export const groupByCOCMaterial = () => {
  const grouped = {};
  
  Object.entries(MATERIAL_REQUIREMENTS).forEach(([materialName, config]) => {
    const cocMat = config.cocMaterial;
    if (!grouped[cocMat]) {
      grouped[cocMat] = [];
    }
    grouped[cocMat].push({
      name: materialName,
      ...config
    });
  });
  
  return grouped;
};

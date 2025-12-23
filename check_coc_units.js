/**
 * COC API Data Checker - Check all material quantities and units
 */

const axios = require('axios');

const COC_API_URL = 'https://umanmrp.in/api/coc_api.php';

async function checkCOCUnits() {
    try {
        console.log('🔍 Fetching COC data from API...\n');
        
        // Get last 6 months data
        const toDate = new Date().toISOString().split('T')[0];
        const fromDate = new Date(Date.now() - 180*24*60*60*1000).toISOString().split('T')[0];
        
        const response = await axios.post(COC_API_URL, {
            from: fromDate,
            to: toDate
        }, { timeout: 30000 });
        
        let cocData = [];
        if (response.data && response.data.data) {
            cocData = response.data.data;
        } else if (Array.isArray(response.data)) {
            cocData = response.data;
        }
        
        console.log(`✅ Fetched ${cocData.length} COC records\n`);
        console.log('='*80);
        console.log('📊 MATERIAL WISE QUANTITY ANALYSIS\n');
        console.log('='*80);
        
        // Group by material name
        const materialGroups = {};
        
        cocData.forEach(coc => {
            const material = coc.material_name || 'Unknown';
            
            if (!materialGroups[material]) {
                materialGroups[material] = {
                    count: 0,
                    quantities: [],
                    units: new Set(),
                    samples: []
                };
            }
            
            materialGroups[material].count++;
            
            // Store quantity info
            if (coc.coc_qty) {
                materialGroups[material].quantities.push(parseFloat(coc.coc_qty) || 0);
            }
            
            // Try to detect unit from quantity field or product name
            if (coc.product_name) {
                materialGroups[material].units.add(coc.product_name);
            }
            
            // Store sample data
            if (materialGroups[material].samples.length < 3) {
                materialGroups[material].samples.push({
                    invoice: coc.invoice_no,
                    qty: coc.coc_qty,
                    invoice_qty: coc.invoice_qty,
                    product: coc.product_name,
                    brand: coc.brand
                });
            }
        });
        
        // Print material-wise summary
        const sortedMaterials = Object.keys(materialGroups).sort();
        
        sortedMaterials.forEach(material => {
            const data = materialGroups[material];
            const avgQty = data.quantities.reduce((a, b) => a + b, 0) / data.quantities.length;
            const minQty = Math.min(...data.quantities);
            const maxQty = Math.max(...data.quantities);
            
            console.log(`\n📦 ${material}`);
            console.log(`   Records: ${data.count}`);
            console.log(`   Qty Range: ${minQty.toFixed(2)} - ${maxQty.toFixed(2)} (Avg: ${avgQty.toFixed(2)})`);
            
            console.log(`   Sample Entries:`);
            data.samples.forEach((sample, idx) => {
                console.log(`      ${idx + 1}. Invoice: ${sample.invoice}, COC Qty: ${sample.qty}, Invoice Qty: ${sample.invoice_qty}`);
                console.log(`         Product: ${sample.product || 'N/A'}, Brand: ${sample.brand || 'N/A'}`);
            });
        });
        
        console.log('\n' + '='*80);
        console.log('✅ Analysis Complete!');
        console.log('='*80);
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        if (error.response) {
            console.error('Response:', error.response.data);
        }
    }
}

// Run the checker
checkCOCUnits();

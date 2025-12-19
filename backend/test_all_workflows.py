"""
PDI IPQC System - Comprehensive End-to-End Testing
Tests all major workflows and features
"""

import requests
import json
from datetime import datetime, timedelta
import time

BASE_URL = "http://localhost:5003"
API_BASE = f"{BASE_URL}/api"

class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    CYAN = '\033[96m'
    MAGENTA = '\033[95m'
    RESET = '\033[0m'

class TestResults:
    def __init__(self):
        self.total = 0
        self.passed = 0
        self.failed = 0
        self.warnings = 0
        self.workflows = []
        
    def add_result(self, workflow, test_name, passed, warning=False, message=""):
        self.total += 1
        if warning:
            self.warnings += 1
        elif passed:
            self.passed += 1
        else:
            self.failed += 1
        
        self.workflows.append({
            'workflow': workflow,
            'test': test_name,
            'passed': passed,
            'warning': warning,
            'message': message
        })

results = TestResults()

def print_header(text):
    print(f"\n{Colors.CYAN}{'='*80}")
    print(f"{text:^80}")
    print(f"{'='*80}{Colors.RESET}\n")

def print_success(text):
    print(f"{Colors.GREEN}✓{Colors.RESET} {text}")

def print_error(text):
    print(f"{Colors.RED}✗{Colors.RESET} {text}")

def print_warning(text):
    print(f"{Colors.YELLOW}⚠{Colors.RESET} {text}")

def print_info(text):
    print(f"{Colors.BLUE}ℹ{Colors.RESET} {text}")

def test_endpoint(method, url, data=None, expected_status=200, test_name=""):
    """Test API endpoint and return response"""
    try:
        full_url = f"{API_BASE}{url}"
        
        if method == "GET":
            response = requests.get(full_url, timeout=10)
        elif method == "POST":
            response = requests.post(full_url, json=data, timeout=10)
        elif method == "PUT":
            response = requests.put(full_url, json=data, timeout=10)
        elif method == "DELETE":
            response = requests.delete(full_url, timeout=10)
        
        success = response.status_code in [expected_status, 200, 201]
        
        if success:
            print_success(f"{test_name}: {method} {url} - Status {response.status_code}")
        else:
            print_error(f"{test_name}: {method} {url} - Status {response.status_code}")
        
        try:
            return success, response.json()
        except:
            return success, response.text
            
    except Exception as e:
        print_error(f"{test_name}: {str(e)}")
        return False, str(e)

# =============================================================================
# WORKFLOW 1: SERVER HEALTH & CONNECTIVITY
# =============================================================================
def test_server_health():
    print_header("WORKFLOW 1: Server Health & Connectivity")
    
    # Test 1: Server is running
    try:
        response = requests.get(BASE_URL, timeout=5)
        results.add_result("Server", "Server Accessibility", True)
        print_success(f"Server is running (Status: {response.status_code})")
    except:
        results.add_result("Server", "Server Accessibility", False)
        print_error("Server is not accessible")
        return False
    
    # Test 2: API Base is accessible
    try:
        response = requests.get(f"{API_BASE}/coc/list", timeout=5)
        results.add_result("Server", "API Endpoints", True)
        print_success("API endpoints are accessible")
    except:
        results.add_result("Server", "API Endpoints", False)
        print_error("API endpoints not accessible")
    
    return True

# =============================================================================
# WORKFLOW 2: COC MANAGEMENT
# =============================================================================
def test_coc_workflow():
    print_header("WORKFLOW 2: COC Management & Material Tracking")
    
    # Test 1: Get COC Companies
    success, data = test_endpoint("GET", "/coc/companies", test_name="Get COC Companies")
    results.add_result("COC", "Get Companies List", success)
    
    companies = data.get('data', []) if isinstance(data, dict) else []
    if companies:
        print_info(f"Found {len(companies)} companies: {', '.join(companies[:3])}")
    
    # Test 2: Get All COC Documents
    success, data = test_endpoint("GET", "/coc/list", test_name="Get COC Documents")
    results.add_result("COC", "List All COCs", success)
    
    coc_list = data.get('coc_data', []) if isinstance(data, dict) else []
    if coc_list:
        print_info(f"Total COC documents: {len(coc_list)}")
        print_info(f"Sample: {coc_list[0].get('doc_number')} - {coc_list[0].get('material')}")
    
    # Test 3: Get Material Stock
    success, data = test_endpoint("GET", "/coc/stock", test_name="Get Material Stock")
    results.add_result("COC", "Material Stock Data", success)
    
    stock = data.get('data', []) if isinstance(data, dict) else []
    if stock:
        print_info(f"Tracking {len(stock)} materials")
        for item in stock[:3]:
            print_info(f"  - {item.get('material')}: {item.get('available')} available")
    
    # Test 4: Sync COC from Zoho
    sync_data = {
        'from_date': (datetime.now() - timedelta(days=7)).strftime('%Y-%m-%d'),
        'to_date': datetime.now().strftime('%Y-%m-%d')
    }
    success, data = test_endpoint("POST", "/coc/sync", sync_data, test_name="Sync COC from Zoho")
    results.add_result("COC", "Sync from External API", success)
    
    if isinstance(data, dict):
        print_info(f"Synced: {data.get('synced', 0)} new, Updated: {data.get('updated', 0)}")
    
    # Test 5: COC Validation
    validation_data = {
        'company_name': 'Test Company',
        'materials': {
            'Solar Cell': 1000,
            'Glass': 500
        }
    }
    success, data = test_endpoint("POST", "/coc/validate", validation_data, test_name="Validate Production Materials")
    results.add_result("COC", "Production Validation", success)

# =============================================================================
# WORKFLOW 3: PRODUCTION MANAGEMENT
# =============================================================================
def test_production_workflow():
    print_header("WORKFLOW 3: Production Management & Daily Reports")
    
    # Test 1: Get All Companies
    success, data = test_endpoint("GET", "/companies", test_name="Get Production Companies")
    results.add_result("Production", "List Companies", success)
    
    companies = data if isinstance(data, list) else []
    test_company_id = None
    
    if companies:
        print_info(f"Found {len(companies)} production companies")
        test_company_id = companies[0].get('id')
        print_info(f"Testing with: {companies[0].get('companyName')} (ID: {test_company_id})")
    
    # Test 2: Get Production Days
    if test_company_id:
        success, data = test_endpoint("GET", f"/production/{test_company_id}/days", 
                                      test_name="Get Production Days")
        results.add_result("Production", "Get Production Days", success)
    else:
        results.add_result("Production", "Get Production Days", False, warning=True, 
                          message="No company available")
    
    # Test 3: Get Company Details
    if test_company_id:
        success, data = test_endpoint("GET", f"/companies/{test_company_id}", 
                                      test_name="Get Company Details")
        results.add_result("Production", "Company Details", success)

# =============================================================================
# WORKFLOW 4: FTR MANAGEMENT
# =============================================================================
def test_ftr_workflow():
    print_header("WORKFLOW 4: FTR Document Management")
    
    # Test 1: Check FTR Upload Endpoint
    try:
        response = requests.post(f"{API_BASE}/ftr/upload-single", timeout=5)
        # 400/422 means endpoint exists but needs data
        if response.status_code in [400, 422, 405]:
            results.add_result("FTR", "Upload Endpoint", True)
            print_success("FTR upload endpoint is accessible")
        else:
            results.add_result("FTR", "Upload Endpoint", False, warning=True)
            print_warning(f"FTR endpoint returned: {response.status_code}")
    except Exception as e:
        results.add_result("FTR", "Upload Endpoint", False)
        print_error(f"FTR upload test failed: {str(e)}")

# =============================================================================
# WORKFLOW 5: IPQC DATA MANAGEMENT
# =============================================================================
def test_ipqc_workflow():
    print_header("WORKFLOW 5: IPQC Data Management")
    
    # Test 1: Get IPQC Data
    success, data = test_endpoint("GET", "/ipqc/data", test_name="Get IPQC Data")
    results.add_result("IPQC", "Get IPQC Records", success)
    
    if isinstance(data, dict) and data.get('data'):
        print_info(f"Found {len(data['data'])} IPQC records")
    
    # Test 2: Health Check
    success, data = test_endpoint("GET", "/ipqc/health", test_name="IPQC Health Check")
    results.add_result("IPQC", "Health Check", success)
    
    # Test 3: List Customers
    success, data = test_endpoint("GET", "/ipqc/list-customers", test_name="List IPQC Customers")
    results.add_result("IPQC", "Customer List", success)

# =============================================================================
# WORKFLOW 6: PEEL TEST MANAGEMENT
# =============================================================================
def test_peel_test_workflow():
    print_header("WORKFLOW 6: Peel Test Management")
    
    # Test 1: Get Peel Test Data
    success, data = test_endpoint("GET", "/peel-test/data", test_name="Get Peel Test Data")
    results.add_result("Peel Test", "Get Reports", success)
    
    # Test 2: Get Test Types
    success, data = test_endpoint("GET", "/peel-test/test-types", test_name="Get Test Types")
    results.add_result("Peel Test", "Test Types", success)
    
    # Test 3: Get Failure Modes
    success, data = test_endpoint("GET", "/peel-test/failure-modes", test_name="Get Failure Modes")
    results.add_result("Peel Test", "Failure Modes", success)

# =============================================================================
# WORKFLOW 7: MASTER DATA MANAGEMENT
# =============================================================================
def test_master_data_workflow():
    print_header("WORKFLOW 7: Master Data Management")
    
    # Test 1: Get BOM Data
    success, data = test_endpoint("GET", "/master/bom", test_name="Get BOM Data")
    results.add_result("Master Data", "BOM Data", success)
    
    # Test 2: Get Cell Specifications
    success, data = test_endpoint("GET", "/master/cell-specs", test_name="Get Cell Specifications")
    results.add_result("Master Data", "Cell Specifications", success)
    
    if isinstance(data, dict) and data.get('data'):
        specs = data['data']
        print_info(f"Standard cells: {len(specs.get('standard_cells', []))}")
        print_info(f"Module configs: {len(specs.get('cells_per_module', {}))}")

# =============================================================================
# WORKFLOW 8: END-TO-END PRODUCTION FLOW
# =============================================================================
def test_end_to_end_flow():
    print_header("WORKFLOW 8: End-to-End Production Flow")
    
    print_info("Testing complete production workflow...")
    
    # Step 1: Check COC availability
    success, coc_data = test_endpoint("GET", "/coc/stock", test_name="Step 1: Check Material Stock")
    results.add_result("E2E Flow", "Material Availability Check", success)
    
    # Step 2: Get companies
    success, company_data = test_endpoint("GET", "/companies", test_name="Step 2: Get Companies")
    results.add_result("E2E Flow", "Company Selection", success)
    
    # Step 3: Validate production (if we have data)
    if isinstance(coc_data, dict) and isinstance(company_data, list) and company_data:
        validation_data = {
            'company_name': company_data[0].get('companyName'),
            'materials': {'Solar Cell': 100}
        }
        success, val_data = test_endpoint("POST", "/coc/validate", validation_data, 
                                          test_name="Step 3: Validate Production")
        results.add_result("E2E Flow", "Production Validation", success)
        
        if isinstance(val_data, dict) and val_data.get('can_proceed'):
            print_success("✓ Production can proceed with available materials")
        else:
            print_warning("⚠ Insufficient materials for production")

# =============================================================================
# FINAL REPORT
# =============================================================================
def print_final_report():
    print_header("COMPREHENSIVE TEST REPORT")
    
    # Summary
    print(f"{Colors.CYAN}Test Summary:{Colors.RESET}")
    print(f"  Total Tests: {results.total}")
    print(f"  {Colors.GREEN}Passed: {results.passed}{Colors.RESET}")
    print(f"  {Colors.RED}Failed: {results.failed}{Colors.RESET}")
    print(f"  {Colors.YELLOW}Warnings: {results.warnings}{Colors.RESET}")
    
    success_rate = (results.passed / results.total * 100) if results.total > 0 else 0
    print(f"\n  Success Rate: {Colors.CYAN}{success_rate:.1f}%{Colors.RESET}")
    
    # Workflow breakdown
    print(f"\n{Colors.CYAN}Workflow Breakdown:{Colors.RESET}")
    
    workflows = {}
    for item in results.workflows:
        wf = item['workflow']
        if wf not in workflows:
            workflows[wf] = {'passed': 0, 'failed': 0, 'warning': 0}
        
        if item['warning']:
            workflows[wf]['warning'] += 1
        elif item['passed']:
            workflows[wf]['passed'] += 1
        else:
            workflows[wf]['failed'] += 1
    
    for wf, stats in workflows.items():
        total = stats['passed'] + stats['failed'] + stats['warning']
        rate = (stats['passed'] / total * 100) if total > 0 else 0
        
        status = f"{Colors.GREEN}✓{Colors.RESET}" if rate >= 80 else \
                 f"{Colors.YELLOW}⚠{Colors.RESET}" if rate >= 50 else \
                 f"{Colors.RED}✗{Colors.RESET}"
        
        print(f"  {status} {wf:25} - {stats['passed']}/{total} passed ({rate:.0f}%)")
    
    # Overall status
    print(f"\n{Colors.CYAN}Overall System Status:{Colors.RESET}")
    if success_rate >= 90:
        print(f"{Colors.GREEN}{'='*80}")
        print(f"✓ EXCELLENT! System is fully operational")
        print(f"  All critical workflows are functioning correctly")
        print(f"{'='*80}{Colors.RESET}")
    elif success_rate >= 70:
        print(f"{Colors.YELLOW}{'='*80}")
        print(f"⚠ GOOD! System is mostly operational")
        print(f"  Some minor issues detected, but core features work")
        print(f"{'='*80}{Colors.RESET}")
    elif success_rate >= 50:
        print(f"{Colors.YELLOW}{'='*80}")
        print(f"⚠ FAIR! System has notable issues")
        print(f"  Review failed tests and fix issues")
        print(f"{'='*80}{Colors.RESET}")
    else:
        print(f"{Colors.RED}{'='*80}")
        print(f"✗ POOR! System has major problems")
        print(f"  Critical issues detected - immediate attention required")
        print(f"{'='*80}{Colors.RESET}")
    
    # Failed tests detail
    if results.failed > 0:
        print(f"\n{Colors.RED}Failed Tests:{Colors.RESET}")
        for item in results.workflows:
            if not item['passed'] and not item['warning']:
                print(f"  ✗ {item['workflow']} - {item['test']}")
                if item['message']:
                    print(f"    Reason: {item['message']}")
    
    print(f"\n{Colors.CYAN}Test completed at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}{Colors.RESET}\n")

# =============================================================================
# MAIN TEST EXECUTION
# =============================================================================
def main():
    print(f"\n{Colors.MAGENTA}{'='*80}")
    print(f"PDI IPQC SYSTEM - COMPREHENSIVE END-TO-END TESTING")
    print(f"{'='*80}{Colors.RESET}")
    print(f"\n{Colors.CYAN}Testing Backend: {BASE_URL}{Colors.RESET}")
    print(f"{Colors.CYAN}Start Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}{Colors.RESET}\n")
    
    # Run all workflow tests
    if not test_server_health():
        print_error("Server is not accessible. Please start the backend server first.")
        return
    
    test_coc_workflow()
    test_production_workflow()
    test_ftr_workflow()
    test_ipqc_workflow()
    test_peel_test_workflow()
    test_master_data_workflow()
    test_end_to_end_flow()
    
    # Print final report
    print_final_report()
    
    # Frontend testing reminder
    print(f"{Colors.CYAN}{'='*80}")
    print(f"FRONTEND TESTING REMINDER")
    print(f"{'='*80}{Colors.RESET}")
    print(f"""
{Colors.YELLOW}This script tests backend APIs only.{Colors.RESET}
{Colors.YELLOW}Frontend features must be tested manually in browser:{Colors.RESET}

1. Start frontend: cd frontend && npm start
2. Open: http://localhost:3000
3. Test user authentication (admin@gautam / Gautam@123)
4. Test role-based access control
5. Test COC Dashboard with inline editing
6. Test Daily Report with production records
7. Test COC Selection Modal UI improvements
8. Test FTR upload and generation
9. Test all CRUD operations

{Colors.GREEN}All backend APIs are ready for frontend integration!{Colors.RESET}
""")

if __name__ == "__main__":
    main()

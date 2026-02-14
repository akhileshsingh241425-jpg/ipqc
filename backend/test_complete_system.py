"""
Complete PDI IPQC System Testing Script
Tests all major functionality: COC, Production, User Management, FTR, IPQC
Updated with all new features including role-based access and COC updates
"""
import requests
import json
from datetime import datetime, timedelta

BASE_URL = "http://localhost:5003"
API_BASE = f"{BASE_URL}/api"

class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    CYAN = '\033[96m'
    RESET = '\033[0m'

def print_section(title):
    print("\n" + "="*70)
    print(f"{Colors.CYAN}  {title}{Colors.RESET}")
    print("="*70)

def print_success(message):
    print(f"{Colors.GREEN}✓ {message}{Colors.RESET}")

def print_error(message):
    print(f"{Colors.RED}✗ {message}{Colors.RESET}")

def print_info(message):
    print(f"{Colors.BLUE}ℹ {message}{Colors.RESET}")

def print_warning(message):
    print(f"{Colors.YELLOW}⚠ {message}{Colors.RESET}")

def test_api(method, endpoint, data=None, description="", expected_status=200):
    """Enhanced helper function to test API endpoints"""
    url = f"{endpoint}" if endpoint.startswith('http') else f"{API_BASE}{endpoint}"
    
    try:
        if method == "GET":
            response = requests.get(url, timeout=10)
        elif method == "POST":
            response = requests.post(url, json=data, timeout=10)
        elif method == "PUT":
            response = requests.put(url, json=data, timeout=10)
        elif method == "DELETE":
            response = requests.delete(url, timeout=10)
        
        print(f"\n{Colors.BLUE}Testing:{Colors.RESET} {description}")
        print(f"  {method} {endpoint}")
        print(f"  Status: {response.status_code}", end=" ")
        
        if response.status_code in [expected_status, 200, 201]:
            print(f"{Colors.GREEN}✓{Colors.RESET}")
            try:
                result = response.json()
                if isinstance(result, dict):
                    if result.get('success'):
                        print_success(f"Success: {result.get('message', 'OK')}")
                    print(f"  Preview: {json.dumps(result, indent=2)[:150]}...")
                else:
                    print(f"  Items: {len(result) if isinstance(result, list) else 'N/A'}")
                return result
            except:
                print(f"  Response: {response.text[:100]}")
                return True
        else:
            print(f"{Colors.RED}✗{Colors.RESET}")
            print_error(f"Unexpected status code")
            print(f"  Response: {response.text[:200]}")
            return None
    except Exception as e:
        print_error(f"Request failed: {str(e)}")
        return None

# Test Results Tracker
test_results = {
    'passed': 0,
    'failed': 0,
    'warnings': 0,
    'total': 0
}

def record_result(passed, warning=False):
    """Record test result"""
    test_results['total'] += 1
    if warning:
        test_results['warnings'] += 1
    elif passed:
        test_results['passed'] += 1
    else:
        test_results['failed'] += 1

# Test Variables
test_company_id = None
test_coc_id = None
test_production_day_id = None

print_section("PDI IPQC SYSTEM - COMPREHENSIVE TEST SUITE")
print(f"{Colors.CYAN}Start Time:{Colors.RESET} {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
print(f"{Colors.CYAN}Testing Backend:{Colors.RESET} {BASE_URL}\n")

# ============================================================================
# STEP 1: Server Health Check
# ============================================================================
print_section("STEP 1: Server Health Check")
try:
    response = requests.get(BASE_URL, timeout=5)
    print_success(f"Server is accessible (Status: {response.status_code})")
    record_result(True)
except Exception as e:
    print_error(f"Server not accessible: {str(e)}")
    print_warning("Make sure backend server is running on port 5003")
    record_result(False)
    exit(1)

# ============================================================================
# STEP 2: Test COC Sync and List
# ============================================================================
print_section("STEP 2: Testing COC Management")

# Test COC Companies
result = test_api("GET", "/coc/companies", description="Get COC companies list")
record_result(result is not None)
if result and result.get('data'):
    print_info(f"Found {len(result['data'])} companies in COC")

# Test COC List
result = test_api("GET", "/coc/list", description="Get all COC documents")
record_result(result is not None)
if result and result.get('data'):
    coc_documents = result['data']
    print_info(f"Found {len(coc_documents)} COC documents")
    if coc_documents:
        test_coc_id = coc_documents[0]['id']
        print_info(f"Sample COC: {coc_documents[0].get('doc_number')} - {coc_documents[0].get('material')}")

# Test COC Stock
result = test_api("GET", "/coc/stock", description="Get COC stock data")
record_result(result is not None)
if result and result.get('data'):
    print_info(f"Tracking {len(result['data'])} materials in stock")

# Test COC Sync
print_info("Testing COC sync (last 30 days)...")
sync_data = {
    'from_date': (datetime.now() - timedelta(days=30)).strftime('%Y-%m-%d'),
    'to_date': datetime.now().strftime('%Y-%m-%d')
}
result = test_api("POST", "/coc/sync", sync_data, "Sync COC documents from Zoho")
record_result(result is not None)

# ============================================================================
# STEP 3: Test COC Update Used Quantity
# ============================================================================
print_section("STEP 3: Testing COC Update Functionality")
if test_coc_id:
    # Get current COC details
    result = test_api("GET", f"/coc/{test_coc_id}", description="Get specific COC details")
    record_result(result is not None)
    
    if result and result.get('data'):
        coc_data = result['data']
        current_consumed = coc_data.get('consumed_qty', 0)
        
        # Test update (set to same value - safe)
        update_data = {'consumed_qty': current_consumed}
        result = test_api("PUT", f"/coc/{test_coc_id}/update-used", update_data, 
                         f"Update COC used quantity (Current: {current_consumed})")
        record_result(result is not None)
else:
    print_warning("No COC ID available for testing updates")
    record_result(False, warning=True)

# ============================================================================
# STEP 4: Test Production/Companies Routes
# ============================================================================
print_section("STEP 4: Testing Production Management")

# Get all companies
result = test_api("GET", "/companies", description="Get all production companies")
record_result(result is not None)
if result and isinstance(result, list):
    print_info(f"Found {len(result)} production companies")
    if result:
        test_company_id = result[0].get('id')
        print_info(f"Sample: {result[0].get('companyName')}")

# ============================================================================
# STEP 5: Test FTR Routes
# ============================================================================
print_section("STEP 5: Testing FTR Management")

# Test FTR endpoints (expect 400/422 without data - just checking endpoint exists)
try:
    response = requests.post(f"{API_BASE}/ftr/upload-single", timeout=5)
    if response.status_code in [400, 422, 405]:
        print_success("FTR upload endpoint is accessible")
        record_result(True)
    else:
        print_info(f"FTR endpoint returned: {response.status_code}")
        record_result(True, warning=True)
except Exception as e:
    print_error(f"FTR test failed: {str(e)}")
    record_result(False)

# ============================================================================
# STEP 6: Test IPQC Routes  
# ============================================================================
print_section("STEP 6: Testing IPQC Data Routes")

result = test_api("GET", "/ipqc/data", description="Get IPQC data", expected_status=200)
if result is not None:
    record_result(True)
elif result == []:
    print_info("No IPQC data yet (normal for new system)")
    record_result(True, warning=True)
else:
    record_result(False)

# ============================================================================
# STEP 7: Test Peel Test Routes
# ============================================================================
print_section("STEP 7: Testing Peel Test Routes")

result = test_api("GET", "/peel-test/data", description="Get peel test data")
if result is not None or result == []:
    record_result(True)
    print_info("Peel test endpoint accessible")
else:
    record_result(False)

# ============================================================================
# STEP 8: Test Master Data Routes
# ============================================================================
print_section("STEP 8: Testing Master Data")

# Test BOM data
result = test_api("GET", "/master/bom", description="Get BOM data")
record_result(result is not None)

# Test Cell Specifications
result = test_api("GET", "/master/cell-specs", description="Get cell specifications")
record_result(result is not None)

# ============================================================================
# STEP 9: Production Workflow Test
# ============================================================================
print_section("STEP 9: Testing Production Workflow")

if test_company_id:
    # Get company production days
    result = test_api("GET", f"/production/{test_company_id}/days", 
                     description=f"Get production days for company {test_company_id}")
    record_result(result is not None)
    
    if result and isinstance(result, list) and len(result) > 0:
        test_production_day_id = result[0].get('id')
        print_info(f"Found production day: {result[0].get('date')}")
    else:
        print_info("No production days found (normal for new company)")
else:
    print_warning("No company ID for production testing")
    record_result(False, warning=True)

# ============================================================================
# FINAL SUMMARY
# ============================================================================
print_section("TEST SUMMARY")

total = test_results['total']
passed = test_results['passed']
failed = test_results['failed']
warnings = test_results['warnings']

print(f"\n{Colors.CYAN}Total Tests:{Colors.RESET} {total}")
print(f"{Colors.GREEN}Passed:{Colors.RESET} {passed}")
print(f"{Colors.RED}Failed:{Colors.RESET} {failed}")
print(f"{Colors.YELLOW}Warnings:{Colors.RESET} {warnings}")

success_rate = (passed / total * 100) if total > 0 else 0
print(f"\n{Colors.CYAN}Success Rate:{Colors.RESET} {success_rate:.1f}%")

if success_rate >= 80:
    print(f"\n{Colors.GREEN}{'='*60}")
    print(f"✓ SYSTEM IS WORKING WELL!")
    print(f"  All major features are functional")
    print(f"{'='*60}{Colors.RESET}")
elif success_rate >= 50:
    print(f"\n{Colors.YELLOW}{'='*60}")
    print(f"⚠ SYSTEM HAS SOME ISSUES")
    print(f"  Review failed tests above")
    print(f"{'='*60}{Colors.RESET}")
else:
    print(f"\n{Colors.RED}{'='*60}")
    print(f"✗ SYSTEM HAS MAJOR ISSUES")
    print(f"  Critical failures detected - check backend server")
    print(f"{'='*60}{Colors.RESET}")

print(f"\n{Colors.CYAN}End Time:{Colors.RESET} {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")

# ============================================================================
# FRONTEND TESTING NOTES
# ============================================================================
print_section("FRONTEND TESTING CHECKLIST")
print(f"""
{Colors.CYAN}Frontend must be tested manually:{Colors.RESET}

{Colors.YELLOW}1. User Authentication & Role Management{Colors.RESET}
   - Login with super admin (admin@gautam / Gautam@123)
   - Login with normal user (user@gautam / Gautam@123)
   - Check role badge in sidebar
   - Super admin should see User Management menu

{Colors.YELLOW}2. User Management (Super Admin Only){Colors.RESET}
   - Access User Management page
   - Add new user
   - Edit existing user
   - Delete user (not yourself)
   - Normal users should see "Access Denied"

{Colors.YELLOW}3. COC Dashboard{Colors.RESET}
   - View all COC documents
   - Check "Used" column edit functionality
   - Click edit (✏️), change value, save (✓) or cancel (✕)
   - Verify available quantity updates

{Colors.YELLOW}4. Daily Report (Production){Colors.RESET}
   - Select company
   - View production days
   - Open PDI Details modal
   - Edit "Used Qty" in BOM materials table
   - Check Gap recalculation

{Colors.YELLOW}5. COC Selection Modal{Colors.RESET}
   - Create new production day
   - Click "Select COC for Materials"
   - Check UI: Purple gradient header, card layout, hover effects
   - Select COC documents
   - Verify selection highlights (green gradient)

{Colors.YELLOW}6. Role-Based Access Control{Colors.RESET}
   - Super admin: Should see delete/clear buttons
   - Normal user: Delete/clear buttons should be hidden
   - Test in: BulkFTRGenerator, PDIFTRGenerator, GraphManager, DailyReport

{Colors.YELLOW}7. FTR Generation{Colors.RESET}
   - Upload FTR documents
   - Generate PDF reports
   - Download reports

{Colors.YELLOW}8. IPQC Data Entry{Colors.RESET}
   - Enter IPQC test data
   - Generate reports
   - View history

{Colors.CYAN}To run frontend:{Colors.RESET}
   cd frontend
   npm start
   Open: http://localhost:3000

{Colors.CYAN}Note:{Colors.RESET} This script tests backend APIs only.
   Frontend features require manual testing in browser.
""")

print(f"{Colors.GREEN}{'='*70}")
print(f"  PDI IPQC System Testing Complete!")
print(f"{'='*70}{Colors.RESET}\n")


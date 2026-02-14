"""
IPQC Form Generator Service
Auto-fills IPQC forms based on BOM and customer data
"""
import random
from app.models.ipqc_data import IPQCTemplate, BOMData


class IPQCFormGenerator:
    """Intelligent IPQC form generation with auto-fill capabilities"""
    
    def __init__(self):
        self.template = IPQCTemplate.get_template()
    
    def generate_form(self, date, shift, customer_id, po_number, serial_prefix='GS04875KG302250', serial_start=1, module_count=1, cell_manufacturer='Solar Space', cell_efficiency=25.7, jb_cable_length=1200, golden_module_number='GM-2024-001'):
        """
        Generate complete IPQC form with auto-filled values
        
        Args:
            date: Date of inspection
            shift: Shift (A/B/C)
            customer_id: Customer/Document ID
            po_number: Purchase Order number
            serial_prefix: Fixed 14-digit prefix for serial numbers
            serial_start: Starting counter (last 5 digits, 1-99999)
            module_count: Number of modules in this batch
            cell_manufacturer: Cell manufacturer name
            cell_efficiency: Cell efficiency percentage
            jb_cable_length: Junction box cable length in mm
            golden_module_number: Golden/Silver module reference number
        
        Returns:
            dict: Complete IPQC form data
        """
        # Get customer BOM
        bom = BOMData.get_bom(customer_id)
        if not bom:
            bom = self._get_default_bom()
        
        # Auto-fill all stages
        filled_stages = []
        for stage in self.template:
            filled_stage = self._fill_stage(stage, bom, serial_prefix, serial_start, cell_manufacturer, cell_efficiency, jb_cable_length, golden_module_number)
            filled_stages.append(filled_stage)
        
        # Generate full serial numbers
        full_serials = [f"{serial_prefix}{str(serial_start + i).zfill(5)}" for i in range(module_count)]
        
        # Generate metadata
        metadata = {
            "date": date,
            "shift": shift,
            "customer_id": customer_id,
            "customer_name": bom.get("customer_name", ""),
            "po_number": po_number,
            "doc_number": customer_id,
            "issue_date": "01/12/2024",
            "revision": "01/30-08-2025",
            "serial_prefix": serial_prefix,
            "serial_start": serial_start,
            "serial_numbers": full_serials,
            "module_count": module_count,
            "cell_manufacturer": cell_manufacturer,
            "cell_efficiency": cell_efficiency,
            "jb_cable_length": jb_cable_length,
            "golden_module_number": golden_module_number
        }
        
        return {
            "metadata": metadata,
            "bom": bom,
            "stages": filled_stages,
            "total_stages": len(filled_stages),
            "total_checkpoints": sum(len(s.get('checkpoints', [])) for s in filled_stages)
        }
    
    def _fill_stage(self, stage, bom, serial_prefix='GS04875KG302250', serial_start=1, cell_manufacturer='Solar Space', cell_efficiency=25.7, jb_cable_length=1200, golden_module_number='GM-2024-001'):
        """Auto-fill a stage based on BOM data"""
        filled_stage = {
            "sr_no": stage.get("sr_no"),
            "stage": stage.get("stage"),
            "checkpoints": []
        }
        
        for checkpoint in stage.get("checkpoints", []):
            filled_checkpoint = checkpoint.copy()
            
            # Auto-fill monitoring result based on checkpoint type
            monitoring_result = self._get_realistic_monitoring_result(checkpoint, stage.get("stage"), serial_prefix, serial_start, cell_manufacturer, cell_efficiency, jb_cable_length, golden_module_number)
            filled_checkpoint["monitoring_result"] = monitoring_result
            
            # Generate appropriate remarks
            remarks = self._get_checkpoint_remarks(checkpoint, stage.get("stage"), monitoring_result)
            filled_checkpoint["remarks"] = remarks
            
            filled_stage["checkpoints"].append(filled_checkpoint)
        
        return filled_stage
    
    def _get_realistic_monitoring_result(self, checkpoint, stage_name, serial_prefix='GS04875KG302250', serial_start=1, cell_manufacturer='Solar Space', cell_efficiency=25.7, jb_cable_length=1200, golden_module_number='GM-2024-001'):
        """Get realistic monitoring results matching actual IPQC format with RANDOM VALUES within tolerance"""
        checkpoint_name = checkpoint.get("checkpoint", "").lower()
        acceptance = checkpoint.get("acceptance_criteria", "").lower()
        sample_size = checkpoint.get("sample_size", "")
        
        # ========== PRIORITY CHECKS - Check these FIRST to avoid generic matches ==========
        
        # Cell to Cell Gap - MUST check before any generic conditions
        if "cell to cell gap" in checkpoint_name:
            ts_count = random.randint(6, 8)
            ts_values = []
            for i in range(ts_count):
                row = (i // 2) + 1
                side = "A" if i % 2 == 0 else "B"
                gap_val = round(random.uniform(0.73, 0.81), 2)  # 0.6-0.9mm range
                ts_values.append(f"TS0{row}{side}: {gap_val}mm")
            return ", ".join(ts_values)
        
        # String to String Gap - Show actual gap values
        if "string to string gap" in checkpoint_name:
            gap_val = round(random.uniform(2.0, 3.5), 2)  # 2-3.5mm typical
            return f"{gap_val}mm"
        
        # Helper function to generate random value within tolerance
        def random_in_range(base, tolerance):
            """Generate random value within base ± tolerance"""
            return round(base + random.uniform(-abs(tolerance), abs(tolerance)), 2)
        
        # Helper function to generate serial numbers (Full 19-digit format)
        def generate_serial_numbers(start_counter, count=5):
            """Generate random serial numbers from range - full 19-digit format"""
            # Generate 5 random serial numbers within range
            # Use serial_start counter (1-99999) and add random offset
            base_counter = start_counter if isinstance(start_counter, int) else 1
            serial_range = list(range(base_counter, min(base_counter + 100, 99999)))
            selected = random.sample(serial_range, min(count, len(serial_range)))
            selected.sort()
            
            # Generate full 19-digit serial numbers: prefix (14 digits) + counter (5 digits)
            full_serials = [f"{serial_prefix}{str(num).zfill(5)}" for num in selected]
            
            # Return as comma-separated string for compact display
            return "S.No: " + ", ".join(full_serials)
        
        # ========== STAGE 1: Shop Floor Environment ==========
        if "temperature" in checkpoint_name and "shop floor" in stage_name.lower():
            temp = random_in_range(25, 2.0)  # 25°C ± 3°C (use 2.0 for better distribution)
            return f"{temp}°C"
        if "humidity" in checkpoint_name and "shop floor" in stage_name.lower():
            humidity = random.randint(40, 58)  # 0-60% RH
            return f"{humidity}% RH"
        
        # ========== STAGE 2: Glass Dimension ==========
        if "glass dimension" in checkpoint_name or ("length" in checkpoint_name and "glass" in stage_name.lower()):
            length = random_in_range(2376, 0.8)  # 2376mm ± 1mm
            width = random_in_range(1128, 0.8)   # 1128mm ± 1mm
            thickness = random_in_range(2.00, 0.04)  # 2.00mm ± 0.05mm
            return f"{length}mm x {width}mm x {thickness}mm"
        
        # ========== STAGE 3: Glass Visual ==========
        if "appearance" in checkpoint_name and "visual" in checkpoint_name:
            return random.choice(["No Scratches/Cracks", "Clear Surface", "No Defects Found"])
        if "crack" in checkpoint_name or "scratch" in checkpoint_name:
            return "None Detected"
        if "edge chip" in checkpoint_name:
            chip_size = round(random.uniform(0, 0.8), 1)
            return f"{chip_size}mm"
        
        # ========== STAGE 4: EVA/EPE Type ==========
        if "eva/epe type" in checkpoint_name or "eva type" in checkpoint_name or "material" in checkpoint_name:
            return "EPE304"
        
        # ========== STAGE 5: EVA/EPE Dimension ==========
        if "eva" in checkpoint_name and "dimension" in checkpoint_name:
            eva_length = random_in_range(2378, 0.8)  # 2378mm ± 1mm
            eva_width = random_in_range(1125, 0.8)   # 1125mm ± 1mm
            eva_thick = random_in_range(0.696, 0.025)  # 0.696mm ± 0.03mm
            return f"{eva_length}mm x {eva_width}mm x {eva_thick}mm"
        
        # ========== STAGE 6: EVA/EPE Visual ==========
        if "eva" in checkpoint_name and ("status" in checkpoint_name or "visual" in checkpoint_name):
            return random.choice(["No Damage", "Clean Surface", "Uniform Embossing"])
        if "dust" in checkpoint_name and "eva" in stage_name.lower():
            return "No Particles"
        if "embossing" in checkpoint_name:
            return "Uniform Pattern"
        
        # ========== STAGE 7: Soldering Temperature ==========
        if "soldering temperature" in checkpoint_name or "solder temp" in checkpoint_name:
            temp = random_in_range(400, 20)  # 400°C ± 30°C tolerance
            return f"{temp}°C"
        
        # ========== STAGE 8: Cell Details ==========
        if "cell manufacturer" in checkpoint_name or ("manufacturer" in checkpoint_name and "cell" in stage_name.lower()):
            return cell_manufacturer
        if "efficiency" in checkpoint_name and "cell" in stage_name.lower():
            return f"{cell_efficiency}%"
        
        # ========== STAGE 9: Cell Size (with thickness) ==========
        if "cell size" in checkpoint_name or ("cell" in stage_name.lower() and "dimension" in checkpoint_name):
            cell_l = random_in_range(182.53, 0.15)  # 182.53mm ± 0.2mm
            cell_w = random_in_range(105.04, 0.15)  # 105.04mm ± 0.2mm
            cell_t = random_in_range(0.18, 0.02)  # ~180 microns (0.18mm) ± 0.02mm
            return f"{cell_l}mm x {cell_w}mm x {cell_t}mm (L x W x T)"
        
        # ========== STAGE 10: Cell Visual ==========
        if "cell condition" in checkpoint_name or ("cell" in stage_name.lower() and "visual" in checkpoint_name):
            return random.choice(["No Damage/Cracks", "EL Test Pass", "Clean - No Defects"])
        if "cleanliness" in checkpoint_name and "cell" in stage_name.lower():
            return "Clean Surface"
        if "dust" in checkpoint_name and "cell" in checkpoint_name:
            return "No Dust"
        if "microcrack" in checkpoint_name or "cell crack" in checkpoint_name:
            return "EL Test: No Microcracks"
        
        # ========== STAGE 11-12: Stringing Area & Stringer Parameters ==========
        if "clean area" in checkpoint_name or "cleanliness" in checkpoint_name:
            return random.choice(["CLEAN - No Waste", "CLEAN Area", "Clean & Ready"])
        if "alignment" in checkpoint_name and "stringer" in stage_name.lower():
            return "Camera Check"
        if "ribbon lay" in checkpoint_name:
            return "Straight - No Shift"
        
        # ========== STAGE 13: Cell Crosscut ==========
        if "cell cross cutting" in checkpoint_name or "crosscut" in checkpoint_name:
            crosscut = random_in_range(0, 0.08)  # 0mm ± 0.10mm
            return f"{crosscut}mm"
        
        # ========== STAGE 14: String Visual ==========
        if "visual check after stringing" in checkpoint_name or ("string" in stage_name.lower() and "visual" in checkpoint_name):
            # Format: Horizontal comma-separated list for compact display
            ts_count = random.randint(6, 8)
            ts_values = []
            for i in range(ts_count):
                row = (i // 2) + 1  # TS01, TS02, TS03, TS04
                side = "A" if i % 2 == 0 else "B"
                ts_values.append(f"TS0{row}{side}: OK")
            return ", ".join(ts_values)
        if "ribbon alignment" in checkpoint_name:
            return "Straight"
        if "solder quality" in checkpoint_name or "soldering quality" in checkpoint_name:
            # 3 times result
            return "OK, OK, OK"
        
        # ========== STAGE 15: String EL ==========
        if "el image" in checkpoint_name or ("string" in stage_name.lower() and "el" in checkpoint_name):
            # Format: Horizontal comma-separated list for compact display
            ts_count = random.randint(6, 8)
            ts_values = []
            for i in range(ts_count):
                row = (i // 2) + 1  # TS01, TS02, TS03, TS04
                side = "A" if i % 2 == 0 else "B"
                ts_values.append(f"TS0{row}{side}: OK")
            return ", ".join(ts_values)
        if "microcrack" in checkpoint_name and "string" in stage_name.lower():
            return "None Detected"
        if "dark cell" in checkpoint_name:
            return "None"
        
        # ========== STAGE 16: String Length ==========
        if "string length" in checkpoint_name:
            # Format: Horizontal comma-separated list for compact display
            ts_count = random.randint(6, 8)
            ts_values = []
            for i in range(ts_count):
                row = (i // 2) + 1  # TS01, TS02, TS03, TS04
                side = "A" if i % 2 == 0 else "B"
                length = random_in_range(1163, 0.8)  # 1163mm ± 1mm
                ts_values.append(f"TS0{row}{side}: {length:.1f}mm")
            return ", ".join(ts_values)
        
        # ========== STAGE 18: Peel Strength (Cell-Ribbon) ==========
        if "peel strength" in checkpoint_name and "cell" in checkpoint_name:
            test1 = random_in_range(21, 0.8)  # ≥21N ± 1N
            test2 = random_in_range(21, 0.8)
            test3 = random_in_range(21, 0.8)
            return f"Test1: {test1}N | Test2: {test2}N | Test3: {test3}N"
        
        # ========== STAGE 19: Peel Strength (Ribbon-Busbar) ==========
        if "ribbon to busbar" in checkpoint_name or ("busbar" in checkpoint_name and "peel" in checkpoint_name):
            peel = round(random.uniform(2.5, 4.5), 2)  # ≥2N
            return f"{peel}"
        
        # ========== Cell edge to Glass edge distance ==========
        if "cell edge to glass edge" in checkpoint_name:
            top = round(random.uniform(19.5, 19.9), 2)  # ~19.72mm
            bottom = round(random.uniform(18.6, 19.0), 2)  # ~18.82mm
            sides = round(random.uniform(13.1, 13.3), 2)  # ~13.211mm
            return f"Top: {top}mm, Bottom: {bottom}mm, Sides: {sides}mm"
        
        # ========== STAGE 20: Creepage Distance ==========
        if "creepage" in checkpoint_name or ("distance" in checkpoint_name and "creepage" in stage_name.lower()):
            # 3 readings for Top and Bottom
            top1 = round(random.uniform(11.6, 11.9), 2)
            top2 = round(random.uniform(11.6, 11.9), 2)
            top3 = round(random.uniform(11.6, 11.9), 2)
            bottom1 = round(random.uniform(11.5, 11.8), 2)
            bottom2 = round(random.uniform(11.5, 11.8), 2)
            bottom3 = round(random.uniform(11.5, 11.8), 2)
            return f"Top: {top1}mm, {top2}mm, {top3}mm | Bottom: {bottom1}mm, {bottom2}mm, {bottom3}mm"
        
        # ========== STAGE 21: Auto Bussing ==========
        if "verification of process parameter" in checkpoint_name:
            return "Verify"
        if "auto bussing" in checkpoint_name:
            return random.choice(["Auto Bussing", "Taping Proper", "No Shift"])
        if "taping" in checkpoint_name and "quality" in checkpoint_name:
            # 3 times result
            return "Proper, Proper, Proper"
        if "taping" in checkpoint_name:
            return "Proper"
        if "ribbon lay" in checkpoint_name and "bussing" in stage_name.lower():
            return "No Shift"
        
        # ========== STAGE 22: Label/RFID Position ==========
        if "rfid position" in checkpoint_name or ("rfid" in checkpoint_name and "position" in checkpoint_name):
            # 3 readings
            return "Center, Center, Center"
        if "re-label" in checkpoint_name or "relabel" in checkpoint_name:
            serials = generate_serial_numbers(serial_start, 5)
            return serials + " - Found OK"
        if "label" in checkpoint_name or "rfid" in checkpoint_name:
            tilt = random_in_range(0, 0.8)  # 0mm ± 1mm
            return f"Tilt: {tilt}mm"
        
        # ========== No. of Holes ==========
        if "holes" in checkpoint_name and ("no." in checkpoint_name or "number" in checkpoint_name or "dimension" in checkpoint_name):
            hole1 = round(random.uniform(11.8, 12.2), 2)
            hole2 = round(random.uniform(11.8, 12.2), 2)
            hole3 = round(random.uniform(11.8, 12.2), 2)
            return f"3 holes: {hole1}mm, {hole2}mm, {hole3}mm"
        
        # ========== STAGE 23: Back Glass Dimension ==========
        if "back glass" in checkpoint_name or ("glass" in checkpoint_name and "back" in stage_name.lower()):
            bg_l = random_in_range(2376, 0.8)
            bg_w = random_in_range(1128, 0.8)
            bg_t = random_in_range(2.00, 0.04)
            return f"{bg_l}mm x {bg_w}mm x {bg_t}mm"
        
        # ========== STAGE 24: Pre-Lam EL ==========
        if "pre-lam" in checkpoint_name and "el" in checkpoint_name:
            # Generate 5 random serial numbers matching image format
            if "5 pieces" in sample_size or "5 pcs" in sample_size:
                serial_nums = generate_serial_numbers(serial_start, 5)
                return serial_nums
            return "EL Test: 5 pcs - No Defects"
        
        # ========== STAGE 25: Pre-Lam Visual ==========
        if "pre-lam" in checkpoint_name and "visual" in checkpoint_name:
            # Same serial numbers format for visual inspection
            if "5 pieces" in sample_size or "5 pcs" in sample_size:
                serial_nums = generate_serial_numbers(serial_start, 5)
                return serial_nums
            return random.choice(["No Bubble/Tilt", "Visual Pass", "Quality Good"])
        if "bubble" in checkpoint_name:
            return "None Detected"
        if "tilt" in checkpoint_name and "pre-lam" in stage_name.lower():
            return "No Tilt"
        
        # ========== Curing Time ==========
        if "curing time" in checkpoint_name:
            hours = round(random.uniform(4.5, 6.0), 1)
            return f">4 hr ({hours} hr)"
        
        # ========== STAGE 26: Laminator Parameters ==========
        if "lamination temperature" in checkpoint_name or ("laminator" in stage_name.lower() and "temp" in checkpoint_name):
            temp = random_in_range(149, 3)  # As per WI, ~149°C
            return f"Temp: {temp}°C"
        if "vacuum" in checkpoint_name and "laminator" in stage_name.lower():
            vacuum = random.randint(98, 100)  # 100% vacuum
            return f"Vacuum: {vacuum}%"
        if "lamination time" in checkpoint_name:
            time_min = random.randint(11, 13)
            return f"Time: {time_min} min"
        if "lamination pressure" in checkpoint_name:
            return "Pressure: As per WI"
        
        # ========== OLE Potting Visual Check ==========
        if "ole" in stage_name.lower() and "visual" in checkpoint_name:
            serials = generate_serial_numbers(serial_start, 5)
            return serials + " - OK"
        
        # ========== STAGE 27: Diaphragm Cleaning ==========
        if "diaphragm" in checkpoint_name or "cleaning" in checkpoint_name:
            return random.choice(["CLEAN - No EVA Residue", "Clean Surface", "No Residue - CLEAN"])
        
        # ========== Buffing Corner Edge ==========
        if "buffing" in checkpoint_name or ("corner edge" in checkpoint_name and "buffing" in stage_name.lower()):
            serials = generate_serial_numbers(serial_start, 5)
            return serials + " - OK"
        
        # ========== STAGE 28: Trimming ==========
        if "trimming" in checkpoint_name or "trim" in checkpoint_name:
            trim = random_in_range(0, 0.8)  # ±1mm
            return f"Even Trim: {trim}mm deviation"
        
        # ========== Soldering Current ==========
        if "soldering current" in checkpoint_name:
            current = round(random.uniform(18.5, 21.5), 1)
            return f"{current}A"
        
        # ========== Terminal busbar to edge of Cell ==========
        if "terminal busbar to edge" in checkpoint_name or ("busbar to edge" in checkpoint_name and "cell" in checkpoint_name):
            edge_dist = round(random.uniform(5.0, 7.0), 2)
            return f"{edge_dist}mm"
        
        # ========== STAGE 29: JB Fixing ==========
        if "jb fixing" in checkpoint_name or "junction box" in checkpoint_name:
            position = random_in_range(0, 0.8)  # ±1mm
            return f"JB Position: {position}mm shift"
        
        # ========== Glue Weight (Short/Long Side) ==========
        if "glue weight" in checkpoint_name:
            return "Refer Document GSPL/IPQC/QC/011"
        
        # ========== Anodizing Thickness ==========
        if "anodizing thickness" in checkpoint_name:
            thickness = round(random.uniform(15.5, 18.0), 1)
            return f">15 micron ({thickness} micron)"
        
        # ========== STAGE 30: Potting Weight ==========
        if "potting material weight" in checkpoint_name:
            weight = random_in_range(21, 4)  # 21g ± 6g
            return f"{weight}g"
        if "potting" in checkpoint_name and "weight" in checkpoint_name:
            weight = random_in_range(21, 5)  # 21g ± 6g
            return f"Potting Weight: {weight}g"
        
        # ========== Junction Box Position and Cable ==========
        if "junction box" in checkpoint_name and ("connector" in checkpoint_name or "appearance" in checkpoint_name or "cable" in checkpoint_name):
            cable = round(random.uniform(1180, 1200), 1)
            return f"Cable Length: {cable}mm"
        
        # ========== STAGE 31: Cable Length ==========
        if "cable length" in checkpoint_name:
            return f"{jb_cable_length}mm"
        
        # ========== STAGE 32: Flash Test ==========
        if "flash test" in checkpoint_name or "sun simulator" in checkpoint_name:
            pmax = random_in_range(625, 2.5)  # 625W ± 3W
            voc = random_in_range(44.8, 0.3)   # As per datasheet
            isc = random_in_range(13.21, 0.15)  # As per datasheet
            ff = random_in_range(78.4, 0.8)    # As per datasheet
            return f"Pmax: {pmax}W | Voc: {voc}V | Isc: {isc}A | FF: {ff}%"
        if "pmax" in checkpoint_name or "power" in checkpoint_name:
            pmax = random_in_range(625, 2.5)
            return f"Pmax: {pmax}W"
        if "voc" in checkpoint_name:
            voc = random_in_range(44.8, 0.3)
            return f"Voc: {voc}V"
        if "isc" in checkpoint_name and "calibration" in checkpoint_name:
            isc = random_in_range(13.21, 0.15)
            return f"Isc: {isc}A, Golden Module: {golden_module_number}"
        if "isc" in checkpoint_name:
            isc = random_in_range(13.21, 0.15)
            return f"Isc: {isc}A"
        if "verification of current" in checkpoint_name or "dc power supply" in checkpoint_name:
            voltage = round(random.uniform(48.5, 49.5), 2)
            current = round(random.uniform(5.2, 5.6), 3)
            return f"{voltage}V, {current}A"
        if "ff" in checkpoint_name or "fill factor" in checkpoint_name:
            ff = random_in_range(78.4, 0.8)
            return f"FF: {ff}%"
        if "i-v picture" in checkpoint_name or "i-v check" in checkpoint_name or ("silver reference" in checkpoint_name and "iv" in checkpoint_name):
            return "EL - OK"
        
        # ========== Hipot Test - DCW/IR/Ground Continuity ==========
        if "dcw" in checkpoint_name or "ground continuity" in checkpoint_name or ("hipot" in stage_name.lower() and "ir" in checkpoint_name):
            # Generate 5 serial numbers with their test values
            serials_list = []
            for i in range(5):
                base_counter = serial_start + random.randint(1, 95)
                serial = f"{serial_prefix}{str(base_counter).zfill(5)}"
                dcw = round(random.uniform(10, 35), 1)
                ir_val = round(random.uniform(50, 120), 1)
                ground = round(random.uniform(15, 45), 1)
                serials_list.append(f"{serial}: DCW={dcw}µA, IR={ir_val}MΩ, GND={ground}mΩ")
            return " | ".join(serials_list)
        
        # ========== STAGE 33: Final Visual ==========
        if "final visual" in checkpoint_name or "final inspection" in checkpoint_name:
            return random.choice(["PASS", "Clear", "No Scratch/Dust/Bubble"])
        
        # ========== Dimension Measurements ==========
        if "l*w and module profile" in checkpoint_name or ("module profile" in checkpoint_name and "l*w" in checkpoint_name):
            return "2382mm x 1134mm x 30mm"
        if "mounting hole" in checkpoint_name and ("x & y" in checkpoint_name or "h/l" in checkpoint_name):
            return "1400mm x 1091mm"
        if "diagonal difference" in checkpoint_name:
            diag = round(random.uniform(1.8, 2.2), 1)
            return f"{diag}mm"
        if "corner gap" in checkpoint_name:
            gap = round(random.uniform(0.01, 0.03), 2)
            return f"{gap}mm"
        if "wooden pallet dimension" in checkpoint_name:
            return "2386mm x 1019mm x 146mm"
        
        # ========== Generic Checks ==========
        # Reference to documents/specs
        if "refer process card" in acceptance:
            return "Refer Process Card"
        if "module drawing" in acceptance:
            return "Refer Module Drawing"
        if "gspl" in acceptance and ("qc" in acceptance or "ipqc" in acceptance):
            return "Refer Document GSPL/IPQC/QC/001"
        
        # Visual inspection with sample size
        if checkpoint.get("sample_size") == "5 pieces":
            serial_nums = generate_serial_numbers(serial_start, 5)
            # Add OK or Found OK for visual inspections
            if "visual" in checkpoint_name or "inspection" in checkpoint_name:
                return serial_nums + " - Found OK"
            return serial_nums
        
        # Temperature/Humidity monitoring
        if "temp" in checkpoint_name:
            temp = random_in_range(25, 2.5)
            return f"Time: 08:00 - Temp: {temp}°C"
        if "humidity" in checkpoint_name:
            humidity = random.randint(40, 58)
            return f"Time: 08:00 - RH: {humidity}%"
        
        # Default for simple yes/no checks
        if acceptance in ["ok", "pass", "yes", "acceptable"]:
            return "Pass"
        
        # Default monitoring result
        return "As per spec"
    
    def _get_checkpoint_remarks(self, checkpoint, stage_name, monitoring_result):
        """Generate appropriate remarks based on checkpoint and result"""
        checkpoint_name = checkpoint.get("checkpoint", "").lower()
        
        # Temperature/Humidity checks
        if "temperature" in checkpoint_name:
            return random.choice(["Stable", "Within Limit", "OK", "Controlled"])
        if "humidity" in checkpoint_name:
            return random.choice(["Within Limit", "OK", "Acceptable", "Stable"])
        
        # Dimension checks
        if "dimension" in checkpoint_name or "length" in checkpoint_name or "width" in checkpoint_name:
            return random.choice(["Match PO", "As per spec", "OK", "Within tolerance", "—"])
        
        # Visual checks
        if "visual" in checkpoint_name or "appearance" in checkpoint_name:
            return random.choice(["Clear", "Good", "Pass", "OK", "No defects"])
        
        # EL Test
        if "el" in checkpoint_name:
            return random.choice(["Pass", "OK", "No defects", "Clear"])
        
        # Material/Type verification
        if "type" in checkpoint_name or "material" in checkpoint_name:
            return random.choice(["Verified", "OK", "Confirmed", "As per BOM"])
        
        # Cleanliness
        if "clean" in checkpoint_name or "dust" in checkpoint_name:
            return random.choice(["Clean", "OK", "Good", "No contamination"])
        
        # Strength/Force tests
        if "peel" in checkpoint_name or "strength" in checkpoint_name:
            return random.choice(["Pass", "OK", "Within spec", "Acceptable"])
        
        # Gap measurements - NO "OK", only tolerance remarks
        if "gap" in checkpoint_name:
            return random.choice(["Within tolerance", "As per spec", "Acceptable", "—"])
        
        # Flash/Power tests
        if "flash" in checkpoint_name or "power" in checkpoint_name:
            return random.choice(["Pass", "OK", "Within spec", "Acceptable"])
        
        # Default remarks
        return random.choice(["OK", "Pass", "—", "Good", "Acceptable"])
    
    def _get_default_bom(self):
        """Return default BOM if customer BOM not found"""
        return {
            "customer_name": "Gautam Solar Private Limited",
            "module_type": "Mono PERC",
            "power_rating": "550W",
            "cells": {
                "count": 144,
                "type": "M10",
                "size": "182mm"
            },
            "module_dimension": {
                "length": 2278,
                "width": 1134,
                "thickness": 35
            }
        }
    
    def upload_bom(self, customer_id, bom_data):
        """
        Upload and store new customer BOM
        
        Args:
            customer_id: Customer identifier
            bom_data: BOM data dictionary
        
        Returns:
            bool: Success status
        """
        return BOMData.add_bom(customer_id, bom_data)

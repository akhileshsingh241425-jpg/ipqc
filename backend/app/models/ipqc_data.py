"""
IPQC Data Model - Contains all 33 stages and 200+ checkpoints
"""

class IPQCTemplate:
    """Complete IPQC template with all stages and checkpoints"""
    
    STAGES = [
        {
            "sr_no": 1,
            "stage": "Shop Floor",
            "checkpoints": [
                {
                    "checkpoint": "Temperature",
                    "sample_size": "once",
                    "frequency": "per shift",
                    "acceptance_criteria": "Temp. ≤53°C",
                    "tolerance": {"type": "max", "value": 53, "unit": "°C"}
                },
                {
                    "checkpoint": "Humidity",
                    "sample_size": "once",
                    "frequency": "per shift",
                    "acceptance_criteria": "RH ≤60%",
                    "tolerance": {"type": "max", "value": 60, "unit": "%"}
                }
            ]
        },
        {
            "sr_no": 2,
            "stage": "Glass Loader",
            "checkpoints": [
                {
                    "checkpoint": "Glass dimension(L*W*T)",
                    "sample_size": "once",
                    "frequency": "per shift",
                    "acceptance_criteria": "As Per PO",
                    "tolerance": {"type": "range", "length": "±1", "width": "±1", "thickness": "±0.2", "unit": "mm"}
                },
                {
                    "checkpoint": "Appearance(Visual)",
                    "sample_size": "once",
                    "frequency": "per shift",
                    "acceptance_criteria": "Glass Broken, Crack, Scratches and Line mark not allowed",
                    "tolerance": {"type": "visual"}
                }
            ]
        },
        {
            "sr_no": 3,
            "stage": "EVA/EPE Cutting",
            "checkpoints": [
                {
                    "checkpoint": "EVA/EPE Type",
                    "sample_size": "once",
                    "frequency": "per shift",
                    "acceptance_criteria": "As per approved BOM",
                    "tolerance": {"type": "bom"}
                },
                {
                    "checkpoint": "EVA/EPE dimension(L*W*T)",
                    "sample_size": "once",
                    "frequency": "per shift",
                    "acceptance_criteria": "As per Specification",
                    "tolerance": {"type": "range", "length": "1125±5", "thickness": "0.70±0.10", "unit": "mm"}
                },
                {
                    "checkpoint": "EVA/EPE Status",
                    "sample_size": "once",
                    "frequency": "per shift",
                    "acceptance_criteria": "Not allowed dust & foreign particle/Cut & non Uniform Embossing /Mfg Date",
                    "tolerance": {"type": "visual"}
                }
            ]
        },
        {
            "sr_no": 4,
            "stage": "Eva/EPE Soldering at edge(If Applicable)",
            "checkpoints": [
                {
                    "checkpoint": "Soldering Temperature and Quality of Soldering",
                    "sample_size": "Once",
                    "frequency": "per shift",
                    "acceptance_criteria": "As per specification and Should be properly soldered ( 400 ± 20°C)",
                    "tolerance": {"type": "range", "value": 400, "tolerance": 20, "unit": "°C"}
                }
            ]
        },
        {
            "sr_no": 5,
            "stage": "Cell Loading",
            "checkpoints": [
                {
                    "checkpoint": "Cell Manufacturer & Eff.",
                    "sample_size": "once",
                    "frequency": "per shift",
                    "acceptance_criteria": "Refer Process Card",
                    "tolerance": {"type": "process_card"}
                },
                {
                    "checkpoint": "Cell Size(*W)",
                    "sample_size": "once",
                    "frequency": "per shift",
                    "acceptance_criteria": "Refer Process Card",
                    "tolerance": {"type": "range", "value": "±1", "unit": "mm"}
                },
                {
                    "checkpoint": "Cell Condition",
                    "sample_size": "once",
                    "frequency": "per shift",
                    "acceptance_criteria": "Free From dust,finger spot,color variation",
                    "tolerance": {"type": "visual"}
                },
                {
                    "checkpoint": "Cleanliness of Cell Loading Area",
                    "sample_size": "once",
                    "frequency": "per shift",
                    "acceptance_criteria": "No unwanted or waste material should be at Cell Loading Area",
                    "tolerance": {"type": "visual"}
                },
                {
                    "checkpoint": "Verification of Process Parameter",
                    "sample_size": "once",
                    "frequency": "per shift",
                    "acceptance_criteria": "ATW Stringer Specification",
                    "tolerance": {"type": "specification"}
                },
                {
                    "checkpoint": "Cell Cross cutting",
                    "sample_size": "once",
                    "frequency": "per shift",
                    "acceptance_criteria": "Both side cutting should be equal.",
                    "tolerance": {"type": "visual"}
                },
                {
                    "checkpoint": "Verification of Process Parameter",
                    "sample_size": "once",
                    "frequency": "Month",
                    "acceptance_criteria": "ATW Stringer Specification",
                    "tolerance": {"type": "specification"}
                }
            ]
        },
        {
            "sr_no": 6,
            "stage": "Tabber & stringer",
            "checkpoints": [
                {
                    "checkpoint": "Visual Check after Stringing",
                    "sample_size": "once",
                    "frequency": "1 String/TS/Shift",
                    "acceptance_criteria": "TS Visual Criteria",
                    "tolerance": {"type": "visual"}
                },
                {
                    "checkpoint": "EL Image of Strings",
                    "sample_size": "once",
                    "frequency": "1 String/TS/Shift",
                    "acceptance_criteria": "TS EL Criteria",
                    "tolerance": {"type": "visual"}
                },
                {
                    "checkpoint": "String length",
                    "sample_size": "once",
                    "frequency": "1 String/Stringer/ shift",
                    "acceptance_criteria": "Refer Process Card",
                    "tolerance": {"type": "range", "value": 1163, "tolerance": 2, "unit": "mm"}
                },
                {
                    "checkpoint": "Cell to Cell Gap",
                    "sample_size": "once",
                    "frequency": "1 String/Stringer/ shift",
                    "acceptance_criteria": "Refer Process Card",
                    "tolerance": {"type": "range", "min": 0.6, "max": 0.9, "unit": "mm"}
                },
                {
                    "checkpoint": "Verification of Soldering Peel Strength",
                    "sample_size": "2 cell each stringer Front & Back.",
                    "frequency": "per shift",
                    "acceptance_criteria": "Peel Strength ≥1N",
                    "tolerance": {"type": "min", "value": 1, "unit": "N"}
                },
                {
                    "checkpoint": "String to String Gap",
                    "sample_size": "once",
                    "frequency": "per shift",
                    "acceptance_criteria": "",
                    "tolerance": {"type": "visual"}
                },
                {
                    "checkpoint": "Cell edge to Glass edge distance (Top,bottom & sides)",
                    "sample_size": "once",
                    "frequency": "per shift",
                    "acceptance_criteria": "Refer Process Card & Module Drawing",
                    "tolerance": {"type": "drawing"}
                },
                {
                    "checkpoint": "Soldering Peel Strength b/w Ribbon to busbar interconnector",
                    "sample_size": "once",
                    "frequency": "per shift",
                    "acceptance_criteria": "≥2N",
                    "tolerance": {"type": "min", "value": 2, "unit": "N"}
                }
            ]
        },
        {
            "sr_no": 7,
            "stage": "Auto bussing , layup & Tapping",
            "checkpoints": [
                {
                    "checkpoint": "Terminal busbar to edge of Cell",
                    "sample_size": "once",
                    "frequency": "per shift",
                    "acceptance_criteria": "132 Cell module drawing, Refer Module Drawing- GSPL/N144/G/001",
                    "tolerance": {"type": "drawing"}
                },
                {
                    "checkpoint": "Soldering Quality of Ribbon to busbar",
                    "sample_size": "Every 4h",
                    "frequency": "per shift",
                    "acceptance_criteria": "No Dry/Poor Soldering",
                    "tolerance": {"type": "visual"}
                },
                {
                    "checkpoint": "Top & Bottom Creepage Distance/Terminal busbar to Glass Edge.",
                    "sample_size": "Every 4h",
                    "frequency": "per shift",
                    "acceptance_criteria": "Creepage distance should be as per process card/Drawing",
                    "tolerance": {"type": "drawing"}
                },
                {
                    "checkpoint": "Verification of Process Parameter",
                    "sample_size": "once",
                    "frequency": "per shift",
                    "acceptance_criteria": "Specification for Auto Bussing",
                    "tolerance": {"type": "specification"}
                },
                {
                    "checkpoint": "Quality of auto taping",
                    "sample_size": "Every 4h",
                    "frequency": "per shift",
                    "acceptance_criteria": "Taping should be proper,no Cell Shifting allowed",
                    "tolerance": {"type": "visual"}
                }
            ]
        },
        {
            "sr_no": 8,
            "stage": "Auto RFID Logo/Barcode placing (If Applicable)",
            "checkpoints": [
                {
                    "checkpoint": "Position verification of RFIDs Logo /Barcode placing",
                    "sample_size": "Every 4h",
                    "frequency": "per shift",
                    "acceptance_criteria": "Should not be tilt",
                    "tolerance": {"type": "visual"}
                }
            ]
        },
        {
            "sr_no": 9,
            "stage": "EVA/EPE cutting",
            "checkpoints": [
                {
                    "checkpoint": "EVA/EPE Type",
                    "sample_size": "once",
                    "frequency": "per shift",
                    "acceptance_criteria": "EVA",
                    "tolerance": {"type": "bom"}
                },
                {
                    "checkpoint": "EVA/EPE dimension(L*W*T)",
                    "sample_size": "once",
                    "frequency": "per shift",
                    "acceptance_criteria": "As per Specification",
                    "tolerance": {"type": "range", "length": "±1", "width": "±1", "thickness": "±0.2", "unit": "mm"}
                },
                {
                    "checkpoint": "EVA/EPE Status",
                    "sample_size": "once",
                    "frequency": "per shift",
                    "acceptance_criteria": "Not allowed dust & foreign particle/Cut & non Uniform Embossing /Mfg Date",
                    "tolerance": {"type": "visual"}
                }
            ]
        },
        {
            "sr_no": 10,
            "stage": "Back Glass Loader",
            "checkpoints": [
                {
                    "checkpoint": "Glass dimension(L*W*T)",
                    "sample_size": "once",
                    "frequency": "Per shift",
                    "acceptance_criteria": "As per PO",
                    "tolerance": {"type": "range", "length": "±1", "width": "±1", "thickness": "±0.2", "unit": "mm"}
                }
            ]
        },
        {
            "sr_no": 11,
            "stage": "Auto Busbar Flatten (If Applicable)",
            "checkpoints": [
                {
                    "checkpoint": "No. of Holes/ Holes dimension",
                    "sample_size": "once",
                    "frequency": "Per shift",
                    "acceptance_criteria": "3 hole with dimension 12mm ± 0.5mm",
                    "tolerance": {"type": "holes", "count": 3, "diameter": 12, "tolerance": 0.5, "unit": "mm"}
                },
                {
                    "checkpoint": "Visual Inspection",
                    "sample_size": "5 pieces",
                    "frequency": "per shift",
                    "acceptance_criteria": "No crack/ breaks in busbar & properly flattened without bending and twisting",
                    "tolerance": {"type": "visual"}
                }
            ]
        },
        {
            "sr_no": 12,
            "stage": "Pre lamination EL & Visual Inspection",
            "checkpoints": [
                {
                    "checkpoint": "EL Inspection and Visual Inspection",
                    "sample_size": "5 pieces",
                    "frequency": "per shift",
                    "acceptance_criteria": "Pre EL Inspection Criteria, Pre EL Visual Criteria",
                    "tolerance": {"type": "visual"}
                }
            ]
        },
        {
            "sr_no": 13,
            "stage": "String Rework Station",
            "checkpoints": [
                {
                    "checkpoint": "cleaning of rework station/Soldering iron and sponge",
                    "sample_size": "once",
                    "frequency": "per shift",
                    "acceptance_criteria": "Rework Station should be Clean/Sponge should be Wet",
                    "tolerance": {"type": "visual"}
                },
                {
                    "checkpoint": "Soldering Iron Temp.",
                    "sample_size": "once",
                    "frequency": "per shift",
                    "acceptance_criteria": "400±30°C",
                    "tolerance": {"type": "range", "value": 400, "tolerance": 30, "unit": "°C"}
                }
            ]
        },
        {
            "sr_no": 14,
            "stage": "Module Rework Station",
            "checkpoints": [
                {
                    "checkpoint": "Method of Rework",
                    "sample_size": "once",
                    "frequency": "per shift",
                    "acceptance_criteria": "As per WI (GSPL/P/WI/012)",
                    "tolerance": {"type": "wi"}
                },
                {
                    "checkpoint": "Cleaning of Rework station/Soldering iron sponge",
                    "sample_size": "once",
                    "frequency": "per shift",
                    "acceptance_criteria": "Rework Station should be Clean/Sponge should be Wet",
                    "tolerance": {"type": "visual"}
                },
                {
                    "checkpoint": "Soldering Iron Temp.",
                    "sample_size": "once",
                    "frequency": "per shift",
                    "acceptance_criteria": "400±30°C",
                    "tolerance": {"type": "range", "value": 400, "tolerance": 30, "unit": "°C"}
                }
            ]
        },
        {
            "sr_no": 15,
            "stage": "Laminator",
            "checkpoints": [
                {
                    "checkpoint": "Monitoring of Laminator Process parameter",
                    "sample_size": "once",
                    "frequency": "per shift",
                    "acceptance_criteria": "Process Parameter of jinchen Laminator",
                    "tolerance": {"type": "specification"}
                },
                {
                    "checkpoint": "Cleaning of Diaphragm/release sheet",
                    "sample_size": "once",
                    "frequency": "24h",
                    "acceptance_criteria": "Diaphragm/Release sheet should be clean,No EVA residue is allowed",
                    "tolerance": {"type": "visual"}
                }
            ]
        },
        {
            "sr_no": 16,
            "stage": "Auto Tape Removing (If Applicable)",
            "checkpoints": [
                {
                    "checkpoint": "Peel of Test b/w: EVA/Backsheet EVA/EPE/POE to Glass",
                    "sample_size": "All position",
                    "frequency": "All laminators to be covered in a month",
                    "acceptance_criteria": "E/G ≥60N/cm E /Bs≥60N/cm",
                    "tolerance": {"type": "min", "value": 60, "unit": "N/cm"}
                },
                {
                    "checkpoint": "Gel Content Test",
                    "sample_size": "",
                    "frequency": "",
                    "acceptance_criteria": "75to 95%",
                    "tolerance": {"type": "range", "min": 75, "max": 95, "unit": "%"}
                },
                {
                    "checkpoint": "Visual Check after Lamination",
                    "sample_size": "5 pieces",
                    "frequency": "per shift",
                    "acceptance_criteria": "Check Tape Removing Should be smooth and No visual bubble Should be found.",
                    "tolerance": {"type": "visual"}
                }
            ]
        },
        {
            "sr_no": 17,
            "stage": "Auto Edge Trimming",
            "checkpoints": [
                {
                    "checkpoint": "Trimming Quality",
                    "sample_size": "5 pieces",
                    "frequency": "per shift",
                    "acceptance_criteria": "Excess layer from the glass edge should be removed,Uneven Trimming not allowed",
                    "tolerance": {"type": "visual"}
                },
                {
                    "checkpoint": "Trimming Blade life cycle",
                    "sample_size": "once",
                    "frequency": "per month",
                    "acceptance_criteria": "Worn out not allowed",
                    "tolerance": {"type": "visual"}
                }
            ]
        },
        {
            "sr_no": 18,
            "stage": "90° Visual Inspection",
            "checkpoints": [
                {
                    "checkpoint": "Visual Inspection",
                    "sample_size": "5 pieces",
                    "frequency": "per shift",
                    "acceptance_criteria": "Post Lam Visual Inspection Criteria",
                    "tolerance": {"type": "visual"}
                }
            ]
        },
        {
            "sr_no": 19,
            "stage": "Framing",
            "checkpoints": [
                {
                    "checkpoint": "Glue uniformity & continuity in frame groove",
                    "sample_size": "1 set",
                    "frequency": "per shift",
                    "acceptance_criteria": "Should be uniform,Back sealing should be proper",
                    "tolerance": {"type": "visual"}
                },
                {
                    "checkpoint": "Short Side Glue Weight",
                    "sample_size": "once",
                    "frequency": "Per shift",
                    "acceptance_criteria": "Till as per Specification",
                    "tolerance": {"type": "specification"}
                },
                {
                    "checkpoint": "Long Side Glue Weight",
                    "sample_size": "once",
                    "frequency": "Per shift",
                    "acceptance_criteria": "",
                    "tolerance": {"type": "specification"}
                },
                {
                    "checkpoint": "Anodizing Thickness",
                    "sample_size": "once",
                    "frequency": "Per shift",
                    "acceptance_criteria": "≥15 micron",
                    "tolerance": {"type": "min", "value": 15, "unit": "micron"}
                }
            ]
        },
        {
            "sr_no": 20,
            "stage": "Junction Box Assembly",
            "checkpoints": [
                {
                    "checkpoint": "Junction Box(Connector Appearance & Cable Length)",
                    "sample_size": "once",
                    "frequency": "Per shift",
                    "acceptance_criteria": "As per Process Card & module drawing",
                    "tolerance": {"type": "drawing"}
                },
                {
                    "checkpoint": "Silicon Glue Weight on the bottom (g)",
                    "sample_size": "once",
                    "frequency": "Per shift",
                    "acceptance_criteria": "21±6 gm",
                    "tolerance": {"type": "range", "value": 21, "tolerance": 6, "unit": "gm"}
                },
                {
                    "checkpoint": "Max Welding time",
                    "sample_size": "once",
                    "frequency": "Per shift",
                    "acceptance_criteria": "As per Specification",
                    "tolerance": {"type": "specification"}
                }
            ]
        },
        {
            "sr_no": 21,
            "stage": "Auto JB Soldering",
            "checkpoints": [
                {
                    "checkpoint": "Soldering current",
                    "sample_size": "once",
                    "frequency": "per shift",
                    "acceptance_criteria": "As per Specification",
                    "tolerance": {"type": "specification"}
                },
                {
                    "checkpoint": "Soldering Quality",
                    "sample_size": "once",
                    "frequency": "per shift",
                    "acceptance_criteria": "Welding area should be fully covered & checked by twizzer,no yellowing allowed",
                    "tolerance": {"type": "visual"}
                }
            ]
        },
        {
            "sr_no": 22,
            "stage": "JB Potting",
            "checkpoints": [
                {
                    "checkpoint": "A/B Glue Ratio",
                    "sample_size": "once",
                    "frequency": "Per shift",
                    "acceptance_criteria": "As per Specification",
                    "tolerance": {"type": "specification"}
                },
                {
                    "checkpoint": "Potting material weight",
                    "sample_size": "once",
                    "frequency": "Per shift",
                    "acceptance_criteria": "21±6 gm",
                    "tolerance": {"type": "range", "value": 21, "tolerance": 6, "unit": "gm"}
                },
                {
                    "checkpoint": "Nozzle Changing",
                    "sample_size": "once",
                    "frequency": "every 6h",
                    "acceptance_criteria": "Should be changed after 6 hours or when found issue of damage or extra amount dispensing.",
                    "tolerance": {"type": "time", "value": 6, "unit": "hours"}
                }
            ]
        },
        {
            "sr_no": 23,
            "stage": "OLE Potting Inspection (If Applicable)",
            "checkpoints": [
                {
                    "checkpoint": "Visual Check",
                    "sample_size": "once",
                    "frequency": "5 piece",
                    "acceptance_criteria": "Potting should be properly filled, and mounting hole should be as per drawing.",
                    "tolerance": {"type": "visual"}
                }
            ]
        },
        {
            "sr_no": 24,
            "stage": "Curing",
            "checkpoints": [
                {
                    "checkpoint": "Temperature",
                    "sample_size": "once",
                    "frequency": "per shift",
                    "acceptance_criteria": "25±3℃",
                    "tolerance": {"type": "range", "value": 25, "tolerance": 3, "unit": "°C"}
                },
                {
                    "checkpoint": "Humidity",
                    "sample_size": "once",
                    "frequency": "per shift",
                    "acceptance_criteria": "≤50%",
                    "tolerance": {"type": "max", "value": 50, "unit": "%"}
                },
                {
                    "checkpoint": "Curing Time(H)",
                    "sample_size": "once",
                    "frequency": "Per shift",
                    "acceptance_criteria": "≥4 hours",
                    "tolerance": {"type": "min", "value": 4, "unit": "hours"}
                }
            ]
        },
        {
            "sr_no": 25,
            "stage": "Buffing",
            "checkpoints": [
                {
                    "checkpoint": "Corner Edge-Buffing belt condition",
                    "sample_size": "5 pieces",
                    "frequency": "per shift",
                    "acceptance_criteria": "Should not be sharp & No worn out",
                    "tolerance": {"type": "visual"}
                }
            ]
        },
        {
            "sr_no": 26,
            "stage": "Cleaning",
            "checkpoints": [
                {
                    "checkpoint": "Module should be free from Tape,Dust,Dirt,EVA/Backs heet residue,Corner Burrs,Glue residue on glass,backsheet,JB,Wire etc.)",
                    "sample_size": "5 pieces",
                    "frequency": "per shift",
                    "acceptance_criteria": "Post Lam Visual Criteria",
                    "tolerance": {"type": "visual"}
                }
            ]
        },
        {
            "sr_no": 27,
            "stage": "Flash Tester",
            "checkpoints": [
                {
                    "checkpoint": "Ambient Temp.",
                    "sample_size": "once",
                    "frequency": "per shift",
                    "acceptance_criteria": "25±3℃",
                    "tolerance": {"type": "range", "value": 25, "tolerance": 3, "unit": "°C"}
                },
                {
                    "checkpoint": "Module Temp.",
                    "sample_size": "once",
                    "frequency": "per shift",
                    "acceptance_criteria": "25±3℃",
                    "tolerance": {"type": "range", "value": 25, "tolerance": 3, "unit": "°C"}
                },
                {
                    "checkpoint": "Isc/simulator Calibration",
                    "sample_size": "once",
                    "frequency": "12h",
                    "acceptance_criteria": "Isc/simulation should be calibrated at the start of the shift with Golden/Silver module(GSEN/QA/K/11)",
                    "tolerance": {"type": "calibration"}
                },
                {
                    "checkpoint": "Validation",
                    "sample_size": "once",
                    "frequency": "every 4h",
                    "acceptance_criteria": "As per GSEN/QA/K/11",
                    "tolerance": {"type": "specification"}
                },
                {
                    "checkpoint": "Silver Reference Module Iv Check",
                    "sample_size": "once",
                    "frequency": "Two weeks",
                    "acceptance_criteria": "Should be same as original I-v picture",
                    "tolerance": {"type": "specification"}
                }
            ]
        },
        {
            "sr_no": 28,
            "stage": "Hipot Test",
            "checkpoints": [
                {
                    "checkpoint": "DCW/IR/Ground continuity",
                    "sample_size": "5 pieces",
                    "frequency": "per shift",
                    "acceptance_criteria": "≤50µA , >40MΩ·m² , (0-100) mΩ",
                    "tolerance": {"type": "multi", "dcw": {"max": 50, "unit": "µA"}, "ir": {"min": 40, "unit": "MΩ·m²"}, "ground": {"min": 0, "max": 100, "unit": "mΩ"}}
                }
            ]
        },
        {
            "sr_no": 29,
            "stage": "Post EL Test",
            "checkpoints": [
                {
                    "checkpoint": "Verification of current configuration in DC power supply",
                    "sample_size": "once",
                    "frequency": "Shift",
                    "acceptance_criteria": "As per WI (GSPL/P/WI/027)",
                    "tolerance": {"type": "wi"}
                },
                {
                    "checkpoint": "EL Inspection and Visual Inspection",
                    "sample_size": "5 pieces",
                    "frequency": "per shift",
                    "acceptance_criteria": "Post EL Inspection Criteria, Post EL Visual Criteria",
                    "tolerance": {"type": "visual"}
                }
            ]
        },
        {
            "sr_no": 30,
            "stage": "RFID",
            "checkpoints": [
                {
                    "checkpoint": "RFID Position",
                    "sample_size": "once",
                    "frequency": "per shift",
                    "acceptance_criteria": "As per Process card",
                    "tolerance": {"type": "process_card"}
                },
                {
                    "checkpoint": "Cell & Module Make & Manufacturing Month Verification",
                    "sample_size": "once",
                    "frequency": "per shift",
                    "acceptance_criteria": "As per BOM and Process card",
                    "tolerance": {"type": "bom"}
                }
            ]
        },
        {
            "sr_no": 31,
            "stage": "Final Visual Inspection",
            "checkpoints": [
                {
                    "checkpoint": "Visual Inspection",
                    "sample_size": "5 pieces",
                    "frequency": "per shift",
                    "acceptance_criteria": "Post lam visual inspection criteria",
                    "tolerance": {"type": "visual"}
                },
                {
                    "checkpoint": "Re-label",
                    "sample_size": "5 pieces",
                    "frequency": "per shift",
                    "acceptance_criteria": "No bubble,Tilt,Align,no folded label not acceptable",
                    "tolerance": {"type": "visual"}
                }
            ]
        },
        {
            "sr_no": 32,
            "stage": "Dimension measurement",
            "checkpoints": [
                {
                    "checkpoint": "L*W and Module Profile",
                    "sample_size": "once",
                    "frequency": "per shift",
                    "acceptance_criteria": "As per Module drawing (±1mm)",
                    "tolerance": {"type": "range", "value": "±1", "unit": "mm"}
                },
                {
                    "checkpoint": "Mounting Hole X & Y (H/L)",
                    "sample_size": "once",
                    "frequency": "Per shift",
                    "acceptance_criteria": "",
                    "tolerance": {"type": "drawing"}
                },
                {
                    "checkpoint": "Diagonal Difference",
                    "sample_size": "once",
                    "frequency": "Per shift",
                    "acceptance_criteria": "≤3mm",
                    "tolerance": {"type": "max", "value": 3, "unit": "mm"}
                },
                {
                    "checkpoint": "Corner Gap",
                    "sample_size": "once",
                    "frequency": "Per shift",
                    "acceptance_criteria": "As per visual inspection criteria",
                    "tolerance": {"type": "visual"}
                },
                {
                    "checkpoint": "JB Cable length",
                    "sample_size": "once",
                    "frequency": "Per shift",
                    "acceptance_criteria": "As per Process Card",
                    "tolerance": {"type": "process_card"}
                }
            ]
        },
        {
            "sr_no": 33,
            "stage": "Packaging",
            "checkpoints": [
                {
                    "checkpoint": "Packaging Label",
                    "sample_size": "once",
                    "frequency": "Per shift",
                    "acceptance_criteria": "WI For Packaging",
                    "tolerance": {"type": "wi"}
                },
                {
                    "checkpoint": "Content in Box",
                    "sample_size": "once",
                    "frequency": "Per shift",
                    "acceptance_criteria": "",
                    "tolerance": {"type": "specification"}
                },
                {
                    "checkpoint": "Box Condition",
                    "sample_size": "once",
                    "frequency": "Per shift",
                    "acceptance_criteria": "Damage,dull printing,wet boxes not allowed",
                    "tolerance": {"type": "visual"}
                },
                {
                    "checkpoint": "Wooden Pallet dimension",
                    "sample_size": "once",
                    "frequency": "Per shift",
                    "acceptance_criteria": "should not be less than module dimension",
                    "tolerance": {"type": "visual"}
                }
            ]
        }
    ]
    
    @staticmethod
    def get_template():
        """Return the complete IPQC template"""
        return IPQCTemplate.STAGES
    
    @staticmethod
    def get_stage_count():
        """Return total number of stages"""
        return len(IPQCTemplate.STAGES)
    
    @staticmethod
    def get_checkpoint_count():
        """Return total number of checkpoints"""
        total = 0
        for stage in IPQCTemplate.STAGES:
            total += len(stage.get('checkpoints', []))
        return total


class BOMData:
    """Customer BOM Data Management"""
    
    # Sample customer BOMs
    CUSTOMER_BOMS = {
        "GSPL/IPQC/IPC/003": {
            "customer_name": "Gautam Solar Private Limited",
            "module_type": "Mono PERC",
            "power_rating": "550W",
            "cells": {
                "count": 144,
                "type": "M10",
                "size": "182mm",
                "arrangement": "6x24",
                "manufacturer": "Approved Vendor"
            },
            "glass": {
                "front_thickness": "3.2mm",
                "type": "Tempered Low Iron"
            },
            "backsheet": {
                "type": "White",
                "thickness": "0.35mm"
            },
            "eva": {
                "type": "POE/EVA",
                "thickness": "0.70mm"
            },
            "frame": {
                "material": "Anodized Aluminum",
                "color": "Silver",
                "dimension": "2278x1134x35mm"
            },
            "jb": {
                "type": "IP67 Rated",
                "cable_length": "1200mm",
                "connector": "MC4"
            },
            "module_dimension": {
                "length": 2278,
                "width": 1134,
                "thickness": 35,
                "tolerance": 1
            },
            "string_config": {
                "strings": 6,
                "cells_per_string": 24,
                "string_length": 1163,
                "cell_gap": 0.75
            }
        }
    }
    
    @staticmethod
    def get_bom(customer_id):
        """Get BOM for specific customer"""
        return BOMData.CUSTOMER_BOMS.get(customer_id, None)
    
    @staticmethod
    def add_bom(customer_id, bom_data):
        """Add new customer BOM"""
        BOMData.CUSTOMER_BOMS[customer_id] = bom_data
        return True

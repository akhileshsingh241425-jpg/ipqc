# OpenAI Function Definitions for PDI System
# These functions will be called by GPT-4o-mini based on user queries

OPENAI_FUNCTIONS = [
    {
        "name": "compare_pdi_with_mrp",
        "description": "Compare PDI serial numbers with MRP system to get dispatch/packed/remaining counts",
        "parameters": {
            "type": "object",
            "properties": {
                "company": {
                    "type": "string",
                    "description": "Company name (e.g., 'Sterlin and Wilson', 'Rays Power', 'Larsen & Toubro')",
                    "enum": ["Sterlin and Wilson", "Rays Power", "Larsen & Toubro"]
                },
                "pdi_number": {
                    "type": "string",
                    "description": "PDI number (e.g., 'PDI-1', 'PDI-2')",
                    "pattern": "^PDI-\\d+$"
                }
            },
            "required": ["company", "pdi_number"]
        }
    },
    {
        "name": "compare_pdi_with_mrp_filtered",
        "description": "Compare PDI with MRP filtered by specific running orders (R-1, R-2, etc.)",
        "parameters": {
            "type": "object",
            "properties": {
                "company": {
                    "type": "string",
                    "description": "Company name",
                    "enum": ["Sterlin and Wilson", "Rays Power", "Larsen & Toubro"]
                },
                "pdi_number": {
                    "type": "string",
                    "description": "PDI number (e.g., 'PDI-1')"
                },
                "running_orders": {
                    "type": "array",
                    "items": {"type": "string", "pattern": "^R-\\d+$"},
                    "description": "List of running orders to filter (e.g., ['R-1', 'R-2'])"
                }
            },
            "required": ["company", "pdi_number", "running_orders"]
        }
    },
    {
        "name": "get_running_order_status",
        "description": "Get status of a specific running order",
        "parameters": {
            "type": "object",
            "properties": {
                "company": {"type": "string", "enum": ["Sterlin and Wilson", "Rays Power", "Larsen & Toubro"]},
                "running_order": {"type": "string", "pattern": "^R-\\d+$"}
            },
            "required": ["company", "running_order"]
        }
    },
    {
        "name": "get_binning_status",
        "description": "Get status of a specific binning type (I1, I2, I3)",
        "parameters": {
            "type": "object",
            "properties": {
                "company": {"type": "string", "enum": ["Sterlin and Wilson", "Rays Power", "Larsen & Toubro"]},
                "binning": {"type": "string", "enum": ["I1", "I2", "I3", "MB", "MC", "MD", "MF", "MG"]}
            },
            "required": ["company", "binning"]
        }
    },
    {
        "name": "check_mix_packing",
        "description": "Check for pallets with mixed binning types (quality issue)",
        "parameters": {
            "type": "object",
            "properties": {
                "company": {"type": "string", "enum": ["Sterlin and Wilson", "Rays Power", "Larsen & Toubro"]}
            },
            "required": ["company"]
        }
    },
    {
        "name": "check_duplicate_barcodes",
        "description": "Check for duplicate barcodes in MRP system",
        "parameters": {
            "type": "object",
            "properties": {
                "company": {"type": "string", "enum": ["Sterlin and Wilson", "Rays Power", "Larsen & Toubro"]}
            },
            "required": ["company"]
        }
    },
    {
        "name": "get_pallet_full_details",
        "description": "Get complete details of a specific pallet",
        "parameters": {
            "type": "object",
            "properties": {
                "company": {"type": "string", "enum": ["Sterlin and Wilson", "Rays Power", "Larsen & Toubro"]},
                "pallet_no": {"type": "string", "description": "Pallet number"}
            },
            "required": ["company", "pallet_no"]
        }
    },
    {
        "name": "get_company_full_status",
        "description": "Get complete overview of a company's production status",
        "parameters": {
            "type": "object",
            "properties": {
                "company": {"type": "string", "enum": ["Sterlin and Wilson", "Rays Power", "Larsen & Toubro"]}
            },
            "required": ["company"]
        }
    },
    {
        "name": "get_total_pallets",
        "description": "Get total number of pallets with optional filters",
        "parameters": {
            "type": "object",
            "properties": {
                "company": {"type": "string", "enum": ["Sterlin and Wilson", "Rays Power", "Larsen & Toubro"]},
                "running_order": {"type": "string", "pattern": "^R-\\d+$"},
                "binning": {"type": "string"},
                "pdi_number": {"type": "string", "pattern": "^PDI-\\d+$"}
            },
            "required": ["company"]
        }
    }
]

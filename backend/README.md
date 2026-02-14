# IPQC Automation System - Backend

## Overview
Flask backend for automated IPQC (In-Process Quality Check) form generation system for Gautam Solar.

## Features
- ✅ Auto-generate IPQC forms with 33 stages and 200+ checkpoints
- ✅ Customer-specific BOM management
- ✅ Automatic tolerance and specification filling
- ✅ Professional PDF report generation
- ✅ Serial number auto-generation
- ✅ RESTful API endpoints

## Installation

### Prerequisites
- Python 3.8 or higher
- pip package manager

### Setup Steps

1. **Create virtual environment:**
```bash
cd backend
python -m venv venv
```

2. **Activate virtual environment:**
```bash
# Linux/Mac
source venv/bin/activate

# Windows
venv\Scripts\activate
```

3. **Install dependencies:**
```bash
pip install -r requirements.txt
```

4. **Run the application:**
```bash
python run.py
```

The server will start on `http://localhost:5000`

## API Endpoints

### 1. Health Check
```
GET /api/health
```

### 2. Generate IPQC Form
```
POST /api/generate-ipqc
Content-Type: application/json

{
  "date": "2024-01-15",
  "shift": "A",
  "customer_id": "GSPL/IPQC/IPC/003",
  "po_number": "PO12345",
  "serial_start": 10001,
  "module_count": 1
}
```

### 3. Generate Complete Report (Form + PDF)
```
POST /api/generate-complete
Content-Type: application/json

{
  "date": "2024-01-15",
  "shift": "A",
  "customer_id": "GSPL/IPQC/IPC/003",
  "po_number": "PO12345",
  "serial_start": 10001,
  "module_count": 1
}

Response: PDF file download
```

### 4. Upload Customer BOM
```
POST /api/upload-bom
Content-Type: application/json

{
  "customer_id": "CUST001",
  "bom_data": {
    "customer_name": "Customer Name",
    "module_type": "Mono PERC",
    "power_rating": "550W",
    ...
  }
}
```

### 5. Get Customer BOM
```
GET /api/get-bom/<customer_id>
```

### 6. List All Customers
```
GET /api/list-customers
```

### 7. Generate Serial Numbers
```
POST /api/generate-serials
Content-Type: application/json

{
  "start_number": 10001,
  "count": 100,
  "prefix": "GSPL",
  "padding": 5
}
```

### 8. Get Template Info
```
GET /api/template-info
```

## Project Structure
```
backend/
├── app/
│   ├── __init__.py           # Flask app factory
│   ├── models/
│   │   ├── __init__.py
│   │   └── ipqc_data.py      # IPQC template & BOM data models
│   ├── services/
│   │   ├── __init__.py
│   │   ├── form_generator.py # Auto-fill logic
│   │   └── pdf_generator.py  # PDF generation service
│   └── routes/
│       ├── __init__.py
│       └── ipqc_routes.py    # API endpoints
├── uploads/                   # Uploaded files storage
├── generated_pdfs/            # Generated PDF reports
├── requirements.txt          # Python dependencies
├── run.py                    # Application entry point
└── README.md                 # This file
```

## Configuration

The application uses the following default configuration:
- Upload folder: `backend/uploads`
- PDF output folder: `backend/generated_pdfs`
- Max file size: 16MB
- CORS: Enabled for all origins

## Development

### Adding New Stages
Edit `app/models/ipqc_data.py` and add new stages to the `IPQCTemplate.STAGES` list.

### Adding New Customer BOMs
Use the `/api/upload-bom` endpoint or directly edit `BOMData.CUSTOMER_BOMS` in `app/models/ipqc_data.py`.

### Customizing PDF Layout
Modify the `IPQCPDFGenerator` class in `app/services/pdf_generator.py`.

## Testing

Test the API using curl:

```bash
# Health check
curl http://localhost:5000/api/health

# Generate IPQC form
curl -X POST http://localhost:5000/api/generate-ipqc \
  -H "Content-Type: application/json" \
  -d '{
    "date": "2024-01-15",
    "shift": "A",
    "customer_id": "GSPL/IPQC/IPC/003",
    "po_number": "PO12345"
  }'

# Download PDF
curl -X POST http://localhost:5000/api/generate-complete \
  -H "Content-Type: application/json" \
  -d '{
    "date": "2024-01-15",
    "shift": "A",
    "customer_id": "GSPL/IPQC/IPC/003",
    "po_number": "PO12345"
  }' \
  --output report.pdf
```

## Troubleshooting

### Import errors
Make sure you're in the virtual environment:
```bash
source venv/bin/activate  # Linux/Mac
```

### Port already in use
Change the port in `run.py` or use environment variable:
```bash
PORT=8000 python run.py
```

## License
Proprietary - Gautam Solar Private Limited

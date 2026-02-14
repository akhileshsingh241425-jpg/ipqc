# IPQC Automation System - Frontend

## Overview
React-based frontend for the IPQC (In-Process Quality Check) automation system.

## Features
- 🎨 Modern, responsive UI
- 📱 Mobile-friendly design
- 🚀 Fast and intuitive
- 🔄 Real-time form generation
- 📥 One-click PDF download
- ✨ Beautiful animations and gradients

## Installation

### Prerequisites
- Node.js 14 or higher
- npm or yarn

### Setup Steps

1. **Install dependencies:**
```bash
cd frontend
npm install
```

2. **Configure API URL:**
Create a `.env` file in the frontend folder:
```
REACT_APP_API_URL=http://localhost:5000/api
```

3. **Start development server:**
```bash
npm start
```

The app will open at `http://localhost:3000`

## Build for Production

```bash
npm run build
```

This creates an optimized production build in the `build/` folder.

## Project Structure
```
frontend/
├── public/
│   └── index.html              # HTML template
├── src/
│   ├── components/
│   │   └── IPQCForm.js        # Main form component
│   ├── services/
│   │   └── apiService.js      # API integration
│   ├── styles/
│   │   └── IPQCForm.css       # Styles
│   ├── App.js                 # Root component
│   └── index.js               # Entry point
├── package.json               # Dependencies
└── README.md                  # This file
```

## Usage

1. **Select Date & Shift**: Choose inspection date and shift (A/B/C)
2. **Select Customer**: Choose from available customer IDs
3. **Enter PO Number**: Enter the Purchase Order number
4. **Set Serial Number**: Optional starting serial number
5. **Set Module Count**: Number of modules in batch
6. **Generate PDF**: Click to generate and download PDF report

## Features in Detail

### Auto-Fill Intelligence
- Automatically fills all 33 stages
- Applies correct tolerances for 200+ checkpoints
- Uses customer-specific BOM data

### Professional UI
- Clean, modern design
- Gradient backgrounds
- Smooth animations
- Responsive layout

### Real-time Validation
- Form validation before submission
- Error handling and user feedback
- Loading states during API calls

## API Integration

The frontend communicates with the Flask backend through RESTful APIs:

- `GET /api/health` - Health check
- `POST /api/generate-ipqc` - Generate form data
- `POST /api/generate-complete` - Generate and download PDF
- `GET /api/list-customers` - Get customer list
- `GET /api/template-info` - Get template statistics

## Customization

### Changing Colors
Edit `src/styles/IPQCForm.css`:
```css
/* Primary gradient */
background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);

/* Company color */
color: #1a237e;
```

### Adding New Fields
Edit `src/components/IPQCForm.js` and add to `formData` state.

## Troubleshooting

### CORS Issues
Make sure Flask backend has CORS enabled and is running.

### API Connection Failed
Check the `REACT_APP_API_URL` in `.env` file.

### Build Errors
```bash
rm -rf node_modules package-lock.json
npm install
```

## Browser Support
- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)

## License
Proprietary - Gautam Solar Private Limited

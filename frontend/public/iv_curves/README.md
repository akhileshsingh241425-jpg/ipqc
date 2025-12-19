# I-V Curve Graph Images

## Directory Structure
This folder contains pre-generated I-V curve graph images for different solar module power ratings.

## File Naming Convention
Images should be named according to the module power rating:
- `graph_510.png` - For 510W modules
- `graph_520.png` - For 520W modules
- `graph_530.png` - For 530W modules
- `graph_540.png` - For 540W modules
- `graph_550.png` - For 550W modules
- `graph_560.png` - For 560W modules
- `graph_570.png` - For 570W modules
- `graph_575.png` - For 575W modules
- `graph_580.png` - For 580W modules
- `graph_585.png` - For 585W modules
- `graph_590.png` - For 590W modules
- `graph_595.png` - For 595W modules
- `graph_600.png` - For 600W modules
- `graph_605.png` - For 605W modules
- `graph_610.png` - For 610W modules
- `graph_615.png` - For 615W modules
- `graph_620.png` - For 620W modules
- `graph_625.png` - For 625W modules
- `graph_630.png` - For 630W modules
- `graph_635.png` - For 635W modules
- `graph_640.png` - For 640W modules
- `graph_622.png` - For 622W modules (G12R series)
- `graph_652.png` - For 652W modules (G12R series)

## Image Specifications
- **Format**: PNG (recommended) or JPG
- **Dimensions**: Recommended 800x600 pixels or higher
- **Content**: I-V curve (red line) and P-V curve (blue line) with proper axis labels
- **Background**: White
- **Graph Style**: Should match the professional sun simulator output format

## How to Add Images
1. Generate I-V curve graphs from your sun simulator data
2. Save each graph with the appropriate power rating filename
3. Place the image files in this directory
4. The system will automatically load the correct graph based on selected module

## Example Usage
When user selects "G3G1890K-UHAB - 630W" module:
- System looks for: `/iv_curves/graph_630.png`
- If found: Displays the pre-generated graph
- If not found: Shows error message asking to upload the graph

## Database Integration (Future)
Currently using file system. You can later integrate with database:
- Store images in database as BLOB
- Create API endpoint to serve images by power rating
- Update `getGraphImagePath()` function in TestReport.js to use API endpoint

"""
COC Service - Fetch and sync COC data from external API
"""
import requests
from datetime import datetime, timedelta
from sqlalchemy import text
from app.models.database import db

class COCService:
    EXTERNAL_API_URL = "https://umanmrp.in/api/coc_api.php"
    
    @staticmethod
    def fetch_and_sync_coc_data(from_date=None, to_date=None):
        """Fetch COC data from external API and sync to database"""
        try:
            # Default to last 30 days if not provided
            if not from_date:
                from_date = (datetime.now() - timedelta(days=30)).strftime('%Y-%m-%d')
            if not to_date:
                to_date = datetime.now().strftime('%Y-%m-%d')
            
            # Fetch data from external API
            payload = {"from": from_date, "to": to_date}
            response = requests.post(COCService.EXTERNAL_API_URL, json=payload, timeout=30)
            response.raise_for_status()
            
            data = response.json()
            
            if not data.get('status'):
                return {"success": False, "message": "API returned status false", "synced": 0}
            
            records = data.get('data', [])
            synced_count = 0
            duplicate_count = 0
            error_count = 0
            
            for record in records:
                try:
                    # Check if already exists
                    check_query = text("""
                        SELECT id FROM coc_documents 
                        WHERE company_name = :company 
                        AND material_name = :material 
                        AND lot_batch_no = :lot 
                        AND invoice_no = :invoice
                    """)
                    
                    existing = db.session.execute(check_query, {
                        'company': record['store_name'],
                        'material': record['material_name'],
                        'lot': record['lot_batch_no'],
                        'invoice': record['invoice_no']
                    }).fetchone()
                    
                    if existing:
                        # Update existing record
                        update_query = text("""
                            UPDATE coc_documents SET
                                external_id = :ext_id,
                                brand = :brand,
                                product_type = :product_type,
                                coc_qty = :coc_qty,
                                invoice_qty = :invoice_qty,
                                invoice_date = :invoice_date,
                                entry_date = :entry_date,
                                username = :username,
                                coc_document_url = :coc_url,
                                iqc_document_url = :iqc_url,
                                last_synced_at = NOW()
                            WHERE id = :id
                        """)
                        
                        db.session.execute(update_query, {
                            'id': existing[0],
                            'ext_id': record['id'],
                            'brand': record.get('brand'),
                            'product_type': record.get('product_type'),
                            'coc_qty': float(record['coc_qty']),
                            'invoice_qty': float(record['invoice_qty']),
                            'invoice_date': record['invoice_date'],
                            'entry_date': record.get('entry_date'),
                            'username': record.get('username'),
                            'coc_url': record.get('coc_document_url'),
                            'iqc_url': record.get('iqc_document_url')
                        })
                        duplicate_count += 1
                    else:
                        # Insert new record
                        insert_query = text("""
                            INSERT INTO coc_documents (
                                external_id, company_name, material_name, brand, product_type,
                                lot_batch_no, coc_qty, invoice_no, invoice_qty, invoice_date,
                                entry_date, username, coc_document_url, iqc_document_url
                            ) VALUES (
                                :ext_id, :company, :material, :brand, :product_type,
                                :lot, :coc_qty, :invoice, :invoice_qty, :invoice_date,
                                :entry_date, :username, :coc_url, :iqc_url
                            )
                        """)
                        
                        db.session.execute(insert_query, {
                            'ext_id': record['id'],
                            'company': record['store_name'],
                            'material': record['material_name'],
                            'brand': record.get('brand'),
                            'product_type': record.get('product_type'),
                            'lot': record['lot_batch_no'],
                            'coc_qty': float(record['coc_qty']),
                            'invoice': record['invoice_no'],
                            'invoice_qty': float(record['invoice_qty']),
                            'invoice_date': record['invoice_date'],
                            'entry_date': record.get('entry_date'),
                            'username': record.get('username'),
                            'coc_url': record.get('coc_document_url'),
                            'iqc_url': record.get('iqc_document_url')
                        })
                        synced_count += 1
                    
                except Exception as e:
                    print(f"Error syncing record {record.get('id')}: {str(e)}")
                    error_count += 1
                    continue
            
            db.session.commit()
            
            return {
                "success": True,
                "message": "COC data synced successfully",
                "synced": synced_count,
                "updated": duplicate_count,
                "errors": error_count,
                "total": len(records)
            }
            
        except Exception as e:
            db.session.rollback()
            return {"success": False, "message": f"Error: {str(e)}", "synced": 0}
    
    @staticmethod
    def get_material_stock(company_name=None, material_name=None):
        """Get raw material stock with available quantities
        
        Shows TOTAL available stock across ALL COCs (shared pool)
        Material can be consumed by any company from this shared pool
        """
        try:
            # Define standard raw materials
            standard_materials = [
                'Solar Cell', 'Glass', 'Aluminium Frame', 'Ribbon', 
                'EVA', 'Back Sheet', 'EPE', 'Junction Box', 'MC4 Connector'
            ]
            
            # Query to get TOTAL stock (shared across all companies)
            query = """
                SELECT 
                    material_name,
                    GROUP_CONCAT(DISTINCT brand SEPARATOR ', ') as brands,
                    SUM(coc_qty) as total_received,
                    SUM(consumed_qty) as total_consumed,
                    SUM(available_qty) as available
                FROM coc_documents
                WHERE is_active = 1
            """
            params = {}
            
            if material_name:
                query += " AND material_name = :material"
                params['material'] = material_name
            
            query += " GROUP BY material_name"
            
            result = db.session.execute(text(query), params).fetchall()
            
            # Create a dict to track existing materials
            stock_dict = {}
            for row in result:
                material = row[0]
                stock_dict[material] = {
                    'material': material,
                    'make': row[1] if row[1] else 'N/A',
                    'total_received': float(row[2]) if row[2] else 0,
                    'total_consumed': float(row[3]) if row[3] else 0,
                    'available': float(row[4]) if row[4] else 0
                }
            
            # Add missing standard materials with 0 stock
            for material in standard_materials:
                if material not in stock_dict:
                    stock_dict[material] = {
                        'material': material,
                        'make': 'N/A',
                        'total_received': 0,
                        'total_consumed': 0,
                        'available': 0
                    }
            
            stock_data = list(stock_dict.values())
            
            # Sort by material name
            stock_data.sort(key=lambda x: x['material'])
            
            return {"success": True, "data": stock_data}
            
        except Exception as e:
            return {"success": False, "message": str(e)}
    
    @staticmethod
    def validate_production(company_name, material_requirements):
        """Validate if sufficient raw material available for production
        
        Checks TOTAL available quantity across ALL COCs (shared pool)
        Any company can use material from shared pool as long as total available > required
        """
        try:
            insufficient = []
            
            for material_name, required_qty in material_requirements.items():
                # Check TOTAL available across ALL COCs (not per company)
                query = text("""
                    SELECT SUM(available_qty) as available
                    FROM coc_documents
                    WHERE material_name = :material
                    AND is_active = 1
                    AND available_qty > 0
                """)
                
                result = db.session.execute(query, {
                    'material': material_name
                }).fetchone()
                
                available = float(result[0]) if result[0] else 0
                
                if available < required_qty:
                    insufficient.append({
                        'material': material_name,
                        'required': required_qty,
                        'available': available,
                        'shortage': required_qty - available
                    })
            
            if insufficient:
                return {
                    "success": False,
                    "valid": False,
                    "message": "Insufficient raw material in shared pool",
                    "insufficient": insufficient
                }
            
            return {"success": True, "valid": True, "message": "Sufficient material available"}
            
        except Exception as e:
            return {"success": False, "message": str(e)}
    
    @staticmethod
    def consume_material(company_name, material_name, quantity, production_date, lot_number=None):
        """Update consumed quantity for materials
        
        Consumes from shared pool using FIFO (oldest COC first)
        Material is consumed from ANY available COC, not company-specific
        """
        try:
            # Find COC records with available material (FIFO - oldest first)
            query = text("""
                SELECT id, available_qty, lot_batch_no, invoice_no
                FROM coc_documents
                WHERE material_name = :material
                AND available_qty > 0
                AND is_active = 1
                ORDER BY invoice_date ASC, id ASC
            """)
            
            coc_records = db.session.execute(query, {
                'material': material_name
            }).fetchall()
            
            remaining = quantity
            consumed_from_cocs = []
            
            for row in coc_records:
                if remaining <= 0:
                    break
                
                coc_id = row[0]
                available = row[1]
                coc_lot = row[2]
                coc_invoice = row[3]
                
                consume_qty = min(remaining, available)
                
                # Update consumed quantity
                update_query = text("""
                    UPDATE coc_documents 
                    SET consumed_qty = consumed_qty + :consume
                    WHERE id = :id
                """)
                
                db.session.execute(update_query, {'consume': consume_qty, 'id': coc_id})
                
                # Log consumption
                log_query = text("""
                    INSERT INTO material_consumption (
                        production_date, company_name, material_type, 
                        coc_id, lot_number, consumed_quantity
                    ) VALUES (:date, :company, :material, :coc_id, :lot, :qty)
                """)
                
                db.session.execute(log_query, {
                    'date': production_date,
                    'company': company_name,
                    'material': material_name,
                    'coc_id': coc_id,
                    'lot': f"{coc_lot} (Invoice: {coc_invoice})",
                    'qty': consume_qty
                })
                
                consumed_from_cocs.append({
                    'coc_id': coc_id,
                    'lot': coc_lot,
                    'invoice': coc_invoice,
                    'consumed': consume_qty
                })
                
                remaining -= consume_qty
            
            db.session.commit()
            
            return {
                "success": True, 
                "message": f"Consumed {quantity} from {len(consumed_from_cocs)} COC(s)",
                "consumed_from": consumed_from_cocs
            }
            
        except Exception as e:
            db.session.rollback()
            return {"success": False, "message": str(e)}

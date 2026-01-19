# Models initialization
from app.models.database import db, Company, ProductionRecord, BomMaterial, RejectedModule
from app.models.whatsapp_alert_log import WhatsAppAlertLog
from app.models.pdi_models import (
    MasterOrder, PDIBatch, ModuleSerialNumber, 
    COCDocument, PDICOCUsage, PDIRawMaterial, MasterFTRTemplate
)

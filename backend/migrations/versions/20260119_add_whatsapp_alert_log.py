"""
Alembic migration script to add whatsapp_alert_log table
"""
from alembic import op
import sqlalchemy as sa

def upgrade():
    op.create_table(
        'whatsapp_alert_log',
        sa.Column('id', sa.Integer, primary_key=True),
        sa.Column('serial_number', sa.String(100), nullable=False, index=True),
        sa.Column('alert_type', sa.String(50), nullable=False, index=True),
        sa.Column('sent_at', sa.DateTime, nullable=False, server_default=sa.func.now()),
    )

def downgrade():
    op.drop_table('whatsapp_alert_log')

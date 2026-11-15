"""Authenticated lead reporting and manual lifecycle review. No forwarding."""
import csv
import json
import re
from datetime import date
from io import StringIO

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.admin_auth import require_admin_session
from app.db import get_db
from app.lead_schemas import LeadStatus, LeadUpdate
from app.lead_workflow import lead_report, report_query, serialize_lead, update_lead
from app.models import LeadRecord

router = APIRouter(dependencies=[Depends(require_admin_session)])


class LeadFilters(BaseModel):
    manufacturer: str | None = None
    productId: str | None = None
    status: LeadStatus | None = None
    includeDemo: bool = False
    dateFrom: date | None = None
    dateTo: date | None = None
    page: int = 1
    pageSize: int = 50


def filters(
    manufacturer: str | None = Query(None, max_length=255),
    productId: str | None = Query(None, max_length=120),
    status: LeadStatus | None = None,
    includeDemo: bool = False,
    dateFrom: date | None = None,
    dateTo: date | None = None,
    page: int = Query(1, ge=1, le=1_000_000),
    pageSize: int = Query(50, ge=1, le=100),
):
    if (dateFrom and dateTo and dateFrom > dateTo) or dateTo == date.max:
        raise HTTPException(422, 'Choose a valid inclusive date range.')
    return LeadFilters(manufacturer=manufacturer, productId=productId, status=status, includeDemo=includeDemo,
                       dateFrom=dateFrom, dateTo=dateTo, page=page, pageSize=pageSize)


@router.get('/reports/leads')
def report(response: Response, selected: LeadFilters = Depends(filters), db: Session = Depends(get_db)):
    response.headers['Cache-Control'] = 'no-store'
    return lead_report(db, selected)


@router.patch('/leads/{lead_id}')
def patch(lead_id: int, payload: LeadUpdate, response: Response, db: Session = Depends(get_db)):
    response.headers['Cache-Control'] = 'no-store'
    return update_lead(db, lead_id, payload)


CSV_FIELDS = ['id', 'name', 'email', 'phone', 'role', 'intent', 'timeline', 'scope', 'productId', 'productName',
              'manufacturer', 'propertyAddress', 'zip', 'contactConsent', 'shareConsent', 'isDemo',
              'assessmentContext', 'status', 'adminNotes', 'revision', 'createdAt', 'updatedAt']


def safe_cell(value):
    if value is None:
        return ''
    if isinstance(value, dict):
        value = json.dumps(value, ensure_ascii=False, sort_keys=True)
    if isinstance(value, bool):
        return 'true' if value else 'false'
    value = str(value).replace('\x00', '')
    # Quoting CSV alone does not neutralize spreadsheet formulas. Account for
    # leading whitespace/control/BOM characters that spreadsheets may ignore.
    candidate = re.sub(r'^[\s\ufeff]+', '', value)
    if candidate.startswith(('=', '+', '-', '@')) or value.startswith(('\t', '\r', '\n')):
        return "'" + value
    return value


@router.get('/reports/leads/export')
def export(selected: LeadFilters = Depends(filters), db: Session = Depends(get_db)):
    bind = db.get_bind()
    def chunks():
        buffer = StringIO(newline='')
        writer = csv.writer(buffer, lineterminator='\r\n')
        writer.writerow(CSV_FIELDS)
        yield buffer.getvalue()
        # Own the streaming session: supported FastAPI versions may close yield
        # dependencies before StreamingResponse has finished iterating.
        with Session(bind=bind) as export_db:
            rows = export_db.execute(report_query(selected).order_by(LeadRecord.created_at.desc(), LeadRecord.id.desc()).execution_options(yield_per=200))
            for row in rows:
                buffer.seek(0); buffer.truncate(0)
                item = serialize_lead(*row)
                writer.writerow([safe_cell(item.get(field)) for field in CSV_FIELDS])
                yield buffer.getvalue()
    # Export uses all matching records, regardless of the report's current page.
    return StreamingResponse(chunks(), media_type='text/csv; charset=utf-8',
                             headers={'Content-Disposition':'attachment; filename="leads.csv"', 'Cache-Control':'no-store', 'X-Content-Type-Options':'nosniff'})

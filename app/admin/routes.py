from fastapi import APIRouter
from fastapi import Depends
from fastapi import Form
from fastapi import Request
from fastapi.responses import RedirectResponse
from fastapi.templating import Jinja2Templates

from sqlalchemy.orm import Session

from app.core.dependencies import get_db
from app.models.customer import Customer
from app.models.meeting_point import MeetingPoint
from app.models.message import Message

router = APIRouter(
    prefix="/admin",
    tags=["admin"]
)

templates = Jinja2Templates(directory="app/templates")


@router.get("/")
def admin_dashboard(
    request: Request,
    db: Session = Depends(get_db)
):
    meeting_points = db.query(MeetingPoint).all()

    customers = db.query(Customer).order_by(
        Customer.last_seen_at.desc()
    ).all()

    return templates.TemplateResponse(
        request=request,
        name="admin_dashboard.html",
        context={
            "meeting_points": meeting_points,
            "customers": customers
        }
    )


@router.get("/customers/{customer_id}")
def customer_detail(
    customer_id: int,
    request: Request,
    db: Session = Depends(get_db)
):
    customer = db.query(Customer).filter(
        Customer.id == customer_id
    ).first()

    messages = db.query(Message).filter(
        Message.customer_id == customer_id
    ).order_by(
        Message.created_at.asc()
    ).all()

    return templates.TemplateResponse(
        request=request,
        name="customer_detail.html",
        context={
            "customer": customer,
            "messages": messages
        }
    )


@router.post("/meeting-points")
def create_meeting_point(
    name: str = Form(...),
    address: str = Form(...),
    google_maps_link: str = Form(...),
    is_default: bool = Form(False),
    db: Session = Depends(get_db)
):
    if is_default:
        db.query(MeetingPoint).update(
            {"is_default": False}
        )

    meeting_point = MeetingPoint(
        name=name,
        address=address,
        google_maps_link=google_maps_link,
        is_default=is_default,
        is_active=True
    )

    db.add(meeting_point)
    db.commit()

    return RedirectResponse(
        url="/admin",
        status_code=303
    )


@router.post("/meeting-points/{meeting_point_id}/default")
def set_default_meeting_point(
    meeting_point_id: int,
    db: Session = Depends(get_db)
):
    db.query(MeetingPoint).update(
        {"is_default": False}
    )

    meeting_point = db.query(MeetingPoint).filter(
        MeetingPoint.id == meeting_point_id
    ).first()

    meeting_point.is_default = True
    meeting_point.is_active = True

    db.commit()

    return RedirectResponse(
        url="/admin",
        status_code=303
    )


@router.post("/meeting-points/{meeting_point_id}/update")
def update_meeting_point(
    meeting_point_id: int,
    name: str = Form(...),
    address: str = Form(...),
    google_maps_link: str = Form(...),
    is_active: bool = Form(False),
    db: Session = Depends(get_db)
):
    meeting_point = db.query(MeetingPoint).filter(
        MeetingPoint.id == meeting_point_id
    ).first()

    meeting_point.name = name
    meeting_point.address = address
    meeting_point.google_maps_link = google_maps_link
    meeting_point.is_active = is_active

    db.commit()

    return RedirectResponse(
        url="/admin",
        status_code=303
    )


from fastapi.responses import JSONResponse

from app.services.geocoding import search_locations


@router.get("/search-location")
def search_location(query: str):
    results = search_locations(query)

    return JSONResponse(results)


@router.post("/meeting-points/{meeting_point_id}/delete")
def delete_meeting_point(
    meeting_point_id: int,
    db: Session = Depends(get_db)
):
    meeting_point = db.query(MeetingPoint).filter(
        MeetingPoint.id == meeting_point_id
    ).first()

    if meeting_point:
        db.delete(meeting_point)
        db.commit()

    return RedirectResponse(
        url="/admin",
        status_code=303
    )

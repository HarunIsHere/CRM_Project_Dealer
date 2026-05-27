from fastapi import APIRouter
from fastapi import Depends
from sqlalchemy.orm import Session

from app.core.dependencies import get_db
from app.models.meeting_point import MeetingPoint

router = APIRouter(
    prefix="/meeting-points",
    tags=["meeting-points"]
)


@router.get("/")
def get_meeting_points(db: Session = Depends(get_db)):
    return db.query(MeetingPoint).all()


@router.post("/")
def create_meeting_point(
    name: str,
    address: str,
    google_maps_link: str,
    is_default: bool = False,
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
    db.refresh(meeting_point)

    return meeting_point


@router.patch("/{meeting_point_id}/default")
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
    db.refresh(meeting_point)

    return meeting_point

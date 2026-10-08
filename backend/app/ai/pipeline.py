"""Background face processing and candidate generation."""
from datetime import datetime, timezone
import uuid
from datetime import timedelta
from typing import Any, Dict, Optional

from app.ai.faces import extract_face_embedding
from app.ai.matching import cosine_similarity, haversine_km, score_pair
from app.core.config import settings
from app.core.database import db
from app.core.logging import logger
from app.models.enums import CaseStatus, MatchStatus


def _weights() -> Dict[str, float]:
    return {
        "face": settings.WEIGHT_FACE,
        "age_gender": settings.WEIGHT_AGE_GENDER,
        "location": settings.WEIGHT_LOCATION,
        "description": settings.WEIGHT_DESCRIPTION,
    }


def process_uploaded_photo(photo_id: str, case_id: str, image_bytes: bytes) -> None:
    """Record face-processing outcome; AI failures never turn into successful matches."""
    photo = db.photos.get(photo_id)
    if not photo:
        logger.error("Photo %s disappeared before AI processing.", photo_id)
        return
    try:
        result = extract_face_embedding(image_bytes)
        photo.update({
            "face_detected": result.face_count > 0,
            "face_count": result.face_count,
            "quality_score": result.quality_score,
            "processing_status": result.status,
            "processing_error": result.reason,
        })
        if result.embedding:
            person = next((item for item in db.persons.values() if item["case_id"] == case_id), None)
            if person is None:
                raise RuntimeError("Person record for uploaded photo was not found.")
            embedding_id = str(uuid.uuid4())
            db.face_embeddings[embedding_id] = {
                "id": embedding_id,
                "photo_id": photo_id,
                "case_id": case_id,
                "person_id": person["id"],
                "embedding": result.embedding,
                "model_name": settings.INSIGHTFACE_MODEL_NAME,
                "bounding_box": result.bounding_box,
                "created_at": datetime.now(timezone.utc).isoformat(),
            }
            _flag_possible_duplicates(case_id, result.embedding, person)
    except Exception as exc:
        photo.update({"processing_status": "failed", "processing_error": str(exc)})
        logger.exception("Face processing failed for photo %s.", photo_id)
    finally:
        run_candidate_matching(case_id)


def _case_embedding(case_id: str) -> Optional[list]:
    embeddings = [
        item["embedding"] for item in db.face_embeddings.values()
        if item.get("case_id") == case_id
    ]
    return embeddings[0] if embeddings else None


def run_candidate_matching(case_id: str) -> None:
    case = db.cases.get(case_id)
    if not case or case.get("status") in (CaseStatus.REUNITED.value, CaseStatus.CLOSED.value):
        return
    person = next((item for item in db.persons.values() if item["case_id"] == case_id), None)
    if not person:
        return

    candidate_count = 0
    for other_id, other_case in list(db.cases.items()):
        if other_id == case_id or other_case.get("type") == case.get("type"):
            continue
        if other_case.get("disaster_id") != case.get("disaster_id"):
            continue
        if other_case.get("status") in (CaseStatus.REUNITED.value, CaseStatus.CLOSED.value):
            continue
        missing_person_candidate = person if case["type"] == "missing" else next(
            (item for item in db.persons.values() if item["case_id"] == other_id), None
        )
        found_person_candidate = next(
            (item for item in db.persons.values() if item["case_id"] == other_id), None
        ) if case["type"] == "missing" else person
        if missing_person_candidate and found_person_candidate:
            missing_time = _parse_time(missing_person_candidate.get("last_seen_time"))
            found_time = _parse_time(found_person_candidate.get("last_seen_time"))
            if missing_time and found_time and abs(found_time - missing_time) > timedelta(days=settings.MAX_MATCH_AGE_DAYS):
                continue
        pair = (
            (case_id, other_id) if case["type"] == "missing"
            else (other_id, case_id)
        )
        if any(
            (match.get("missing_case_id"), match.get("found_case_id")) == pair
            for match in db.match_candidates.values()
        ):
            continue
        other_person = next(
            (item for item in db.persons.values() if item["case_id"] == other_id), None
        )
        if not other_person:
            continue
        distance = haversine_km(
            person.get("last_seen_lat"), person.get("last_seen_lng"),
            other_person.get("last_seen_lat"), other_person.get("last_seen_lng"),
        )
        if distance is not None and distance > settings.MAX_MATCH_DISTANCE_KM:
            continue

        left_embedding, right_embedding = _case_embedding(case_id), _case_embedding(other_id)
        face_score = None
        if left_embedding is not None and right_embedding is not None:
            face_score = max(0.0, cosine_similarity(left_embedding, right_embedding))
        match_score, explanation, priority = score_pair(
            person, other_person, face_score, _weights()
        )
        if match_score < settings.FACE_MATCH_THRESHOLD * 100:
            continue

        match_id = str(uuid.uuid4())
        left_person = person if case["type"] == "missing" else other_person
        right_person = other_person if case["type"] == "missing" else person
        db.match_candidates[match_id] = {
            "id": match_id,
            "missing_case_id": pair[0],
            "found_case_id": pair[1],
            "face_similarity": face_score or 0.0,
            "age_gender_score": _score_demographics(left_person, right_person),
            "location_score": _score_location(left_person, right_person),
            "text_score": _score_description(left_person, right_person),
            "match_score": match_score,
            "priority_score": priority,
            "score_explanation": explanation,
            "status": MatchStatus.PENDING_REVIEW.value,
            "reviewed_by": None,
            "reviewed_at": None,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        db.audit_logs.append({
            "id": str(uuid.uuid4()),
            "actor_id": None,
            "action": "MATCH_CANDIDATE_GENERATED",
            "resource_type": "match_candidates",
            "resource_id": match_id,
            "changes": {
                "missing_case_id": pair[0],
                "found_case_id": pair[1],
                "match_score": match_score,
                "status": MatchStatus.PENDING_REVIEW.value,
            },
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        missing_person = db.persons.get(left_person["id"])
        if missing_person and missing_person.get("contact_email"):
            try:
                from app.models.enums import NotificationChannel
                from app.schemas.notification import NotificationSendRequest
                from app.services.notification_service import NotificationService
                NotificationService.send(NotificationSendRequest(
                    case_id=pair[0],
                    match_id=match_id,
                    recipient_target=missing_person["contact_email"],
                    channel=NotificationChannel.EMAIL,
                    title="A possible match is under authority review",
                    message=(
                        "Our response team has identified a possible case link and is reviewing it. "
                        "This is not confirmation. Please do not travel or share personal details "
                        "until an authorized officer contacts you."
                    ),
                    payload={"case_id": pair[0], "event": "candidate_found"},
                ))
            except Exception:
                logger.exception("Could not queue candidate notification for match %s.", match_id)
        for matched_id in pair:
            db.cases[matched_id]["status"] = CaseStatus.CANDIDATE_FOUND.value
            db.cases[matched_id]["updated_at"] = datetime.now(timezone.utc).isoformat()
        candidate_count += 1
    if candidate_count:
        logger.info("Created %s authority-review candidate(s) for case %s.", candidate_count, case_id)
    elif case["status"] == CaseStatus.REPORTED.value:
        case["status"] = CaseStatus.SEARCHING.value


def _flag_possible_duplicates(case_id: str, embedding: list, person: Dict[str, Any]) -> None:
    case = db.cases[case_id]
    duplicate_ids = []
    for existing in db.cases.values():
        if existing["id"] == case_id or existing["type"] != case["type"]:
            continue
        existing_person = next(
            (item for item in db.persons.values() if item["case_id"] == existing["id"]), None
        )
        if not existing_person:
            continue
        score = 0.0
        for existing_embedding in db.face_embeddings.values():
            if existing_embedding.get("case_id") == existing["id"]:
                score = max(
                    score,
                    cosine_similarity(embedding, existing_embedding["embedding"]),
                )
        same_age = (
            person.get("approximate_age") is not None
            and person.get("approximate_age") == existing_person.get("approximate_age")
        )
        same_gender = person.get("gender") == existing_person.get("gender")
        if score >= settings.DUPLICATE_CHECK_THRESHOLD and same_age and same_gender:
            duplicate_ids.append(existing["id"])
    if duplicate_ids:
        case["potential_duplicate_case_ids"] = duplicate_ids
        db.audit_logs.append({
            "id": str(uuid.uuid4()),
            "actor_id": None,
            "action": "POTENTIAL_DUPLICATE_FLAGGED",
            "resource_type": "cases",
            "resource_id": case_id,
            "changes": {"possible_duplicate_ids": duplicate_ids},
            "created_at": datetime.now(timezone.utc).isoformat(),
        })


def _score_demographics(first: Dict[str, Any], second: Dict[str, Any]) -> float:
    from app.ai.matching import _age_gender_score
    return _age_gender_score(first, second)[0]


def _score_location(first: Dict[str, Any], second: Dict[str, Any]) -> float:
    distance = haversine_km(
        first.get("last_seen_lat"), first.get("last_seen_lng"),
        second.get("last_seen_lat"), second.get("last_seen_lng"),
    )
    if distance is None:
        return 0.5
    import math
    return math.exp(-distance / 25)


def _score_description(first: Dict[str, Any], second: Dict[str, Any]) -> float:
    from app.ai.matching import _description_tokens
    left, right = _description_tokens(first), _description_tokens(second)
    return len(left & right) / len(left | right) if left | right else 0.0


def _parse_time(value: Any) -> Optional[datetime]:
    if not value:
        return None
    try:
        moment = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
        return moment.replace(tzinfo=timezone.utc) if moment.tzinfo is None else moment
    except ValueError:
        return None

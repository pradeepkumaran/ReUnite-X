"""Deterministic multimodal scoring helpers used by the matching pipeline."""
from datetime import datetime, timezone
import math
import re
from typing import Any, Dict, Iterable, Optional, Tuple


def cosine_similarity(first: Iterable[float], second: Iterable[float]) -> float:
    left, right = list(first), list(second)
    if len(left) != len(right) or not left:
        raise ValueError("Face embeddings must have the same non-zero dimension.")
    dot = sum(a * b for a, b in zip(left, right))
    left_norm = math.sqrt(sum(value * value for value in left))
    right_norm = math.sqrt(sum(value * value for value in right))
    if not left_norm or not right_norm:
        return 0.0
    return max(-1.0, min(1.0, dot / (left_norm * right_norm)))


def haversine_km(
    lat_a: Optional[float],
    lng_a: Optional[float],
    lat_b: Optional[float],
    lng_b: Optional[float],
) -> Optional[float]:
    if None in (lat_a, lng_a, lat_b, lng_b):
        return None
    radians = math.pi / 180
    delta_lat = (lat_b - lat_a) * radians
    delta_lng = (lng_b - lng_a) * radians
    value = (
        math.sin(delta_lat / 2) ** 2
        + math.cos(lat_a * radians) * math.cos(lat_b * radians)
        * math.sin(delta_lng / 2) ** 2
    )
    return 6371.0088 * 2 * math.asin(min(1, math.sqrt(value)))


def _description_tokens(person: Dict[str, Any]) -> set:
    text = " ".join(
        str(person.get(key) or "")
        for key in ("description", "clothing_details", "physical_marks")
    ).lower()
    return {token for token in re.findall(r"[a-z0-9]{3,}", text)}


def _age_gender_score(first: Dict[str, Any], second: Dict[str, Any]) -> Tuple[float, str]:
    first_gender, second_gender = first.get("gender"), second.get("gender")
    gender_unknown = {None, "", "unknown"}
    gender_score = 1.0 if (
        first_gender in gender_unknown or second_gender in gender_unknown
        or first_gender == second_gender
    ) else 0.0

    first_age, second_age = first.get("approximate_age"), second.get("approximate_age")
    if first_age is None or second_age is None:
        age_score = 1.0
        age_detail = "Age unavailable"
    else:
        age_delta = abs(first_age - second_age)
        age_score = max(0.0, 1.0 - age_delta / 15.0)
        age_detail = f"Reported ages differ by {age_delta} year(s)"
    return (gender_score + age_score) / 2, age_detail


def score_pair(
    missing_person: Dict[str, Any],
    found_person: Dict[str, Any],
    face_similarity: Optional[float],
    weights: Dict[str, float],
) -> Tuple[float, Dict[str, Any], float]:
    """Return 0-100 score, a human-readable breakdown, and priority."""
    demographic_score, age_detail = _age_gender_score(missing_person, found_person)
    distance = haversine_km(
        missing_person.get("last_seen_lat"), missing_person.get("last_seen_lng"),
        found_person.get("last_seen_lat"), found_person.get("last_seen_lng"),
    )
    location_score = 0.5 if distance is None else math.exp(-distance / 25)
    missing_tokens = _description_tokens(missing_person)
    found_tokens = _description_tokens(found_person)
    overlap = sorted(missing_tokens & found_tokens)
    union = missing_tokens | found_tokens
    text_score = len(overlap) / len(union) if union else 0.0

    components = {
        "face": (face_similarity, weights["face"]),
        "demographics": (demographic_score, weights["age_gender"]),
        "location": (location_score, weights["location"]),
        "description": (text_score, weights["description"]),
    }
    available_weight = sum(weight for value, weight in components.values() if value is not None)
    blended = sum(value * weight for value, weight in components.values() if value is not None)
    score = 100 * blended / available_weight if available_weight else 0.0

    reasons = list(missing_person.get("vulnerability_reasons") or [])
    reasons.extend(found_person.get("vulnerability_reasons") or [])
    ages = [age for age in (
        missing_person.get("approximate_age"), found_person.get("approximate_age")
    ) if age is not None]
    medical_need = bool(
        missing_person.get("medical_notes") or found_person.get("medical_notes")
    )
    vulnerable = bool(
        missing_person.get("is_vulnerable")
        or found_person.get("is_vulnerable")
        or reasons
        or medical_need
        or any(age < 18 or age >= 65 for age in ages)
    )
    observed_at = missing_person.get("last_seen_time")
    elapsed_hours = 0.0
    if observed_at:
        try:
            moment = datetime.fromisoformat(str(observed_at).replace("Z", "+00:00"))
            if moment.tzinfo is None:
                moment = moment.replace(tzinfo=timezone.utc)
            elapsed_hours = max(0.0, (datetime.now(timezone.utc) - moment).total_seconds() / 3600)
        except ValueError:
            elapsed_hours = 0.0
    priority = min(100.0, 35 + (20 if vulnerable else 0) + min(25, elapsed_hours / 4) + score * 0.2)
    explanation = {
        "face_similarity_pct": round((face_similarity or 0) * 100, 1),
        "age_gender_match": age_detail,
        "distance_km": round(distance, 2) if distance is not None else None,
        "description_keywords_overlap": overlap,
        "vulnerability_boost": (
            "Vulnerability, age-related urgency, or medical need applied"
            if vulnerable else None
        ),
        "weights": weights,
        "face_signal_available": face_similarity is not None,
    }
    return round(score, 2), explanation, round(priority, 2)

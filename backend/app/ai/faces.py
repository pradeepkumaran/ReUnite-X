"""Face detection and 512-dimensional ArcFace embedding extraction."""
from dataclasses import dataclass
from typing import Dict, List, Optional

from app.core.config import settings

_face_analyzer = None


@dataclass
class FaceResult:
    status: str
    face_count: int
    quality_score: float
    embedding: Optional[List[float]] = None
    bounding_box: Optional[Dict[str, int]] = None
    reason: Optional[str] = None


def extract_face_embedding(image_bytes: bytes) -> FaceResult:
    """Detect exactly one sufficiently clear face and produce its normalized ArcFace vector."""
    try:
        import cv2
        import numpy as np
        from insightface.app import FaceAnalysis
    except ImportError as exc:
        raise RuntimeError(
            "Face processing requires opencv-python-headless and insightface to be installed."
        ) from exc

    global _face_analyzer
    if _face_analyzer is None:
        try:
            _face_analyzer = FaceAnalysis(
                name=settings.INSIGHTFACE_MODEL_NAME,
                providers=["CPUExecutionProvider"],
            )
            _face_analyzer.prepare(ctx_id=-1, det_size=(640, 640))
        except Exception as exc:
            raise RuntimeError("InsightFace model initialization failed.") from exc

    encoded = np.frombuffer(image_bytes, dtype=np.uint8)
    image = cv2.imdecode(encoded, cv2.IMREAD_COLOR)
    if image is None:
        return FaceResult("invalid_image", 0, 0.0, reason="Image could not be decoded.")
    if min(image.shape[:2]) < 160:
        return FaceResult("low_quality", 0, 0.0, reason="Image dimensions are too small.")

    faces = _face_analyzer.get(image)
    if not faces:
        return FaceResult("no_face", 0, 0.0, reason="No face was detected.")
    if len(faces) != 1:
        return FaceResult(
            "multiple_faces", len(faces), 0.0,
            reason="Upload a photo containing one clearly identifiable person.",
        )

    face = faces[0]
    x1, y1, x2, y2 = (int(value) for value in face.bbox)
    width, height = x2 - x1, y2 - y1
    if min(width, height) < settings.MIN_FACE_SIZE_PX:
        return FaceResult("low_quality", 1, 0.0, reason="Detected face is too small.")
    gray = cv2.cvtColor(image[max(0, y1):y2, max(0, x1):x2], cv2.COLOR_BGR2GRAY)
    sharpness = float(cv2.Laplacian(gray, cv2.CV_64F).var()) if gray.size else 0.0
    if sharpness < settings.MIN_FACE_SHARPNESS:
        return FaceResult("low_quality", 1, min(1.0, sharpness / settings.MIN_FACE_SHARPNESS),
                          reason="Face image is too blurry for reliable matching.")

    raw_embedding = np.asarray(face.embedding, dtype=np.float32)
    if raw_embedding.size != 512:
        return FaceResult("model_error", 1, 0.0, reason="Embedding model returned an unexpected vector size.")
    norm = float(np.linalg.norm(raw_embedding))
    if not norm:
        return FaceResult("model_error", 1, 0.0, reason="Embedding model returned an empty vector.")
    quality = min(1.0, sharpness / (settings.MIN_FACE_SHARPNESS * 4))
    return FaceResult(
        "processed",
        1,
        quality,
        embedding=(raw_embedding / norm).astype(float).tolist(),
        bounding_box={"x": x1, "y": y1, "width": width, "height": height},
    )

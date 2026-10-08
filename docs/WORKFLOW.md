# REUNITE-X: End-to-End Operational Workflow

This document specifies the exact lifecycle of a disaster event, missing/found person report generation, offline synchronization, AI candidate generation, authority verification, and family reunification.

---

## 1. Complete Workflow Diagram

```mermaid
sequenceDiagram
    autonumber
    actor Victim as Separated Individual
    actor Family as Family / Reporter
    actor Vol as Field Volunteer
    actor Auth as Disaster Authority / Officer
    participant PWA as Client App (PWA & Dexie)
    participant API as FastAPI Backend
    participant DB as Supabase PostgreSQL
    participant AI as AI Matching Engine
    participant Notify as Notification Engine (FCM / Email)

    Note over Victim, Auth: PHASE 1: DISASTER EVENT & INTAKE
    Victim-->>Family: Disaster strikes (Flood / Cyclone / Earthquake); Families separated
    alt Family has internet connection
        Family->>PWA: Report Missing Person (Online)
        PWA->>API: POST /cases (with photo & coordinates)
    else Volunteer in disconnected zero-network zone
        Vol->>PWA: Report Missing / Found Person (Offline Mode)
        PWA->>PWA: Store locally in IndexedDB (Dexie.js) with client UUID
        Note over Vol, PWA: Volunteer moves to relief camp with connectivity
        PWA->>API: POST /sync/batch (Bulk sync queued offline records)
    end
    API->>DB: Save Case & Person record (Status: "reported")

    Note over API, AI: PHASE 2: INGESTION, DUPLICATE CHECK & EMBEDDING
    API->>AI: Trigger Background Task (Photo AI processing)
    AI->>AI: Detect face, align landmarks & generate 512-d vector
    AI->>DB: Check for duplicate submissions (Cosine sim > 0.92)
    alt High Duplicate Confidence
        AI->>DB: Flag case as potential duplicate; attach duplicate warning
    end
    AI->>DB: Save face embedding to pgvector

    Note over AI, DB: PHASE 3: MULTIMODAL CANDIDATE MATCHING
    AI->>DB: Query missing vs found cases using pgvector cosine distance
    AI->>AI: Compute Multimodal Match Score (0 - 100)
    Note right of AI: Blend: Face (60%) + Demographics (15%) + Geo (15%) + Description (10%)
    AI->>AI: Compute Priority Score (Child, Elderly, Medical, Hours Elapsed)
    alt Match Score >= Match Threshold (e.g., 65%)
        AI->>DB: Create Match Candidate (Status: "pending_review")
        AI->>DB: Transition Case Status to "candidate_found"
    end

    Note over Auth, DB: PHASE 4: HUMAN AUTHORITY VERIFICATION (MANDATORY GATE)
    Auth->>PWA: Access Authority Dashboard Match Queue
    PWA->>API: GET /matches (Ranked by Priority Score)
    API-->>PWA: Return candidate pairs with side-by-side photos & score breakdown
    Auth->>Auth: Human official inspects evidence, clothing, scars, notes
    
    alt Decision: VERIFIED
        Auth->>PWA: Submit Verification ("VERIFIED" + updated location + official notes)
        PWA->>API: POST /matches/{id}/verify
        API->>DB: Insert record into verifications table
        API->>DB: Update match_candidates status -> "verified"
        API->>DB: Update missing & found case status -> "verified"
        API->>DB: Update last confirmed location coordinates
        API->>DB: Record immutable entry in audit_log
        
        Note over API, Notify: PHASE 5: NOTIFICATION & REUNIFICATION
        API->>Notify: Dispatch High-Priority Alert
        Notify->>Family: Send FCM Push Notification & Email with safe contact instructions
        Family->>Auth: Family connects with authority / relief shelter
        Auth->>PWA: Update Case Status -> "reunited" -> "closed"
        PWA->>API: PATCH /cases/{id}/status ("reunited" / "closed")
        API->>DB: Finalize case closure & archive in audit log
    else Decision: REJECTED
        Auth->>PWA: Submit Rejection ("REJECTED" + reason)
        PWA->>API: POST /matches/{id}/reject
        API->>DB: Update match_candidates status -> "rejected"
        API->>DB: Revert Case Status -> "searching"
        API->>DB: Record rejection in audit_log
        Note over API, AI: Case continues to be evaluated in background search loop
    end
```

---

## 2. Detailed Phase Breakdown

### Phase 1: Intake and Offline Collection
- **Field Accessibility**: Relieves bottlenecks during power and cellular outages. Volatile connections do not result in lost data.
- **Client UUID Generation**: Frontend assigns RFC 4122 v4 UUIDs before persisting in Dexie.js so that subsequent sync operations are idempotent.
- **Consent Collection**: Formal consent checkboxes are collected at the point of registration to comply with disaster privacy policies.

### Phase 2: Face Processing & Duplicate Detection
- **Detection & Cropping**: Photos undergo face detection using OpenCV / MTCNN / RetinaFace.
- **Low-Quality / No-Face Handling**: Images with no detected face or multiple ambiguous faces are flagged gracefully. Cases are still searchable via metadata (name, clothing, age, marks).
- **Duplicate Prevention**: Before creating candidates, the backend checks existing cases of the same type (missing vs missing or found vs found). If cosine similarity exceeds 0.92 alongside overlapping demographics, it flags the record to prevent database bloating.

### Phase 3: Multimodal Matching & Priority Scoring
- **Cosine Distance in pgvector**: Rapid candidate retrieval using the HNSW index on the 512-dimensional vector.
- **Weighted Blend (0 to 100)**:
  $$\text{Match Score} = (0.60 \times S_{\text{face}}) + (0.15 \times S_{\text{demographics}}) + (0.15 \times S_{\text{location}}) + (0.10 \times S_{\text{text}})$$
- **Vulnerability Priority**:
  - Minors ($< 18$ years): $+20$ points
  - Elderly ($> 65$ years): $+15$ points
  - Critical medical condition / prescription need: $+15$ points
  - Elapsed hours since disappearance: scaled urgency multiplier.

### Phase 4: Authority Human-in-the-Loop Verification
- **Strict Prohibition of Auto-Confirmation**: No match is ever acted upon or published automatically. All prospective matches appear in the Authority Review Queue.
- **Side-by-Side Review Interface**: Officials compare high-resolution photos, facial landmarks, clothing descriptions, location history, and reporter contact statements.
- **Accountability**: Every approval or rejection requires verified officer credentials, notes, and records an unalterable entry in `audit_log`.

### Phase 5: Notification, Family Contact & Case Closure
- **Channels**: Multi-channel alert dispatching Firebase Cloud Messaging (FCM) to the mobile PWA and transactional email (Resend / SMTP) to registered family emails.
- **Safe Contact Protocol**: Contact details of minors and found victims remain shielded; official relief center coordination details are provided instead.
- **Reunification & Closure**: When the individual is physically in family custody, the case status transitions to `reunited`, then `closed`.

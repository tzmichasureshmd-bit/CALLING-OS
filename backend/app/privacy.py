"""Recording eligibility for CallNexa.

The explicit Call Recording switch on the mobile device controls whether new
call audio is captured and submitted. Once an authenticated device submits a
valid recording for one of its own calls, every classification and number is
eligible for storage, playback, transcription, and summaries.

Authorization, organization/device ownership, content validation, file-size
limits, and private-object access remain enforced by the corresponding routes.
"""

from sqlalchemy.orm import Session

from .models import Call


def recording_denial_reason(db: Session, call: Call) -> str | None:
    """Return no product-policy denial for a valid authenticated upload.

    Retaining this small compatibility function keeps older route imports
    stable while deliberately removing business, personal, and excluded-number
    recording gates. The database/session arguments are part of that existing
    interface and are intentionally unused.
    """
    del db, call
    return None

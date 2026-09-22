from .auth_routes import auth_bp
from .warga_routes import warga_bp
from .spk_routes import spk_bp
from .chat_routes import chat_bp

__all__ = [
    "auth_bp",
    "warga_bp",
    "spk_bp",
    "chat_bp"
]
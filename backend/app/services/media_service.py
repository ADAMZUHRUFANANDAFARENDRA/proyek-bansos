import os
import uuid
from werkzeug.utils import secure_filename
from app.config import Config

class MediaService:
    ALLOWED_IMAGE_EXT = {'png', 'jpg', 'jpeg', 'webp', 'gif'}
    ALLOWED_AUDIO_EXT = {'webm', 'wav', 'mp3', 'ogg', 'm4a'}
    ALLOWED_VIDEO_EXT = {'mp4', 'webm', 'mov'}
    ALLOWED_DOC_EXT = {'pdf', 'doc', 'docx', 'xls', 'xlsx', 'csv', 'ppt', 'pptx'}

    @classmethod
    def tentukan_tipe_media(cls, ext):
        ext = ext.lower().lstrip('.')
        if ext in cls.ALLOWED_IMAGE_EXT:
            return 'image'
        elif ext in cls.ALLOWED_AUDIO_EXT:
            return 'audio'
        elif ext in cls.ALLOWED_VIDEO_EXT:
            return 'video'
        elif ext in cls.ALLOWED_DOC_EXT:
            return 'document'
        return 'other'

    @classmethod
    def simpan_media(cls, file_storage, custom_type=None):
        """
        Menyimpan berkas yang diunggah ke folder static/uploads
        dengan nama acak UUID untuk menghindari manipulasi path atau tabrakan nama berkas.
        """
        if not file_storage or file_storage.filename == '':
            return None, None

        raw_filename = secure_filename(file_storage.filename)
        ext = raw_filename.rsplit('.', 1)[1].lower() if '.' in raw_filename else 'bin'

        # Buat nama acak unik
        unique_name = f"{int(uuid.uuid4().int % 1e10)}_{uuid.uuid4().hex[:8]}.{ext}"
        upload_dir = Config.UPLOAD_FOLDER
        os.makedirs(upload_dir, exist_ok=True)

        full_path = os.path.join(upload_dir, unique_name)
        file_storage.save(full_path)

        media_type = custom_type if custom_type else cls.tentukan_tipe_media(ext)
        relative_url = f"/static/uploads/{unique_name}"

        return relative_url, media_type
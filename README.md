# InstaVibe Kids — REST API + React

Bolalar uchun Instagram-uslubidagi ijtimoiy tarmoq. Platforma Toshkent vaqti bilan 08:00–22:00 oralig‘ida ishlaydi.

## Backend
```bat
cd StartApp
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver
```

## Frontend
Alohida terminal:
```bat
cd StartApp\react
npm install
npm run dev
```
Brauzer: http://localhost:5173

## Xavfsizlik
- 08:00–22:00 server tomonda ham tekshiriladi.
- Chat, comment va captionlarda haqoratli/18+/zararli kalit so‘zlar bloklanadi.
- Media faqat JPG/PNG/WEBP/MP4/WEBM va 25 MB gacha.
- Media fayl signaturasi tekshiriladi.
- Home feed postlar bilan birga Reels videolarini ham ko‘rsatadi.
- Profil Reels katagidan video Reels ko‘rish oynasiga ochiladi.

Eslatma: MIME/signature va matn filtrlari texnik himoya beradi; tasvir/video ichidagi har bir kadrni semantik ravishda 7+ deb tasdiqlash uchun alohida vision/moderation xizmati kerak bo‘ladi.

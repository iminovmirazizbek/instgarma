# Railway deploy

This project is configured as a single Railway service:

- React/Vite is built inside the Docker image.
- Django serves the built React app and `/plat/` REST API from the same domain.
- Gunicorn is the production web server.
- WhiteNoise serves Vite/Django static assets.
- Database migrations run automatically on container startup.

## Railway

Deploy the repository with the project root set to the folder containing `manage.py` and `Dockerfile`.

Recommended variables:

- `SECRET_KEY` — a long random production secret.
- `DEBUG=0`
- `ALLOWED_HOSTS=*` (or your Railway domain)
- `CSRF_TRUSTED_ORIGINS=https://YOUR-RAILWAY-DOMAIN`

No separate frontend service is required.

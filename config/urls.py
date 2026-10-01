
from django.contrib import admin
from django.http import FileResponse, Http404, JsonResponse
from django.urls import path, include, re_path
from django.conf import settings
from django.conf.urls.static import static


def _frontend_file(name):
    path = settings.FRONTEND_DIST / name
    if not path.exists() or not path.is_file():
        raise Http404
    return FileResponse(path.open('rb'))


def frontend_app(request, path=''):
    # BrowserRouter needs index.html for every client-side route.
    return _frontend_file('index.html')


urlpatterns = [
    path('health/', lambda request: JsonResponse({'status': 'ok'}), name='health'),
    path('admin/', admin.site.urls),
    path('plat/', include('plat.urls')),
    path('manifest.webmanifest', lambda request: _frontend_file('manifest.webmanifest'), name='manifest'),
    path('sw.js', lambda request: _frontend_file('sw.js'), name='service-worker'),
    path('pwa-192.png', lambda request: _frontend_file('pwa-192.png'), name='pwa-192'),
    path('pwa-512.png', lambda request: _frontend_file('pwa-512.png'), name='pwa-512'),
    re_path(r'^(?!static/|media/|admin/|plat/)(?:.*)$', frontend_app, name='frontend-app'),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)

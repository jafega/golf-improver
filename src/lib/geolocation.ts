export interface GeoPosition {
  lat: number;
  lng: number;
  accuracy: number;
}

/**
 * Watch GPS position with high accuracy.
 * Returns cleanup function for useEffect.
 */
export function watchPosition(
  onPosition: (pos: GeoPosition) => void,
  onError: (error: string) => void
): () => void {
  if (!('geolocation' in navigator)) {
    onError('GPS no disponible en este dispositivo');
    return () => {};
  }

  const id = navigator.geolocation.watchPosition(
    (pos) => {
      onPosition({
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
      });
    },
    (err) => {
      switch (err.code) {
        case err.PERMISSION_DENIED:
          onError('Necesitas dar permiso de ubicacion');
          break;
        case err.POSITION_UNAVAILABLE:
          onError('No se puede obtener la ubicacion');
          break;
        case err.TIMEOUT:
          onError('Tiempo de espera agotado para GPS');
          break;
        default:
          onError('Error de GPS desconocido');
      }
    },
    {
      enableHighAccuracy: true,
      maximumAge: 2000,
      timeout: 10000,
    }
  );

  return () => navigator.geolocation.clearWatch(id);
}

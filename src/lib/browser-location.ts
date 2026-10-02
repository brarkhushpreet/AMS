export function locationAccuracyLimit(radiusMeters: number) {
  return Math.min(35, Math.max(15, radiusMeters / 2));
}

export function getPreciseLocation(maxAccuracyMeters: number, timeoutMs = 18_000) {
  return new Promise<GeolocationPosition>((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("This browser cannot provide location. Use ultrasound attendance."));
      return;
    }

    let bestAccuracy = Infinity;
    let watchId: number | undefined;
    let finished = false;
    const finish = (position?: GeolocationPosition, error?: Error) => {
      if (finished) return;
      finished = true;
      window.clearTimeout(timer);
      if (watchId !== undefined) navigator.geolocation.clearWatch(watchId);
      if (position) resolve(position);
      else reject(error);
    };
    const timer = window.setTimeout(() => {
      const detail = Number.isFinite(bestAccuracy)
        ? `The best browser location was only accurate to ${Math.round(bestAccuracy)} m (need ${Math.round(maxAccuracyMeters)} m).`
        : "The browser could not determine a location in time.";
      finish(undefined, new Error(`${detail} Use ultrasound attendance instead.`));
    }, timeoutMs);

    try {
      watchId = navigator.geolocation.watchPosition(
        (position) => {
          const accuracy = position.coords.accuracy;
          if (!Number.isFinite(accuracy) || accuracy < 0) return;
          bestAccuracy = Math.min(bestAccuracy, accuracy);
          console.info("[presence:location] browser fix", {
            accuracyMeters: Math.round(accuracy),
            ageMs: Math.max(0, Date.now() - position.timestamp),
            requiredAccuracyMeters: Math.round(maxAccuracyMeters),
          });
          if (accuracy <= maxAccuracyMeters && Date.now() - position.timestamp < 5_000) {
            finish(position);
          }
        },
        (error) => {
          if (error.code === error.PERMISSION_DENIED) {
            finish(undefined, new Error("Precise location permission was denied. Use ultrasound attendance instead."));
          } else if (error.code !== error.TIMEOUT) {
            finish(undefined, new Error("The browser could not provide a reliable location. Use ultrasound attendance instead."));
          }
        },
        { enableHighAccuracy: true, maximumAge: 0, timeout: timeoutMs },
      );
    } catch {
      finish(undefined, new Error("The browser could not start location tracking. Use ultrasound attendance instead."));
    }
  });
}

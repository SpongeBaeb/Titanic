export const preloadImages = (imageUrls: string[]): Promise<void[]> => {
  if (typeof window === 'undefined') return Promise.resolve([]);

  const promises = imageUrls.map((url) => {
    return new Promise<void>((resolve) => {
      if (!url) {
        resolve();
        return;
      }
      const img = new Image();
      img.onload = () => resolve();
      img.onerror = () => resolve();
      img.src = url;
    });
  });

  return Promise.all(promises);
};

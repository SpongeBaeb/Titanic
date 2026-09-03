export const preloadImages = (imageUrls: string[]) => {
  if (typeof window === 'undefined') return;

  imageUrls.forEach((url) => {
    if (!url) return;
    const img = new Image();
    img.src = url;
  });
};

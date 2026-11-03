// 이미지 경로 규칙 (이미지_최적화_기준.md §2-4)
// 승객 이미지는 이름 대신 슬러그로 저장한다. scripts/optimize_images.py 의 slugify 와 결과가 같아야 한다.

/** 'August Wennerström' -> 'august-wennerstrom' */
export function slugify(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** 승객 카드 초상 경로 */
export function resultImage(name: string): string {
  return `/result/${slugify(name)}.webp`;
}

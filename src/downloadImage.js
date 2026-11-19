import html2canvas from 'html2canvas';

export default function downloadImage(element, filename) {
  if (!element) return;

  return html2canvas(element).then(canvas => {
    const link = document.createElement('a');
    link.download = filename;
    link.href = canvas.toDataURL('image/png');
    link.click();
  });
}

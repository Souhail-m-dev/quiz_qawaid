import { jsPDF } from 'jspdf';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';

const TEMPLATE_URL = '/certificat.jpg';

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function canvasToBlob(canvas, type = 'image/png', quality = 0.95) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) return reject(new Error('Impossible de générer le fichier image.'));
      resolve(blob);
    }, type, quality);
  });
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export async function fetchAssetBase64(url) {
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Asset introuvable: ${url}`);
  const blob = await resp.blob();
  const dataUrl = await blobToDataUrl(blob);
  return String(dataUrl).split(',')[1];
}

export function formatCertificateDate(date = new Date()) {
  return date.toLocaleDateString('fr-FR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
}

export function isCertificateEligible(attempt, minScorePercent) {
  if (!attempt?.submitted_at) return false;
  if (!attempt?.total || attempt.total <= 0) return false;
  if (typeof minScorePercent !== 'number' || Number.isNaN(minScorePercent)) return false;
  return (attempt.score / attempt.total) >= (minScorePercent / 100);
}

export function sanitizeFileName(s) {
  return (s || 'etudiant')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9-_]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
}

export async function generateCertificatePngBlob({ studentName, dateLabel, templateUrl = TEMPLATE_URL }) {
  const image = await loadImage(templateUrl);
  const canvas = document.createElement('canvas');
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;

  const ctx = canvas.getContext('2d');
  ctx.drawImage(image, 0, 0);

  const w = canvas.width;
  const h = canvas.height;

  const rawName = (studentName || 'Étudiant').trim();
  const name = rawName ? (rawName.charAt(0).toUpperCase() + rawName.slice(1).toLowerCase()) : 'Étudiant';
  const maxNameWidth = w * 0.58;
  let nameFontSize = Math.round(h * 0.085);
  ctx.font = `300 ${nameFontSize}px "Palace Script MT", "Edwardian Script ITC", "Brush Script MT", "Lucida Handwriting", cursive`;
  while (ctx.measureText(name).width > maxNameWidth && nameFontSize > Math.round(h * 0.045)) {
    nameFontSize -= 2;
    ctx.font = `300 ${nameFontSize}px "Palace Script MT", "Edwardian Script ITC", "Brush Script MT", "Lucida Handwriting", cursive`;
  }

  const centerLineY = Math.round(h * 0.772);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#17152f';
  ctx.fillText(name, w * 0.5, centerLineY - 30);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#2f2f40';
  ctx.font = `${Math.round(h * 0.038)}px "Times New Roman", serif`;
  ctx.fillText(dateLabel || formatCertificateDate(new Date()), w * 0.18, h * 0.763 - 28);

  return canvasToBlob(canvas, 'image/png', 0.95);
}

export async function generateCertificatePdfBlob({ pngBlob }) {
  const dataUrl = await blobToDataUrl(pngBlob);
  const pdf = new jsPDF({
    orientation: 'landscape',
    unit: 'pt',
    format: 'a4'
  });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  pdf.addImage(dataUrl, 'PNG', 0, 0, pageWidth, pageHeight);
  return pdf.output('blob');
}

export async function generateCertificatesZip(entries) {
  const zip = new JSZip();
  for (const entry of entries) {
    zip.file(entry.fileName, entry.blob);
  }
  return zip.generateAsync({ type: 'blob' });
}

export function downloadBlob(blob, fileName) {
  saveAs(blob, fileName);
}

// =========================
// UTILIDADES
// =========================
const $ = (sel) => document.querySelector(sel);
const toast = (msg, cls = "") => {
  const el = $("#status");
  el.textContent = msg;
  el.className = `toast ${cls}`;
  el.style.display = "block";
  clearTimeout(el._t);
  el._t = setTimeout(() => { el.style.display = "none"; }, 5000);
};
const log = (...args) => console.log("[REPORTES]", ...args);

// =========================
// CONFIGURACIÓN
// =========================
const APPS_SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbx42uv42jJ_LPaMSFyukRzPyupr9aHixMyMQeIStatVCbJ3pU24Fn3NG1eP1A5lWfmZPQ/exec";

// =========================
// FIRMA DIGITAL
// =========================
const sig = document.getElementById("signature");
const ctx = sig.getContext("2d");
let drawing = false;
let history = [];

function resizeCanvasSafe() {
  const data = sig.toDataURL();
  const rect = sig.getBoundingClientRect();
  sig.width = rect.width;
  sig.height = 200;
  const img = new Image();
  img.onload = () => ctx.drawImage(img, 0, 0, sig.width, sig.height);
  img.src = data;
}
window.addEventListener("resize", resizeCanvasSafe);
resizeCanvasSafe();

const getPos = (e) => {
  const r = sig.getBoundingClientRect();
  const t = e.touches ? e.touches[0] : e;
  return { x: t.clientX - r.left, y: t.clientY - r.top };
};

function startDraw(e) {
  drawing = true;
  history.push(ctx.getImageData(0, 0, sig.width, sig.height));
  const p = getPos(e);
  ctx.beginPath();
  ctx.moveTo(p.x, p.y);
}
function moveDraw(e) {
  if (!drawing) return;
  const p = getPos(e);
  ctx.lineTo(p.x, p.y);
  ctx.strokeStyle = "#e8f0ff";
  ctx.lineWidth = 2;
  ctx.lineJoin = ctx.lineCap = "round";
  ctx.stroke();
}
function endDraw() {
  drawing = false;
}

sig.addEventListener("mousedown", startDraw);
sig.addEventListener("mousemove", moveDraw);
sig.addEventListener("mouseup", endDraw);
sig.addEventListener("mouseleave", endDraw);

sig.addEventListener("touchstart", startDraw, { passive: false });
sig.addEventListener("touchmove", moveDraw, { passive: false });
sig.addEventListener("touchend", endDraw);

$("#sig-clear").onclick = () => {
  ctx.clearRect(0, 0, sig.width, sig.height);
  history = [];
};

$("#sig-undo").onclick = () => {
  const last = history.pop();
  if (last) ctx.putImageData(last, 0, 0);
};

const getSignatureBase64 = () => sig.toDataURL("image/png");

// =========================
// MANEJO DE FOTOS
// =========================
let photoFiles = [];

$("#fotos").addEventListener("change", async (e) => {
  const files = Array.from(e.target.files);
  toast("Procesando fotos...", "btn-warning");

  for (const f of files) {
    if (!f.type.startsWith("image/")) continue;
    if (photoFiles.length >= 8) {
      toast("Máximo 8 fotos", "btn-danger");
      break;
    }

    const compressed = await compressImage(f);
    photoFiles.push(compressed);
  }

  renderThumbs();
  toast("Fotos listas", "btn-success");
});

function renderThumbs() {
  const thumbs = $("#thumbs");
  thumbs.innerHTML = "";
  photoFiles.forEach((f, i) => {
    const url = URL.createObjectURL(f);
    const div = document.createElement("div");
    div.className = "thumb";
    div.innerHTML = `
      <img src="${url}"/>
      <button class="btn remove">✕</button>
    `;
    div.querySelector(".remove").onclick = () => {
      URL.revokeObjectURL(url);
      photoFiles.splice(i, 1);
      renderThumbs();
    };
    thumbs.appendChild(div);
  });
}

function compressImage(file, maxW = 1200, quality = 0.7) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let w = img.width,
          h = img.height;
        if (w > maxW) {
          h = (h * maxW) / w;
          w = maxW;
        }
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const c = canvas.getContext("2d");
        c.drawImage(img, 0, 0, w, h);
        canvas.toBlob(
          (blob) =>
            resolve(new File([blob], file.name.replace(/\..+$/, ".jpg"), { type: "image/jpeg" })),
          "image/jpeg",
          quality
        );
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

// =========================
// PDF GENERATION
// =========================
function fileToDataURL(file) {
  return new Promise((res) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.readAsDataURL(file);
  });
}

async function buildPDF() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: "pt", format: "a4" });

  const data = Object.fromEntries(new FormData($("#reporteForm")).entries());

  // Encabezado
  doc.setFillColor(17, 27, 50);
  doc.rect(0, 0, 595, 80, "F");
  doc.setTextColor(255);
  doc.setFontSize(18);
  doc.text("REPORTE DE TRABAJO", 40, 50);

  doc.setTextColor(30);
  doc.setFontSize(11);

  let y = 110;
  const lh = 16;

  // Cliente
  doc.text(`Nombre: ${data.cliente_nombre}`, 40, y);
  y += lh;
  doc.text(`Correo: ${data.cliente_email}`, 40, y);
  y += lh;

  if (data.cliente_telefono) {
    doc.text(`Teléfono: ${data.cliente_telefono}`, 40, y);
    y += lh;
  }

  if (data.cliente_direccion) {
    doc.text(`Dirección: ${data.cliente_direccion}`, 40, y);
    y += lh;
  }
  y += 10;

  // Máquina
  doc.text(`Marca: ${data.maq_marca || "-"}`, 40, y);
  y += lh;
  doc.text(`Modelo: ${data.maq_modelo || "-"}`, 40, y);
  y += lh;
  doc.text(`Serie: ${data.maq_serie || "-"}`, 40, y);
  y += lh;
  y += 10;

  // Reporte
  doc.text(`Fecha: ${data.fecha}`, 40, y);
  y += lh;
  doc.text(`N° Reporte: ${data.reporte_num}`, 40, y);
  y += lh;
  y += 10;

  const notas = data.notas || "";
  doc.text("Notas:", 40, y);
  y += lh;

  const wrapped = doc.splitTextToSize(notas, 500);
  doc.text(wrapped, 40, y);
  y += wrapped.length * lh + 20;

  // Firma
  doc.text("Firma del cliente:", 40, y);
  y += 10;

  const sigData = getSignatureBase64();
  if (sigData && sigData.length > 100) {
    const img = new Image();
    img.src = sigData;
    await new Promise((r) => (img.onload = r));
    const maxW = 300;
    const scale = Math.min(maxW / img.width, 1);
    const w = img.width * scale,
      h = img.height * scale;
    doc.addImage(img, "PNG", 40, y, w, h);
    y += h + 20;
  } else {
    doc.text("(Sin firma)", 40, y);
    y += 20;
  }

  // Fotos
  for (let i = 0; i < photoFiles.length; i++) {
    if (i % 2 === 0) {
      doc.addPage();
      doc.text("Evidencia fotográfica", 40, 50);
    }

    const file = photoFiles[i];
    const dataUrl = await fileToDataURL(file);
    const img = new Image();
    img.src = dataUrl;
    await new Promise((r) => (img.onload = r));

    const maxW = 515,
      maxH = 300;
    const s = Math.min(maxW / img.width, maxH / img.height);
    const w = img.width * s,
      h = img.height * s;

    const x = 40 + (maxW - w) / 2;
    const yPos = 80 + (i % 2) * (h + 40);

    doc.addImage(img, "JPEG", x, yPos, w, h);
  }

  return doc;
}

// =========================
// ENVIAR PDF AL BACKEND
// =========================
async function enviarPDF(pdfDoc, filename, destino, data) {
  try {
    const dataUri = pdfDoc.output("datauristring");
    const base64 = dataUri.split(",")[1];

    const payload = {
      destino,
      filename,
      pdf: base64,
      subject: `Reporte ${data.reporte_num} - ${data.cliente_nombre}`,
      message: `
        <h3>Nuevo reporte generado</h3>
        <p><strong>Cliente:</strong> ${data.cliente_nombre}</p>
        <p><strong>Fecha:</strong> ${data.fecha}</p>
        <p><strong>N° Reporte:</strong> ${data.reporte_num}</p>
      `
    };

    const form = new FormData();
    form.append("data", JSON.stringify(payload));

    const res = await fetch(APPS_SCRIPT_URL, {
    method: "POST",
    body: form
    });

    const text = await res.text();
    log("Respuesta del servidor:", text);

    let json;
    try {
      json = JSON.parse(text);
    } catch {
      return { success: false, error: "Respuesta no es JSON", raw: text };
    }

    return json;
  } catch (err) {
    log("Error enviando PDF:", err);
    return { success: false, error: err.toString() };
  }
}

// =========================
// MANEJO DEL BOTÓN
// =========================
$("#btn-enviar").addEventListener("click", async () => {
  try {
    const data = Object.fromEntries(new FormData($("#reporteForm")).entries());

    if (!data.cliente_nombre || !data.cliente_email || !data.fecha || !data.reporte_num) {
      toast("Completa los campos obligatorios", "btn-danger");
      return;
    }

    toast("Generando PDF...", "btn-warning");
    const pdf = await buildPDF();
    const filename = `reporte-${data.reporte_num}.pdf`;

    toast("Enviando PDF...", "btn-warning");
    const response = await enviarPDF(pdf, filename, data.cliente_email, data);

    if (response.success) {
      toast("PDF enviado correctamente", "btn-success");
    } else {
      toast("Error al enviar PDF", "btn-danger");
      console.log("Detalles del error:", response);
    }
  } catch (err) {
    toast("Error general, revisa consola", "btn-danger");
    console.error(err);
  }
});

// evita submit con Enter
$("#reporteForm").addEventListener("submit", (e) => e.preventDefault());

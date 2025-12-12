/* ----------------------------------------------------------
   CONTROL DE PESTAÑAS
---------------------------------------------------------- */
const tabButtons = document.querySelectorAll(".tab-btn");
const tabBlocks = document.querySelectorAll(".tab-block");

tabButtons.forEach(btn => {
  btn.addEventListener("click", () => {
    const tab = btn.dataset.tab;

    document.getElementById("tipo_servicio").value = tab;

    tabBlocks.forEach(t => t.classList.add("hidden"));
    document.getElementById(`tab-${tab}`).classList.remove("hidden");

    tabButtons.forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
  });
});

/* ----------------------------------------------------------
   FIRMA DIGITAL
---------------------------------------------------------- */
const canvas = document.getElementById("signature");
const ctx = canvas.getContext("2d");

canvas.width = 600;
canvas.height = 250;

let drawing = false;
let strokes = [];
let currentStroke = [];

canvas.addEventListener("mousedown", e => {
  drawing = true;
  currentStroke = [];
});

canvas.addEventListener("mouseup", e => {
  drawing = false;
  if (currentStroke.length > 0) {
    strokes.push(currentStroke);
  }
});

canvas.addEventListener("mousemove", e => {
  if (!drawing) return;

  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

  currentStroke.push({ x, y });

  ctx.lineWidth = 2;
  ctx.lineCap = "round";
  ctx.lineTo(x, y);
  ctx.stroke();
});

document.getElementById("sig-clear").addEventListener("click", () => {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  strokes = [];
  currentStroke = [];
});

document.getElementById("sig-undo").addEventListener("click", () => {
  strokes.pop();
  redrawSignature();
});

function redrawSignature() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.beginPath();
  strokes.forEach(stroke => {
    stroke.forEach((p, i) => {
      if (i === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    });
  });
  ctx.stroke();
}

/* ----------------------------------------------------------
   CAPTURA DE FOTOS
---------------------------------------------------------- */
const fotosInput = document.getElementById("fotos");
const thumbs = document.getElementById("thumbs");
let fotosArray = [];

fotosInput.addEventListener("change", e => {
  fotosArray = [...e.target.files];
  thumbs.innerHTML = "";

  fotosArray.forEach(file => {
    const img = document.createElement("img");
    img.src = URL.createObjectURL(file);
    img.className = "thumb";
    thumbs.appendChild(img);
  });
});

/* ----------------------------------------------------------
   OBTENER CONSECUTIVO DESDE GOOGLE APPS SCRIPT
---------------------------------------------------------- */
async function getConsecutivo(tipo) {
  const url = "YOUR_WEBAPP_URL"; // <-- REEMPLAZAR

  const payload = {
    getConsecutivo: true,
    tipo_servicio: tipo
  };

  const res = await fetch(url, {
    method: "POST",
    body: new URLSearchParams({ data: JSON.stringify(payload) })
  });

  const json = await res.json();
  return json.reporte_num;
}

/* ----------------------------------------------------------
   GENERACIÓN DEL PDF
---------------------------------------------------------- */
async function generarPDF(formData, fotosBase64, firmaBase64) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: "pt", format: "letter" });

  let y = 40;
  const lh = 18;

  doc.setFontSize(18);
  doc.text("Reporte Técnico SAC", 40, y);
  y += 30;

  doc.setFontSize(12);
  doc.text(`Fecha: ${formData.fecha}`, 40, y); y += lh;
  doc.text(`Empresa: ${formData.cliente_empresa}`, 40, y); y += lh;
  doc.text(`Encargado: ${formData.cliente_encargado}`, 40, y); y += lh;
  doc.text(`Correo: ${formData.cliente_email}`, 40, y); y += lh;
  doc.text(`Teléfono: ${formData.cliente_telefono || "-"}`, 40, y); y += lh;
  doc.text(`Dirección: ${formData.cliente_direccion}`, 40, y); y += lh + 10;

  doc.setFontSize(14);
  doc.text("Datos de la máquina", 40, y);
  y += 25;

  doc.setFontSize(12);
  doc.text(`Tipo: ${formData.maq_tipo || "-"}`, 40, y); y += lh;
  doc.text(`Marca: ${formData.maq_marca || "-"}`, 40, y); y += lh;
  doc.text(`Modelo: ${formData.maq_modelo || "-"}`, 40, y); y += lh;
  doc.text(`Serial: ${formData.maq_serial || "-"}`, 40, y); y += lh;
  doc.text(`Año: ${formData.maq_ano || "-"}`, 40, y); y += lh + 10;

  // SECCIÓN SEGÚN TIPO
  const tipo = formData.tipo_servicio;

  function titulo(text) {
    doc.setFontSize(14);
    doc.text(text, 40, y);
    y += 25;
    doc.setFontSize(12);
  }

  function imprimirLecturas(prefix) {
    doc.text(`Presión: ${formData[prefix + "presion"] || "-"}`, 40, y); y += lh;
    doc.text(`Temperatura: ${formData[prefix + "temp"] || "-"}`, 40, y); y += lh;
    doc.text(`Voltaje: ${formData[prefix + "voltaje"] || "-"}`, 40, y); y += lh;
    doc.text(`Corriente: ${formData[prefix + "corriente"] || "-"}`, 40, y); y += lh;
    doc.text(`RPM: ${formData[prefix + "rpm"] || "-"}`, 40, y); y += lh;
    doc.text(`Horas totales: ${formData[prefix + "hrs_tot"] || "-"}`, 40, y); y += lh;
    if (prefix === "prev_") {
      doc.text(`Horas en carga: ${formData.prev_hrs_carga || "-"}`, 40, y);
      y += lh;
    }
    y += 10;
  }

  if (tipo === "preventivo") {
    titulo("Mantenimiento Preventivo");
    imprimirLecturas("prev_");

    titulo("Componentes reemplazados");
    const comp = [
      "prev_filtro_aire", "prev_filtro_aceite", "prev_filtro_separador",
      "prev_aceite", "prev_grasa", "prev_rodamientos",
      "prev_valvulas", "prev_mangueras",
      "prev_electricos", "prev_electronicos"
    ];
    comp.forEach(c => {
      if (formData[c]) { doc.text("• " + c.replace("prev_", "").replace("_", " "), 40, y); y += lh; }
    });

    y += 10;
    titulo("Notas");
    const txt = doc.splitTextToSize(formData.prev_notas || "-", 520);
    doc.text(txt, 40, y); y += txt.length * lh;

  } else if (tipo === "correctivo") {
    titulo("Mantenimiento Correctivo");
    imprimirLecturas("corr_");

    titulo("Falla reportada");
    const tr = doc.splitTextToSize(formData.corr_falla || "-", 520);
    doc.text(tr, 40, y); y += tr.length * lh;

    titulo("Reparación realizada");
    const rr = doc.splitTextToSize(formData.corr_reparacion || "-", 520);
    doc.text(rr, 40, y); y += rr.length * lh;

    titulo("Componentes reemplazados");
    const comp = [
      "corr_filtro_aire", "corr_filtro_aceite", "corr_filtro_separador",
      "corr_aceite", "corr_grasa", "corr_rodamientos",
      "corr_valvulas", "corr_mangueras",
      "corr_electricos", "corr_electronicos"
    ];
    comp.forEach(c => {
      if (formData[c]) { doc.text("• " + c.replace("corr_", "").replace("_", " "), 40, y); y += lh; }
    });

    titulo("Detalles");
    doc.text(`Válvulas: ${formData.corr_valvulas_det || "-"}`, 40, y); y += lh;
    doc.text(`Mangueras: ${formData.corr_mangueras_det || "-"}`, 40, y); y += lh;

    doc.text("Componentes eléctricos:", 40, y); y += lh;
    const el = doc.splitTextToSize(formData.corr_electricos_det || "-", 520);
    doc.text(el, 40, y); y += el.length * lh;

    doc.text("Componentes electrónicos:", 40, y); y += lh;
    const en = doc.splitTextToSize(formData.corr_electronicos_det || "-", 520);
    doc.text(en, 40, y); y += en.length * lh;

    titulo("Notas");
    const nt = doc.splitTextToSize(formData.corr_notas || "-", 520);
    doc.text(nt, 40, y); y += nt.length * lh;

  } else if (tipo === "diagnostico") {
    titulo("Diagnóstico");
    imprimirLecturas("diag_");

    titulo("Descripción del diagnóstico");
    const td = doc.splitTextToSize(formData.diag_descripcion || "-", 520);
    doc.text(td, 40, y); y += td.length * lh;

    titulo("Recomendaciones");
    const rec = doc.splitTextToSize(formData.diag_recomendaciones || "-", 520);
    doc.text(rec, 40, y); y += rec.length * lh;

  } else if (tipo === "suministros") {
    titulo("Suministros");
    const comp = [
      "sum_filtro_aire", "sum_filtro_aceite", "sum_filtro_separador",
      "sum_aceite", "sum_valvulas", "sum_prefiltros",
      "sum_tuberia", "sum_electricos", "sum_electronicos"
    ];
    comp.forEach(c => {
      if (formData[c]) { doc.text("• " + c.replace("sum_", "").replace("_", " "), 40, y); y += lh; }
    });

    titulo("Notas");
    const ns = doc.splitTextToSize(formData.sum_notas || "-", 520);
    doc.text(ns, 40, y); y += ns.length * lh;
  }

  // TÉCNICO
  y += 20;
  titulo("Técnico");
  doc.text(formData.tecnico, 40, y);
  y += 40;

  // FOTOS
  if (fotosBase64.length > 0) {
    titulo("Fotografías");

    for (let i = 0; i < fotosBase64.length; i++) {
      if (y > 650) {
        doc.addPage();
        y = 40;
      }
      doc.addImage(fotosBase64[i], "JPEG", 40, y, 200, 150);
      y += 170;
    }
  }

  // FIRMA
  titulo("Firma del cliente");
  doc.addImage(firmaBase64, "PNG", 40, y, 200, 100);

  return doc.output("arraybuffer");
}

/* ----------------------------------------------------------
   ENVÍO AL BACKEND
---------------------------------------------------------- */
async function enviarDatos(pdfBuffer, formData) {
  const url = "YOUR_WEBAPP_URL"; // REEMPLAZAR

  const payload = {
    pdf: btoa(new Uint8Array(pdfBuffer).reduce((d, b) => d + String.fromCharCode(b), "")),
    destino: formData.cliente_email,
    tipo_servicio: formData.tipo_servicio,
    asunto: "Reporte " + formData.reporte_num,
    mensaje: "Adjunto reporte técnico generado.",
  };

  const res = await fetch(url, {
    method: "POST",
    body: new URLSearchParams({ data: JSON.stringify(payload) })
  });

  return await res.json();
}

/* ----------------------------------------------------------
   BOTÓN ENVIAR
---------------------------------------------------------- */
document.getElementById("btn-enviar").addEventListener("click", async () => {
  const status = document.getElementById("status");
  status.className = "toast show";
  status.textContent = "Procesando...";

  const form = document.getElementById("reporteForm");
  const formData = Object.fromEntries(new FormData(form).entries());

  if (!formData.tipo_servicio) {
    status.textContent = "Seleccione un tipo de servicio.";
    return;
  }

  // Obtener firma
  const firmaBase64 = canvas.toDataURL("image/png");

  // Obtener fotos
  const fotosBase64 = await Promise.all(
    fotosArray.map(f =>
      new Promise(resolve => {
        const reader = new FileReader();
        reader.onload = e => resolve(e.target.result);
        reader.readAsDataURL(f);
      })
    )
  );

  // Consecutivo
  const consec = await getConsecutivo(formData.tipo_servicio);
  formData.reporte_num = consec;

  // Generar PDF
  const pdfArrayBuffer = await generarPDF(formData, fotosBase64, firmaBase64);

  // Enviar
  const result = await enviarDatos(pdfArrayBuffer, formData);

  if (result.success) {
    status.textContent = "Envío completado.";
  } else {
    status.textContent = "Error: " + result.error;
  }
});


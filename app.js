const STORAGE_KEY = "smart-qr-gallery";

const form = document.getElementById("qr-form");
const input = document.getElementById("url-input");
const section = document.getElementById("qr-section");
const qrBox = document.getElementById("qr-box");
const urlLabel = document.getElementById("qr-url");
const downloadBtn = document.getElementById("qr-download");
const createView = document.getElementById("create-view");
const galleryView = document.getElementById("gallery-view");
const galleryGrid = document.getElementById("gallery-grid");
const galleryEmpty = document.getElementById("gallery-empty");
const dialog = document.getElementById("qr-dialog");
const dialogQr = document.getElementById("dialog-qr");
const dialogName = document.getElementById("dialog-name");
const dialogUrl = document.getElementById("dialog-url");
const dialogDownload = document.getElementById("dialog-download");
const dialogClose = document.getElementById("dialog-close");

let currentUrl = "";
let currentImage = "";
let selectedItem = null;

function loadGallery() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveGallery(items) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

function siteLabel(url) {
  const parsed = new URL(url);
  const host = parsed.hostname.replace(/^www\./, "");
  const last = parsed.pathname.replace(/\/+$/, "").split("/").filter(Boolean).pop();
  return last ? `${host} / ${last}` : host;
}

function fileNameFromUrl(url) {
  return `${siteLabel(url).replace(/[\\/:*?"<>|]+/g, "-")}.png`;
}

function downloadImage(dataUrl, name) {
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = name;
  link.click();
}

function qrDataUrl() {
  const canvas = qrBox.querySelector("canvas");
  if (canvas) {
    return canvas.toDataURL("image/png");
  }

  const image = qrBox.querySelector("img");
  return image ? image.src : "";
}

function waitForQrImage() {
  return new Promise((resolve) => {
    const tryRead = () => {
      const dataUrl = qrDataUrl();
      if (dataUrl && dataUrl.length > 100) {
        resolve(dataUrl);
        return;
      }
      requestAnimationFrame(tryRead);
    };
    tryRead();
  });
}

function normalizeUrl(raw) {
  const value = raw.trim();
  if (!value) {
    throw new Error("URL을 입력해 주세요.");
  }

  const withProtocol = /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(value)
    ? value
    : `https://${value}`;

  let parsed;
  try {
    parsed = new URL(withProtocol);
  } catch {
    throw new Error("올바른 URL 형식이 아닙니다.");
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("http 또는 https 주소만 QR로 만들 수 있습니다.");
  }

  return parsed.toString();
}

function generateQr(url) {
  qrBox.replaceChildren();
  new QRCode(qrBox, {
    text: url,
    width: 280,
    height: 280,
    colorDark: "#0b1a4a",
    colorLight: "#ffffff",
    correctLevel: QRCode.CorrectLevel.M,
  });

  currentUrl = url;
  urlLabel.textContent = url;
  section.hidden = false;
}

function upsertGalleryItem(url, image) {
  const items = loadGallery().filter((item) => item.url !== url);
  items.unshift({
    id: `${Date.now()}`,
    url,
    name: siteLabel(url),
    image,
    createdAt: Date.now(),
  });
  saveGallery(items);
  renderGallery();
}

function renderGallery() {
  const items = loadGallery();
  galleryGrid.replaceChildren();
  galleryEmpty.hidden = items.length > 0;
  galleryGrid.hidden = items.length === 0;

  items.forEach((item) => {
    const card = document.createElement("article");
    card.className = "gallery-card";
    card.dataset.id = item.id;

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "gallery-delete";
    remove.setAttribute("aria-label", `${item.name} QR 삭제`);
    remove.textContent = "×";

    const thumb = document.createElement("img");
    thumb.className = "gallery-thumb";
    thumb.src = item.image;
    thumb.alt = `${item.name} QR`;

    const name = document.createElement("p");
    name.className = "gallery-name";
    name.textContent = item.name;

    card.append(remove, thumb, name);
    galleryGrid.append(card);
  });
}

function showView(name) {
  const isGallery = name === "gallery";
  createView.hidden = isGallery;
  galleryView.hidden = !isGallery;

  document.querySelectorAll(".category-btn").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.view === name);
  });
}

function openItem(item) {
  selectedItem = item;
  dialogQr.src = item.image;
  dialogName.textContent = item.name;
  dialogUrl.textContent = item.url;
  dialog.showModal();
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  try {
    const url = normalizeUrl(input.value);
    input.value = url;
    generateQr(url);
    currentImage = await waitForQrImage();
    upsertGalleryItem(url, currentImage);
  } catch (error) {
    section.hidden = true;
    currentUrl = "";
    currentImage = "";
    alert(error.message);
  }
});

downloadBtn.addEventListener("click", () => {
  const image = currentImage || qrDataUrl();
  if (!currentUrl || !image) {
    return;
  }
  downloadImage(image, fileNameFromUrl(currentUrl));
});

document.querySelector(".category-nav").addEventListener("click", (event) => {
  const button = event.target.closest(".category-btn");
  if (!button) {
    return;
  }
  showView(button.dataset.view);
});

galleryGrid.addEventListener("click", (event) => {
  const remove = event.target.closest(".gallery-delete");
  const card = event.target.closest(".gallery-card");
  if (!card) {
    return;
  }

  if (remove) {
    event.preventDefault();
    event.stopPropagation();
    const next = loadGallery().filter((item) => item.id !== card.dataset.id);
    saveGallery(next);
    renderGallery();
    return;
  }

  const item = loadGallery().find((entry) => entry.id === card.dataset.id);
  if (item) {
    openItem(item);
  }
});

galleryGrid.addEventListener("keydown", (event) => {
  if (event.key !== "Enter" && event.key !== " ") {
    return;
  }
  const remove = event.target.closest(".gallery-delete");
  if (!remove) {
    return;
  }
  event.preventDefault();
  remove.click();
});

dialogDownload.addEventListener("click", () => {
  if (!selectedItem) {
    return;
  }
  downloadImage(selectedItem.image, fileNameFromUrl(selectedItem.url));
});

dialogClose.addEventListener("click", () => dialog.close());
dialog.addEventListener("click", (event) => {
  if (event.target === dialog) {
    dialog.close();
  }
});

renderGallery();
